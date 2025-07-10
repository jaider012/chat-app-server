import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoService } from './crypto.service';
import { KeyExchangeService } from './key-exchange.service';
import { MessageEncryptionService } from './message-encryption.service';
import { UserKeys } from './entities/user-keys.entity';
import { ConversationKeys } from './entities/conversation-keys.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserKeys, ConversationKeys])],
  providers: [CryptoService, KeyExchangeService, MessageEncryptionService],
  exports: [CryptoService, KeyExchangeService, MessageEncryptionService],
})
export class CryptoModule {}