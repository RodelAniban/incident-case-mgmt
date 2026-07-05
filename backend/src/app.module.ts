import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
    // Global ceiling against scraping/abuse; individual routes (e.g. login)
    // override with a stricter limit via @Throttle().
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
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
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
