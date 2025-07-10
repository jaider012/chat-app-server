import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { KeyExchangeService } from './key-exchange.service';
import { EncryptedMessageDto } from './dto/key-exchange.dto';

export interface EncryptedMessage {
  ciphertext: string;
  nonce: string;
  sequenceNumber: number;
  signature: string;
  senderId: string;
  timestamp: Date;
}

export interface DecryptedMessage {
  content: string;
  senderId: string;
  timestamp: Date;
  sequenceNumber: number;
  isValid: boolean;
}

@Injectable()
export class MessageEncryptionService {
  private readonly logger = new Logger(MessageEncryptionService.name);

  constructor(
    private cryptoService: CryptoService,
    private keyExchangeService: KeyExchangeService,
  ) {}

  /**
   * Encripta un mensaje para una conversación
   */
  async encryptMessage(
    conversationId: string,
    senderId: string,
    content: string,
    privateKey: string,
    privateSigningKey: string,
  ): Promise<EncryptedMessage> {
    try {
      // Verificar que el intercambio de claves esté completo
      const conversationKeys = await this.keyExchangeService.getConversationKeys(conversationId);
      if (!conversationKeys || conversationKeys.status !== 'completed') {
        throw new BadRequestException('Key exchange not completed for this conversation');
      }

      // Obtener el número de secuencia actual
      const currentSequence = conversationKeys.participantKeys[senderId]?.sequenceNumber || 0;
      const newSequence = currentSequence + 1;

      // Derivar la clave de mensaje usando double-ratchet
      if (!conversationKeys.sharedSecret) {
        throw new BadRequestException('Shared secret not available');
      }
      
      const messageKey = this.cryptoService.deriveMessageKey(
        conversationKeys.sharedSecret,
        newSequence,
      );

      // Encriptar el mensaje
      const { ciphertext, nonce } = this.cryptoService.encryptMessage(content, messageKey);

      // Crear el mensaje para firmar
      const messageToSign = `${conversationId}:${ciphertext}:${nonce}:${newSequence}`;
      const signature = this.cryptoService.signMessage(messageToSign, privateSigningKey);

      // Actualizar el número de secuencia
      await this.keyExchangeService.updateParticipantSequence(
        conversationId,
        senderId,
        newSequence,
      );

      this.logger.log(`Message encrypted for conversation ${conversationId}, sequence ${newSequence}`);

      return {
        ciphertext,
        nonce,
        sequenceNumber: newSequence,
        signature,
        senderId,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Error encrypting message', error);
      throw error;
    }
  }

  /**
   * Desencripta un mensaje de una conversación
   */
  async decryptMessage(
    conversationId: string,
    encryptedMessage: EncryptedMessage,
  ): Promise<DecryptedMessage> {
    try {
      // Verificar que el intercambio de claves esté completo
      const conversationKeys = await this.keyExchangeService.getConversationKeys(conversationId);
      if (!conversationKeys || conversationKeys.status !== 'completed') {
        throw new BadRequestException('Key exchange not completed for this conversation');
      }

      // Obtener las claves del remitente
      const senderKeys = conversationKeys.participantKeys[encryptedMessage.senderId];
      if (!senderKeys) {
        throw new NotFoundException('Sender keys not found');
      }

      // Verificar la firma
      const messageToVerify = `${conversationId}:${encryptedMessage.ciphertext}:${encryptedMessage.nonce}:${encryptedMessage.sequenceNumber}`;
      const verifiedMessage = this.cryptoService.verifySignature(
        encryptedMessage.signature,
        senderKeys.signingKey,
      );

      if (!verifiedMessage || verifiedMessage !== messageToVerify) {
        this.logger.warn(`Invalid signature for message from ${encryptedMessage.senderId}`);
        return {
          content: '',
          senderId: encryptedMessage.senderId,
          timestamp: encryptedMessage.timestamp,
          sequenceNumber: encryptedMessage.sequenceNumber,
          isValid: false,
        };
      }

      // Derivar la clave de mensaje
      if (!conversationKeys.sharedSecret) {
        throw new BadRequestException('Shared secret not available');
      }
      
      const messageKey = this.cryptoService.deriveMessageKey(
        conversationKeys.sharedSecret,
        encryptedMessage.sequenceNumber,
      );

      // Desencriptar el mensaje
      const decryptedContent = this.cryptoService.decryptMessage(
        encryptedMessage.ciphertext,
        messageKey,
        encryptedMessage.nonce,
      );

      this.logger.log(`Message decrypted for conversation ${conversationId}, sequence ${encryptedMessage.sequenceNumber}`);

      return {
        content: decryptedContent,
        senderId: encryptedMessage.senderId,
        timestamp: encryptedMessage.timestamp,
        sequenceNumber: encryptedMessage.sequenceNumber,
        isValid: true,
      };
    } catch (error) {
      this.logger.error('Error decrypting message', error);
      
      // Retornar mensaje inválido en caso de error
      return {
        content: '',
        senderId: encryptedMessage.senderId,
        timestamp: encryptedMessage.timestamp,
        sequenceNumber: encryptedMessage.sequenceNumber,
        isValid: false,
      };
    }
  }

  /**
   * Valida un mensaje encriptado DTO
   */
  async validateEncryptedMessage(
    conversationId: string,
    dto: EncryptedMessageDto,
    senderId: string,
  ): Promise<boolean> {
    try {
      // Verificar que el intercambio de claves esté completo
      const conversationKeys = await this.keyExchangeService.getConversationKeys(conversationId);
      if (!conversationKeys || conversationKeys.status !== 'completed') {
        return false;
      }

      // Obtener las claves del remitente
      const senderKeys = conversationKeys.participantKeys[senderId];
      if (!senderKeys) {
        return false;
      }

      // Verificar la firma
      const messageToVerify = `${dto.conversationId}:${dto.ciphertext}:${dto.nonce}:${dto.sequenceNumber}`;
      const verifiedMessage = this.cryptoService.verifySignature(dto.signature, senderKeys.signingKey);

      return verifiedMessage === messageToVerify;
    } catch (error) {
      this.logger.error('Error validating encrypted message', error);
      return false;
    }
  }

  /**
   * Genera claves para un usuario nuevo
   */
  async generateKeysForUser(userId: string): Promise<{
    publicKey: string;
    signingKey: string;
    privateKey: string;
    privateSigningKey: string;
  }> {
    return await this.keyExchangeService.generateUserKeys(userId);
  }

  /**
   * Obtiene el estado de encriptación de una conversación
   */
  async getEncryptionStatus(conversationId: string): Promise<{
    isEncrypted: boolean;
    keyExchangeStatus: 'pending' | 'completed' | 'failed';
    participantCount: number;
  }> {
    const status = await this.keyExchangeService.getKeyExchangeStatus(conversationId);
    
    return {
      isEncrypted: status.status === 'completed',
      keyExchangeStatus: status.status,
      participantCount: status.participantCount,
    };
  }
}