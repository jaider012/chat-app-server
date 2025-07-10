import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateEncryptedMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  ciphertext: string;

  @IsString()
  @IsNotEmpty()
  nonce: string;

  @IsString()
  @IsNotEmpty()
  signature: string;

  @IsNumber()
  sequenceNumber: number;

  // Contenido en texto plano para mensajes no encriptados
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isEncrypted?: boolean;
}

export class SendEncryptedMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  ciphertext?: string;

  @IsOptional()
  @IsString()
  nonce?: string;

  @IsOptional()
  @IsString()
  signature?: string;

  @IsOptional()
  @IsNumber()
  sequenceNumber?: number;

  @IsOptional()
  @IsBoolean()
  isEncrypted?: boolean;
}