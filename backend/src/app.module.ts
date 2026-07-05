import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminAuditModule } from './admin-audit/admin-audit.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CaseImagesModule } from './case-images/case-images.module';
import { NarrativeImageGcModule } from './case-images/narrative-image-gc.module';
import { CasesModule } from './cases/cases.module';
import { ChatModule } from './chat/chat.module';
import { AllowAllGuard } from './common/guards/allow-all.guard';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { EvidenceModule } from './evidence/evidence.module';
import { PirModule } from './pir/pir.module';
import { ThreatIntelModule } from './threat-intel/threat-intel.module';
import { UsersModule } from './users/users.module';

// Set (once, before any test file's module graph resolves) by test/env-setup.ts —
// see AllowAllGuard for why this can't be handled via @nestjs/testing's guard overrides.
const throttlerGuardClass = process.env.DISABLE_THROTTLING === 'true' ? AllowAllGuard : ThrottlerGuard;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global ceiling against scraping/abuse; individual routes (e.g. login)
    // override with a stricter limit via @Throttle().
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // Backs NarrativeImageGcService's nightly sweep (see case-images/narrative-image-gc.service.ts).
    ScheduleModule.forRoot(),
    DatabaseModule,
    AdminAuditModule,
    AuthModule,
    UsersModule,
    CasesModule,
    CaseImagesModule,
    NarrativeImageGcModule,
    AuditModule,
    DashboardModule,
    EvidenceModule,
    ChatModule,
    PirModule,
    ThreatIntelModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: throttlerGuardClass }],
})
export class AppModule {}
