import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/permissions';
import { RequestUser } from '../cases/cases.service';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @RequirePermissions(Permission.VIEW_ASSIGNED_CASES, Permission.VIEW_ALL_CASES)
  summary(@Req() req: { user: RequestUser }) {
    return this.dashboardService.summary(req.user);
  }
}
