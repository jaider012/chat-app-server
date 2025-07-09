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

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

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
}
