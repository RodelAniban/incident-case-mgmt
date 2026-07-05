import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { NarrativeImageGcModule } from '../case-images/narrative-image-gc.module';
import { Case, Team, User } from '../entities';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';

@Module({
  imports: [TypeOrmModule.forFeature([Case, Team, User]), AuditModule, NarrativeImageGcModule],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
