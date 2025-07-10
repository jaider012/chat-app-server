import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Conversation } from "./entities/conversation.entity";
import { Message } from "./entities/message.entity";
import { User } from "../users/entities/user.entity";
import { MessageEncryptionService } from "../crypto/message-encryption.service";
import { CreateEncryptedMessageDto } from "./dto/encrypted-message.dto";

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private messageEncryptionService: MessageEncryptionService,
  ) {}

  async createOrGetConversation(
    userId: string,
    otherUserId: string,
  ): Promise<Conversation> {
    // Find existing conversation between these two users
    const existingConversation = await this.conversationRepository
      .createQueryBuilder("conversation")
      .innerJoin("conversation.participants", "participant1")
      .innerJoin("conversation.participants", "participant2")
      .where("participant1.id = :userId", { userId })
      .andWhere("participant2.id = :otherUserId", { otherUserId })
      .getOne();

    if (existingConversation) {
      return existingConversation;
    }

    // Create new conversation
    const user1 = await this.userRepository.findOne({ where: { id: userId } });
    const user2 = await this.userRepository.findOne({
      where: { id: otherUserId },
    });

    if (!user1 || !user2) {
      throw new Error("One or both users not found");
    }

    const conversation = this.conversationRepository.create({
      participants: [user1, user2],
    });

    return this.conversationRepository.save(conversation);
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    return this.conversationRepository
      .createQueryBuilder("conversation")
      .leftJoinAndSelect("conversation.participants", "participant")
      .leftJoinAndSelect("conversation.messages", "message")
      .innerJoin("conversation.participants", "userParticipant")
      .where("userParticipant.id = :userId", { userId })
      .orderBy("conversation.updatedAt", "DESC")
      .getMany();
  }

  async getConversationMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<Message[]> {
    const skip = (page - 1) * limit;

    return this.messageRepository.find({
      where: { conversationId },
      relations: ["sender"],
      order: { createdAt: "DESC" },
      skip,
      take: limit,
    });
  }

  async createMessage(
    senderId: string,
    conversationId: string,
    content: string,
  ): Promise<Message> {
    const message = this.messageRepository.create({
      senderId,
      conversationId,
      content,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Update conversation's updatedAt
    await this.conversationRepository.update(conversationId, {
      updatedAt: new Date(),
    });

    const foundMessage = await this.messageRepository.findOne({
      where: { id: savedMessage.id },
      relations: ["sender"],
    });

    if (!foundMessage) {
      throw new Error("Message not found");
    }

    return foundMessage;
  }

  async createEncryptedMessage(
    senderId: string,
    dto: CreateEncryptedMessageDto,
  ): Promise<Message> {
    // Validar el mensaje encriptado si está presente
    if (dto.isEncrypted && dto.ciphertext && dto.nonce && dto.signature) {
      const isValid = await this.messageEncryptionService.validateEncryptedMessage(
        dto.conversationId,
        {
          conversationId: dto.conversationId,
          ciphertext: dto.ciphertext,
          nonce: dto.nonce,
          sequenceNumber: dto.sequenceNumber.toString(),
          signature: dto.signature,
        },
        senderId,
      );

      if (!isValid) {
        throw new Error("Invalid encrypted message");
      }
    }

    const message = this.messageRepository.create({
      senderId,
      conversationId: dto.conversationId,
      content: dto.content || '',
      ciphertext: dto.ciphertext,
      nonce: dto.nonce,
      signature: dto.signature,
      sequenceNumber: dto.sequenceNumber,
      isEncrypted: dto.isEncrypted || false,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Update conversation's updatedAt
    await this.conversationRepository.update(dto.conversationId, {
      updatedAt: new Date(),
    });

    const foundMessage = await this.messageRepository.findOne({
      where: { id: savedMessage.id },
      relations: ["sender"],
    });

    if (!foundMessage) {
      throw new Error("Message not found");
    }

    return foundMessage;
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    return this.conversationRepository.findOne({
      where: { id },
      relations: ["participants"],
    });
  }

  async getEncryptionStatus(conversationId: string): Promise<{
    isEncrypted: boolean;
    keyExchangeStatus: 'pending' | 'completed' | 'failed';
    participantCount: number;
  }> {
    return await this.messageEncryptionService.getEncryptionStatus(conversationId);
  }
}
