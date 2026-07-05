import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { RequestUser } from '../cases/cases.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/permissions';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { GrantAccessDto } from './dto/grant-access.dto';
import { EvidenceService } from './evidence.service';

// Scaffold limit — real disk images / memory dumps need chunked or streamed intake, not this endpoint.
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

@Controller('evidence')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post()
  @RequirePermissions(Permission.UPLOAD_EVIDENCE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateEvidenceDto,
    @Req() req: { user: RequestUser },
  ) {
    if (!file) {
      throw new BadRequestException('A file is required');
    }
    return this.evidenceService.upload({ ...dto, file, actor: req.user });
  }

  @Get('case/:caseId')
  @RequirePermissions(Permission.VIEW_EVIDENCE_METADATA)
  findForCase(@Param('caseId', ParseIntPipe) caseId: number, @Req() req: { user: RequestUser }) {
    return this.evidenceService.findForCase(caseId, req.user);
  }

  @Get(':id')
  @RequirePermissions(Permission.VIEW_EVIDENCE_METADATA)
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: { user: RequestUser }) {
    return this.evidenceService.findOneScoped(id, req.user);
  }

  @Get(':id/custody')
  @RequirePermissions(Permission.VIEW_EVIDENCE_METADATA)
  custody(@Param('id', ParseIntPipe) id: number, @Req() req: { user: RequestUser }) {
    return this.evidenceService.custodyLog(id, req.user);
  }

  @Get(':id/download')
  @RequirePermissions(Permission.DOWNLOAD_EVIDENCE)
  async download(
    @Param('id', ParseIntPipe) id: number,
    @Query('reason') reason: string,
    @Req() req: { user: RequestUser },
    @Res() res: Response,
  ) {
    const { buffer, item } = await this.evidenceService.download(id, reason, req.user);
    res.set({
      'Content-Type': item.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${item.originalFilename}"`,
      'Content-Length': String(buffer.length),
    });
    res.send(buffer);
  }

  @Get(':id/access')
  @RequirePermissions(Permission.DOWNLOAD_EVIDENCE)
  listGrants(@Param('id', ParseIntPipe) id: number, @Req() req: { user: RequestUser }) {
    return this.evidenceService.listGrants(id, req.user);
  }

  @Post(':id/access')
  @RequirePermissions(Permission.DOWNLOAD_EVIDENCE)
  grantAccess(@Param('id', ParseIntPipe) id: number, @Body() dto: GrantAccessDto, @Req() req: { user: RequestUser }) {
    return this.evidenceService.grantAccess(id, dto.email, dto.reason, req.user);
  }

  @Delete(':id/access/:userId')
  @RequirePermissions(Permission.DOWNLOAD_EVIDENCE)
  revokeAccess(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: { user: RequestUser },
  ) {
    return this.evidenceService.revokeAccess(id, userId, req.user);
  }
}
