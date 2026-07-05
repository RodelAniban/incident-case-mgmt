import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PirReport } from '../entities';
import { PirController } from './pir.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PirReport])],
  controllers: [PirController],
})
export class PirModule {}
