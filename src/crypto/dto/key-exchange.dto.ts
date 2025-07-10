import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class InitiateKeyExchangeDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  publicKey: string;

  @IsString()
  @IsNotEmpty()
  signingKey: string;

  @IsString()
  @IsNotEmpty()
  signature: string;
}

export class CompleteKeyExchangeDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  publicKey: string;

  @IsString()
  @IsNotEmpty()
  signingKey: string;

  @IsString()
  @IsNotEmpty()
  signature: string;
}

export class EncryptedMessageDto {
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
  sequenceNumber: string;

  @IsString()
  @IsNotEmpty()
  signature: string;
}
