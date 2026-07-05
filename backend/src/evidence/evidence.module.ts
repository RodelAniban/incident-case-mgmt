import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvidenceItem } from '../entities';
import { EvidenceController } from './evidence.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EvidenceItem])],
  controllers: [EvidenceController],
})
export class EvidenceModule {}
