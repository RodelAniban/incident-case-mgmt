import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/permissions';
import { AdminAuditService } from './admin-audit.service';

// Same audience as the per-case audit log (Lead/CISO/Auditor/Admin) —
// oversight of admin actions is the same concern as oversight of case
// history, not a MANAGE_USERS-only concern (an Auditor has no reason to
// edit users, but every reason to see what an Admin has changed).
@Controller('admin-audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.VIEW_AUDIT_LOG)
export class AdminAuditController {
  constructor(private readonly adminAuditService: AdminAuditService) {}

  @Get()
  findAll() {
    return this.adminAuditService.findAll();
  }

  @Get('verify')
  verifyChain() {
    return this.adminAuditService.verifyChain();
  }
}
