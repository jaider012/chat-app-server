import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_keys')
export class UserKeys {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  userId: string;

  @OneToOne(() => User, user => user.id)
  @JoinColumn({ name: 'userId' })
  user: User;

  // Clave pública X25519 para intercambio de claves
  @Column({ type: 'text' })
  publicKey: string;

  // Clave de firma pública Ed25519
  @Column({ type: 'text' })
  signingKey: string;

  // Número de secuencia para el protocolo double-ratchet
  @Column({ type: 'integer', default: 0 })
  sequenceNumber: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}