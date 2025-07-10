import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { Conversation } from "../../chat/entities/conversation.entity";

@Entity("conversation_keys")
export class ConversationKeys {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  @Index()
  conversationId: string;

  @OneToOne(() => Conversation, (conversation) => conversation.id)
  @JoinColumn({ name: "conversationId" })
  conversation: Conversation | null;

  // Estado del intercambio de claves
  @Column({ type: "varchar", length: 50, default: "pending" })
  status: "pending" | "completed" | "failed";

  // Claves públicas de los participantes
  @Column({ type: "json" })
  participantKeys: Record<
    string,
    {
      publicKey: string;
      signingKey: string;
      sequenceNumber: number;
    }
  >;

  // Secreto compartido derivado (guardado temporalmente para verificación)
  @Column({ type: "text", nullable: true })
  sharedSecret: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
