import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Message } from "./message.entity";

@Entity("conversations")
export class Conversation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToMany(() => User, (user) => user.conversations)
  @JoinTable({
    name: "conversation_participants",
    joinColumn: { name: "conversationId", referencedColumnName: "id" },
    inverseJoinColumn: { name: "userId", referencedColumnName: "id" },
  })
  participants: User[];

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];
}
