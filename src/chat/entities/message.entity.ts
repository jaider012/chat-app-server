import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Conversation } from './conversation.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  // Campos para mensajes encriptados
  @Column({ type: 'text', nullable: true })
  ciphertext: string;

  @Column({ type: 'text', nullable: true })
  nonce: string;

  @Column({ type: 'text', nullable: true })
  signature: string;

  @Column({ type: 'integer', nullable: true })
  sequenceNumber: number;

  @Column({ type: 'boolean', default: false })
  isEncrypted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.messages)
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column()
  senderId: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages)
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @Column()
  conversationId: string;
}
