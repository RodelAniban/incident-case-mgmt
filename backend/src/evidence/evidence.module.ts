import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CasesModule } from '../cases/cases.module';
import { EvidenceAccessGrant, EvidenceCustodyEntry, EvidenceItem, User } from '../entities';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EvidenceItem, EvidenceCustodyEntry, EvidenceAccessGrant, User]),
    CasesModule,
  ],
  controllers: [EvidenceController],
  providers: [EvidenceService],
})
export class EvidenceModule {}
