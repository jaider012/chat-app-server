import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserKeys } from './entities/user-keys.entity';
import { ConversationKeys } from './entities/conversation-keys.entity';
import { CryptoService } from './crypto.service';
import { InitiateKeyExchangeDto, CompleteKeyExchangeDto } from './dto/key-exchange.dto';

@Injectable()
export class KeyExchangeService {
  private readonly logger = new Logger(KeyExchangeService.name);

  constructor(
    @InjectRepository(UserKeys)
    private userKeysRepository: Repository<UserKeys>,
    @InjectRepository(ConversationKeys)
    private conversationKeysRepository: Repository<ConversationKeys>,
    private cryptoService: CryptoService,
  ) {}

  /**
   * Inicia el intercambio de claves para una conversación
   */
  async initiateKeyExchange(
    userId: string,
    dto: InitiateKeyExchangeDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Verificar que el usuario sea participante de la conversación
      // (esto se debería hacer en el servicio de chat)
      
      // Verificar la firma del mensaje
      const messageToVerify = `${dto.conversationId}:${dto.publicKey}:${dto.signingKey}`;
      const verifiedMessage = this.cryptoService.verifySignature(dto.signature, dto.signingKey);
      
      if (!verifiedMessage || verifiedMessage !== messageToVerify) {
        throw new BadRequestException('Invalid signature');
      }

      // Buscar o crear el registro de claves de la conversación
      let conversationKeys = await this.conversationKeysRepository.findOne({
        where: { conversationId: dto.conversationId },
      });

      if (!conversationKeys) {
        conversationKeys = this.conversationKeysRepository.create({
          conversationId: dto.conversationId,
          status: 'pending',
          participantKeys: {},
        });
      }

      // Guardar las claves del participante
      conversationKeys.participantKeys[userId] = {
        publicKey: dto.publicKey,
        signingKey: dto.signingKey,
        sequenceNumber: 0,
      };

      // Guardar las claves públicas del usuario si no existen
      const existingUserKeys = await this.cryptoService.getUserKeys(userId);
      if (!existingUserKeys) {
        await this.cryptoService.saveUserKeys(userId, dto.publicKey, dto.signingKey);
      }

      await this.conversationKeysRepository.save(conversationKeys);

      this.logger.log(`Key exchange initiated for conversation ${dto.conversationId} by user ${userId}`);
      
      return {
        success: true,
        message: 'Key exchange initiated successfully',
      };
    } catch (error) {
      this.logger.error('Error initiating key exchange', error);
      throw error;
    }
  }

  /**
   * Completa el intercambio de claves para una conversación
   */
  async completeKeyExchange(
    userId: string,
    dto: CompleteKeyExchangeDto,
  ): Promise<{ success: boolean; message: string; sharedSecret?: string }> {
    try {
      // Verificar la firma del mensaje
      const messageToVerify = `${dto.conversationId}:${dto.publicKey}:${dto.signingKey}`;
      const verifiedMessage = this.cryptoService.verifySignature(dto.signature, dto.signingKey);
      
      if (!verifiedMessage || verifiedMessage !== messageToVerify) {
        throw new BadRequestException('Invalid signature');
      }

      // Buscar el registro de claves de la conversación
      const conversationKeys = await this.conversationKeysRepository.findOne({
        where: { conversationId: dto.conversationId },
      });

      if (!conversationKeys) {
        throw new NotFoundException('Key exchange not initiated');
      }

      // Agregar las claves del segundo participante
      conversationKeys.participantKeys[userId] = {
        publicKey: dto.publicKey,
        signingKey: dto.signingKey,
        sequenceNumber: 0,
      };

      // Verificar que tenemos claves de ambos participantes
      const participantIds = Object.keys(conversationKeys.participantKeys);
      if (participantIds.length >= 2) {
        // Calcular el secreto compartido
        const [user1Id, user2Id] = participantIds;
        const user1Keys = conversationKeys.participantKeys[user1Id];
        const user2Keys = conversationKeys.participantKeys[user2Id];

        // Para testing, calculamos el secreto compartido en el servidor
        // En producción, esto debería hacerse solo en el cliente
        const sharedSecret = this.cryptoService.deriveSharedSecret(
          user1Keys.publicKey,
          user2Keys.publicKey,
        );

        conversationKeys.sharedSecret = sharedSecret;
        conversationKeys.status = 'completed';

        // Guardar las claves públicas del usuario si no existen
        const existingUserKeys = await this.cryptoService.getUserKeys(userId);
        if (!existingUserKeys) {
          await this.cryptoService.saveUserKeys(userId, dto.publicKey, dto.signingKey);
        }

        await this.conversationKeysRepository.save(conversationKeys);

        this.logger.log(`Key exchange completed for conversation ${dto.conversationId}`);
        
        return {
          success: true,
          message: 'Key exchange completed successfully',
          sharedSecret, // Solo para testing
        };
      } else {
        await this.conversationKeysRepository.save(conversationKeys);
        
        return {
          success: true,
          message: 'Key exchange in progress, waiting for other participant',
        };
      }
    } catch (error) {
      this.logger.error('Error completing key exchange', error);
      throw error;
    }
  }

  /**
   * Obtiene el estado del intercambio de claves para una conversación
   */
  async getKeyExchangeStatus(conversationId: string): Promise<{
    status: 'pending' | 'completed' | 'failed';
    participantCount: number;
    participants: string[];
  }> {
    const conversationKeys = await this.conversationKeysRepository.findOne({
      where: { conversationId },
    });

    if (!conversationKeys) {
      return {
        status: 'pending',
        participantCount: 0,
        participants: [],
      };
    }

    const participants = Object.keys(conversationKeys.participantKeys);
    
    return {
      status: conversationKeys.status,
      participantCount: participants.length,
      participants,
    };
  }

  /**
   * Obtiene las claves públicas de todos los participantes de una conversación
   */
  async getConversationKeys(conversationId: string): Promise<ConversationKeys | null> {
    return await this.conversationKeysRepository.findOne({
      where: { conversationId },
    });
  }

  /**
   * Actualiza el número de secuencia de un participante en una conversación
   */
  async updateParticipantSequence(
    conversationId: string,
    userId: string,
    sequenceNumber: number,
  ): Promise<void> {
    const conversationKeys = await this.conversationKeysRepository.findOne({
      where: { conversationId },
    });

    if (!conversationKeys || !conversationKeys.participantKeys[userId]) {
      throw new NotFoundException('Conversation keys not found');
    }

    conversationKeys.participantKeys[userId].sequenceNumber = sequenceNumber;
    await this.conversationKeysRepository.save(conversationKeys);
  }

  /**
   * Genera un nuevo par de claves para un usuario
   */
  async generateUserKeys(userId: string): Promise<{
    publicKey: string;
    signingKey: string;
    privateKey: string;
    privateSigningKey: string;
  }> {
    const keyPair = this.cryptoService.generateKeyPair();
    const signingKeyPair = this.cryptoService.generateSigningKeyPair();

    // Guardar las claves públicas en la base de datos
    await this.cryptoService.saveUserKeys(userId, keyPair.publicKey, signingKeyPair.publicKey);

    return {
      publicKey: keyPair.publicKey,
      signingKey: signingKeyPair.publicKey,
      privateKey: keyPair.secretKey,
      privateSigningKey: signingKeyPair.secretKey,
    };
  }
}