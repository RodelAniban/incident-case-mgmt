import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { RequestUser } from '../cases/cases.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/permissions';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('cases/:caseId/messages')
  @RequirePermissions(Permission.CHAT_ON_CASE)
  findForCase(@Param('caseId', ParseIntPipe) caseId: number, @Req() req: { user: RequestUser }) {
    return this.chatService.findForCase(caseId, req.user);
  }

  @Post('cases/:caseId/messages')
  @RequirePermissions(Permission.CHAT_ON_CASE)
  postMessage(
    @Param('caseId', ParseIntPipe) caseId: number,
    @Body() dto: CreateMessageDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.chatService.postMessage(caseId, dto, req.user);
  }

  /**
   * Separate permission from CHAT_ON_CASE on purpose — per the RBAC matrix, CISO/
   * Admin can't casually browse a live case chat, but can pull an audited export.
   */
  @Get('cases/:caseId/export')
  @RequirePermissions(Permission.EXPORT_CHAT_NOTES)
  async exportTranscript(
    @Param('caseId', ParseIntPipe) caseId: number,
    @Req() req: { user: RequestUser },
    @Res() res: Response,
  ) {
    const transcript = await this.chatService.exportTranscript(caseId, req.user);
    res.set({
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="case-${caseId}-chat-export.txt"`,
    });
    res.send(transcript);
  }
}
