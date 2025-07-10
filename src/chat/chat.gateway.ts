import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { KeyExchangeService } from '../crypto/key-exchange.service';
import { InitiateKeyExchangeDto, CompleteKeyExchangeDto } from '../crypto/dto/key-exchange.dto';
import { CreateEncryptedMessageDto } from './dto/encrypted-message.dto';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
  };
}

interface HandshakeAuth {
  token?: string;
}

interface HandshakeHeaders {
  authorization?: string;
}

interface CustomHandshake {
  auth: HandshakeAuth;
  headers: HandshakeHeaders;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private jwtService: JwtService,
    private chatService: ChatService,
    private keyExchangeService: KeyExchangeService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const handshake = client.handshake as CustomHandshake;
      const token =
        handshake.auth.token ||
        handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      this.connectedUsers.set(userId, client.id);
      (client as AuthenticatedSocket).data = { userId };

      console.log(`User ${userId} connected with socket ${client.id}`);
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data?.userId;
    if (userId) {
      this.connectedUsers.delete(userId);
      console.log(`User ${userId} disconnected`);
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; content: string },
  ) {
    try {
      const userId = client.data?.userId;
      if (!userId) {
        return;
      }

      // Validate message content
      if (!data.content || data.content.trim().length === 0) {
        client.emit('error', { message: 'Message content cannot be empty' });
        return;
      }

      // Create message in database
      const message = await this.chatService.createMessage(
        userId,
        data.conversationId,
        data.content.trim(),
      );

      // Get conversation participants
      const conversation = await this.chatService.getConversationById(
        data.conversationId,
      );
      if (!conversation) {
        client.emit('error', { message: 'Conversation not found' });
        return;
      }

      // Format message for clients
      const messageData = {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        conversationId: data.conversationId,
        sender: {
          id: message.sender.id,
          firstName: message.sender.firstName,
          lastName: message.sender.lastName,
          profilePicture: message.sender.profilePicture,
        },
      };

      // Send to all participants
      for (const participant of conversation.participants) {
        const participantSocketId = this.connectedUsers.get(participant.id);
        if (participantSocketId) {
          this.server.to(participantSocketId).emit('newMessage', messageData);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  @SubscribeMessage('startTyping')
  async handleStartTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const userId = client.data?.userId;
      if (!userId) {
        return;
      }

      const conversation = await this.chatService.getConversationById(
        data.conversationId,
      );
      if (!conversation) {
        return;
      }

      // Notify other participants
      for (const participant of conversation.participants) {
        if (participant.id !== userId) {
          const participantSocketId = this.connectedUsers.get(participant.id);
          if (participantSocketId) {
            this.server.to(participantSocketId).emit('userTyping', {
              conversationId: data.conversationId,
              userId: userId,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error handling typing:', error);
    }
  }

  @SubscribeMessage('stopTyping')
  async handleStopTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const userId = client.data?.userId;
      if (!userId) {
        return;
      }

      const conversation = await this.chatService.getConversationById(
        data.conversationId,
      );
      if (!conversation) {
        return;
      }

      // Notify other participants
      for (const participant of conversation.participants) {
        if (participant.id !== userId) {
          const participantSocketId = this.connectedUsers.get(participant.id);
          if (participantSocketId) {
            this.server.to(participantSocketId).emit('userStoppedTyping', {
              conversationId: data.conversationId,
              userId: userId,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error handling stop typing:', error);
    }
  }

  @SubscribeMessage('initiateKeyExchange')
  async handleInitiateKeyExchange(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: InitiateKeyExchangeDto,
  ) {
    try {
      const userId = client.data?.userId;
      if (!userId) {
        return;
      }

      const result = await this.keyExchangeService.initiateKeyExchange(userId, data);
      
      client.emit('keyExchangeInitiated', result);

      // Notify other participants
      const conversation = await this.chatService.getConversationById(data.conversationId);
      if (conversation) {
        for (const participant of conversation.participants) {
          if (participant.id !== userId) {
            const participantSocketId = this.connectedUsers.get(participant.id);
            if (participantSocketId) {
              this.server.to(participantSocketId).emit('keyExchangeRequest', {
                conversationId: data.conversationId,
                from: userId,
                publicKey: data.publicKey,
                signingKey: data.signingKey,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error initiating key exchange:', error);
      client.emit('error', { message: 'Failed to initiate key exchange' });
    }
  }

  @SubscribeMessage('completeKeyExchange')
  async handleCompleteKeyExchange(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: CompleteKeyExchangeDto,
  ) {
    try {
      const userId = client.data?.userId;
      if (!userId) {
        return;
      }

      const result = await this.keyExchangeService.completeKeyExchange(userId, data);
      
      client.emit('keyExchangeCompleted', result);

      // Notify other participants if key exchange is complete
      if (result.success && result.message.includes('completed')) {
        const conversation = await this.chatService.getConversationById(data.conversationId);
        if (conversation) {
          for (const participant of conversation.participants) {
            if (participant.id !== userId) {
              const participantSocketId = this.connectedUsers.get(participant.id);
              if (participantSocketId) {
                this.server.to(participantSocketId).emit('keyExchangeCompleted', {
                  conversationId: data.conversationId,
                  status: 'completed',
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error completing key exchange:', error);
      client.emit('error', { message: 'Failed to complete key exchange' });
    }
  }

  @SubscribeMessage('sendEncryptedMessage')
  async handleSendEncryptedMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: CreateEncryptedMessageDto,
  ) {
    try {
      const userId = client.data?.userId;
      if (!userId) {
        return;
      }

      // Validate message content
      if (data.isEncrypted && (!data.ciphertext || !data.nonce || !data.signature)) {
        client.emit('error', { message: 'Invalid encrypted message format' });
        return;
      }

      if (!data.isEncrypted && (!data.content || data.content.trim().length === 0)) {
        client.emit('error', { message: 'Message content cannot be empty' });
        return;
      }

      // Create message in database
      const message = await this.chatService.createEncryptedMessage(userId, data);

      // Get conversation participants
      const conversation = await this.chatService.getConversationById(data.conversationId);
      if (!conversation) {
        client.emit('error', { message: 'Conversation not found' });
        return;
      }

      // Format message for clients
      const messageData = {
        id: message.id,
        content: message.content,
        ciphertext: message.ciphertext,
        nonce: message.nonce,
        signature: message.signature,
        sequenceNumber: message.sequenceNumber,
        isEncrypted: message.isEncrypted,
        createdAt: message.createdAt,
        conversationId: data.conversationId,
        sender: {
          id: message.sender.id,
          firstName: message.sender.firstName,
          lastName: message.sender.lastName,
          profilePicture: message.sender.profilePicture,
        },
      };

      // Send to all participants
      for (const participant of conversation.participants) {
        const participantSocketId = this.connectedUsers.get(participant.id);
        if (participantSocketId) {
          this.server.to(participantSocketId).emit('newMessage', messageData);
        }
      }
    } catch (error) {
      console.error('Error sending encrypted message:', error);
      client.emit('error', { message: 'Failed to send encrypted message' });
    }
  }

  @SubscribeMessage('getEncryptionStatus')
  async handleGetEncryptionStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const userId = client.data?.userId;
      if (!userId) {
        return;
      }

      const status = await this.chatService.getEncryptionStatus(data.conversationId);
      client.emit('encryptionStatus', {
        conversationId: data.conversationId,
        ...status,
      });
    } catch (error) {
      console.error('Error getting encryption status:', error);
      client.emit('error', { message: 'Failed to get encryption status' });
    }
  }
}
