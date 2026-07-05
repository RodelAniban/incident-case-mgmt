import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { NarrativeImageGcModule } from '../case-images/narrative-image-gc.module';
import { CasesModule } from '../cases/cases.module';
import { EvidenceItem, PirActionItem, PirReport, User } from '../entities';
import { PirController } from './pir.controller';
import { PirService } from './pir.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PirReport, PirActionItem, EvidenceItem, User]),
    CasesModule,
    AuditModule,
    NarrativeImageGcModule,
  ],
  controllers: [PirController],
  providers: [PirService],
})
export class PirModule {}
