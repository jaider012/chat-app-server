import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  content: string;
}
