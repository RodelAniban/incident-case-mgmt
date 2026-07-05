import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseHistoryEntry } from '../entities';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([CaseHistoryEntry])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
