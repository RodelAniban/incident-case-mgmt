import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { CasesModule } from '../cases/cases.module';
import { CaseThreatIndicator, ThreatIndicator, ThreatShareRequest, ThreatWatchlistMatch, User } from '../entities';
import { ThreatIntelController } from './threat-intel.controller';
import { ThreatIntelService } from './threat-intel.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ThreatIndicator, CaseThreatIndicator, ThreatWatchlistMatch, ThreatShareRequest, User]),
    CasesModule,
    AuditModule,
  ],
  controllers: [ThreatIntelController],
  providers: [ThreatIntelService],
})
export class ThreatIntelModule {}
