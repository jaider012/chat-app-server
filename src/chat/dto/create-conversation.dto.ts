import { IsNotEmpty, IsUUID } from "class-validator";

export class CreateConversationDto {
  @IsNotEmpty()
  @IsUUID()
  participantId: string;
}
