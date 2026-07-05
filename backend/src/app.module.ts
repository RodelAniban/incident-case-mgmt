import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CaseImagesModule } from './case-images/case-images.module';
import { CasesModule } from './cases/cases.module';
import { ChatModule } from './chat/chat.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { EvidenceModule } from './evidence/evidence.module';
import { PirModule } from './pir/pir.module';
import { ThreatIntelModule } from './threat-intel/threat-intel.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    CasesModule,
    CaseImagesModule,
    AuditModule,
    DashboardModule,
    EvidenceModule,
    ChatModule,
    PirModule,
    ThreatIntelModule,
  ],
})
export class AppModule {}
