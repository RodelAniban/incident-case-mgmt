import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/permissions';

/** Phase 4 of the roadmap. Entity + permissions already exist; template library lands here. */
@Controller('pir')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PirController {
  @Get('status')
  @RequirePermissions(Permission.FINALIZE_PIR)
  status() {
    return { module: 'pir', phase: 4, status: 'not yet implemented' };
  }
}
