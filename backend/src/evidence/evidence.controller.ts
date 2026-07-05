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
import { randomUUID } from 'crypto';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { rm } from 'fs/promises';
import { diskStorage } from 'multer';
import { tmpdir } from 'os';
import { RequestUser } from '../cases/cases.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MfaRequiredGuard } from '../common/guards/mfa-required.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/permissions';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { GrantAccessDto } from './dto/grant-access.dto';
import { EvidenceService } from './evidence.service';

// Evidence can legitimately be a multi-GB disk image or memory dump, so
// intake streams straight to a temp file on disk (multer diskStorage)
// instead of buffering the whole upload in memory — this limit is an
// operational cap, not a memory-safety one.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024;

@Controller('evidence')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post()
  @RequirePermissions(Permission.UPLOAD_EVIDENCE)
  @UseGuards(MfaRequiredGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      // diskStorage streams the incoming upload straight to a temp file as
      // it arrives, rather than accumulating it in memory the way
      // memoryStorage does — EvidenceService.upload() re-streams that temp
      // file through encryption into its final WORM location and deletes it.
      storage: diskStorage({
        destination: tmpdir(),
        filename: (_req, _file, cb) => cb(null, `evidence-upload-${randomUUID()}`),
      }),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
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
  @UseGuards(MfaRequiredGuard)
  async download(
    @Param('id', ParseIntPipe) id: number,
    @Query('reason') reason: string,
    @Req() req: { user: RequestUser },
    @Res() res: Response,
  ) {
    // By the time this resolves, evidenceService.download() has already
    // decrypted to a temp file and confirmed the SHA-256 matches — nothing
    // is streamed to the client until integrity is proven, preserving the
    // existing fail-closed guarantee even though this is no longer one Buffer.
    const { tempFilePath, item } = await this.evidenceService.download(id, reason, req.user);
    res.set({
      'Content-Type': item.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${item.originalFilename}"`,
      'Content-Length': String(item.sizeBytes),
    });
    const cleanup = () => {
      rm(tempFilePath, { force: true }).catch(() => {});
    };
    const stream = createReadStream(tempFilePath);
    stream.on('error', cleanup);
    // 'finish' — not just 'close' — because 'close' tracks the underlying
    // TCP connection, which HTTP keep-alive can leave open well past this
    // response completing; 'finish' fires as soon as the response itself
    // has been fully written, which is the actual "safe to delete" moment.
    // 'close' stays too, for the early-disconnect case where the client
    // aborts mid-stream and 'finish' never fires at all.
    res.on('finish', cleanup);
    res.on('close', cleanup);
    stream.pipe(res);
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
