import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RequestUser } from '../cases/cases.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/permissions';
import { CreateShareRequestDto } from './dto/create-share-request.dto';
import { DecideShareRequestDto } from './dto/decide-share-request.dto';
import { ImportIndicatorsDto } from './dto/import-indicators.dto';
import { LinkIndicatorDto } from './dto/link-indicator.dto';
import { ThreatIntelService } from './threat-intel.service';

@Controller('threat-intel')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ThreatIntelController {
  constructor(private readonly threatIntelService: ThreatIntelService) {}

  @Get('indicators')
  listIndicators(@Query('search') search: string | undefined) {
    return this.threatIntelService.listIndicators(search);
  }

  /** Admin-only — enforced in the service, not via a matrix permission (feed config is a platform task). */
  @Post('import')
  importIndicators(@Body() dto: ImportIndicatorsDto, @Req() req: { user: RequestUser }) {
    return this.threatIntelService.importIndicators(dto, req.user);
  }

  @Get('cases/:caseId/indicators')
  @RequirePermissions(Permission.VIEW_ASSIGNED_CASES, Permission.VIEW_ALL_CASES)
  getCaseIndicators(@Param('caseId', ParseIntPipe) caseId: number, @Req() req: { user: RequestUser }) {
    return this.threatIntelService.getCaseIndicators(caseId, req.user);
  }

  @Post('cases/:caseId/indicators')
  @RequirePermissions(Permission.CREATE_EDIT_CASE)
  linkIndicator(
    @Param('caseId', ParseIntPipe) caseId: number,
    @Body() dto: LinkIndicatorDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.threatIntelService.linkToCase(caseId, dto, req.user);
  }

  @Get('cases/:caseId/matches')
  @RequirePermissions(Permission.VIEW_ASSIGNED_CASES, Permission.VIEW_ALL_CASES)
  listMatchesForCase(@Param('caseId', ParseIntPipe) caseId: number, @Req() req: { user: RequestUser }) {
    return this.threatIntelService.listMatchesForCase(caseId, req.user);
  }

  @Post('matches/:id/acknowledge')
  @RequirePermissions(Permission.CREATE_EDIT_CASE)
  acknowledgeMatch(@Param('id', ParseIntPipe) id: number, @Req() req: { user: RequestUser }) {
    return this.threatIntelService.acknowledgeMatch(id, req.user);
  }

  @Get('cases/:caseId/share-requests')
  @RequirePermissions(Permission.VIEW_ASSIGNED_CASES, Permission.VIEW_ALL_CASES)
  listShareRequestsForCase(@Param('caseId', ParseIntPipe) caseId: number, @Req() req: { user: RequestUser }) {
    return this.threatIntelService.listShareRequestsForCase(caseId, req.user);
  }

  @Post('cases/:caseId/share-requests')
  @RequirePermissions(Permission.CREATE_EDIT_CASE)
  requestShare(
    @Param('caseId', ParseIntPipe) caseId: number,
    @Body() dto: CreateShareRequestDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.threatIntelService.requestShare(caseId, dto, req.user);
  }

  /** The CISO's approval queue — cross-case, not nested under a single case. */
  @Get('share-requests/pending')
  @RequirePermissions(Permission.APPROVE_TI_SHARING)
  listPending(@Req() req: { user: RequestUser }) {
    return this.threatIntelService.listPendingShareRequests(req.user);
  }

  @Post('share-requests/:id/approve')
  @RequirePermissions(Permission.APPROVE_TI_SHARING)
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecideShareRequestDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.threatIntelService.decideShareRequest(id, true, dto, req.user);
  }

  @Post('share-requests/:id/reject')
  @RequirePermissions(Permission.APPROVE_TI_SHARING)
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecideShareRequestDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.threatIntelService.decideShareRequest(id, false, dto, req.user);
  }
}
