import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/permissions';

/** Phase 3 of the roadmap. Entity + permissions already exist; realtime delivery lands here. */
@Controller('chat')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChatController {
  @Get('status')
  @RequirePermissions(Permission.CHAT_ON_CASE)
  status() {
    return { module: 'chat', phase: 3, status: 'not yet implemented' };
  }
}
