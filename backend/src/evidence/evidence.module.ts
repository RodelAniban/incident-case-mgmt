import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CasesModule } from '../cases/cases.module';
import { MfaRequiredGuard } from '../common/guards/mfa-required.guard';
import { EvidenceAccessGrant, EvidenceCustodyEntry, EvidenceItem, User } from '../entities';
import { UsersModule } from '../users/users.module';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EvidenceItem, EvidenceCustodyEntry, EvidenceAccessGrant, User]),
    CasesModule,
    UsersModule,
  ],
  controllers: [EvidenceController],
  providers: [EvidenceService, MfaRequiredGuard],
})
export class EvidenceModule {}
