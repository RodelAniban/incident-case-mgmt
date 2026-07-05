import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/permissions';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('cases/:caseId')
  @RequirePermissions(Permission.VIEW_AUDIT_LOG)
  findForCase(@Param('caseId', ParseIntPipe) caseId: number) {
    return this.auditService.findForCase(caseId);
  }

  @Get('cases/:caseId/verify')
  @RequirePermissions(Permission.VIEW_AUDIT_LOG)
  verifyChain(@Param('caseId', ParseIntPipe) caseId: number) {
    return this.auditService.verifyChain(caseId);
  }
}
