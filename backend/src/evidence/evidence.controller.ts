import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/permissions';

/** Phase 2 of the roadmap. Entity + permissions already exist; intake/custody endpoints land here. */
@Controller('evidence')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EvidenceController {
  @Get('status')
  @RequirePermissions(Permission.VIEW_EVIDENCE_METADATA)
  status() {
    return { module: 'evidence', phase: 2, status: 'not yet implemented' };
  }
}
