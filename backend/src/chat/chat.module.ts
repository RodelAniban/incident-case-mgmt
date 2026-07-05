import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessage } from '../entities';
import { ChatController } from './chat.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessage])],
  controllers: [ChatController],
})
export class ChatModule {}
