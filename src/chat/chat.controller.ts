import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { PaginationDto } from './dto/pagination.dto';
import { KeyExchangeService } from '../crypto/key-exchange.service';
import { InitiateKeyExchangeDto, CompleteKeyExchangeDto } from '../crypto/dto/key-exchange.dto';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly keyExchangeService: KeyExchangeService,
  ) {}

  @Post()
  async createConversation(
    @Request() req: Request & { user: { userId: string } },
    @Body() createConversationDto: CreateConversationDto,
  ) {
    const conversation = await this.chatService.createOrGetConversation(
      req.user.userId,
      createConversationDto.participantId,
    );
    return conversation;
  }

  @Get()
  async getConversations(
    @Request() req: Request & { user: { userId: string } },
  ) {
    const conversations = await this.chatService.getUserConversations(
      req.user.userId,
    );
    return conversations.map((conversation) => ({
      id: conversation.id,
      participants: conversation.participants.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        profilePicture: p.profilePicture,
      })),
      updatedAt: conversation.updatedAt,
      createdAt: conversation.createdAt,
    }));
  }

  @Get(':id/messages')
  async getConversationMessages(
    @Param('id') conversationId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    const messages = await this.chatService.getConversationMessages(
      conversationId,
      paginationDto.page,
      paginationDto.limit,
    );

    return messages.map((message) => ({
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      sender: {
        id: message.sender.id,
        firstName: message.sender.firstName,
        lastName: message.sender.lastName,
        profilePicture: message.sender.profilePicture,
      },
    }));
  }

  @Post(':id/messages')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 messages per minute
  async createMessage(
    @Request() req: Request & { user: { userId: string } },
    @Param('id') conversationId: string,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    const message = await this.chatService.createMessage(
      req.user.userId,
      conversationId,
      createMessageDto.content,
    );

    return {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      sender: {
        id: message.sender.id,
        firstName: message.sender.firstName,
        lastName: message.sender.lastName,
        profilePicture: message.sender.profilePicture,
      },
    };
  }

  @Post(':id/key-exchange/initiate')
  async initiateKeyExchange(
    @Request() req: Request & { user: { userId: string } },
    @Param('id') conversationId: string,
    @Body() initiateKeyExchangeDto: InitiateKeyExchangeDto,
  ) {
    const result = await this.keyExchangeService.initiateKeyExchange(
      req.user.userId,
      { ...initiateKeyExchangeDto, conversationId },
    );
    return result;
  }

  @Post(':id/key-exchange/complete')
  async completeKeyExchange(
    @Request() req: Request & { user: { userId: string } },
    @Param('id') conversationId: string,
    @Body() completeKeyExchangeDto: CompleteKeyExchangeDto,
  ) {
    const result = await this.keyExchangeService.completeKeyExchange(
      req.user.userId,
      { ...completeKeyExchangeDto, conversationId },
    );
    return result;
  }

  @Get(':id/key-exchange/status')
  async getKeyExchangeStatus(@Param('id') conversationId: string) {
    const status = await this.keyExchangeService.getKeyExchangeStatus(conversationId);
    return status;
  }

  @Get(':id/encryption-status')
  async getEncryptionStatus(@Param('id') conversationId: string) {
    const status = await this.chatService.getEncryptionStatus(conversationId);
    return status;
  }

  @Post('generate-keys')
  async generateKeys(@Request() req: Request & { user: { userId: string } }) {
    const keys = await this.keyExchangeService.generateUserKeys(req.user.userId);
    return {
      publicKey: keys.publicKey,
      signingKey: keys.signingKey,
      // No devolvemos las claves privadas por seguridad
    };
  }
}
