import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

/** Phase 5 of the roadmap. Entity already exists; STIX/TAXII ingestion and watchlist matching land here. */
@Controller('threat-intel')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ThreatIntelController {
  @Get('status')
  status() {
    return { module: 'threat-intel', phase: 5, status: 'not yet implemented' };
  }
}
