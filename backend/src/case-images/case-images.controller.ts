import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
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
import { CaseImagesService, MAX_IMAGE_BYTES } from './case-images.service';
import { NarrativeImageGcService } from './narrative-image-gc.service';

@Controller()
export class CaseImagesController {
  constructor(
    private readonly caseImagesService: CaseImagesService,
    private readonly narrativeImageGcService: NarrativeImageGcService,
  ) {}

  @Post('cases/:caseId/images')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CREATE_EDIT_CASE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES } }))
  async upload(
    @Param('caseId', ParseIntPipe) caseId: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: RequestUser },
  ) {
    if (!file) {
      throw new BadRequestException('A file is required');
    }
    const image = await this.caseImagesService.upload(caseId, file, req.user);
    return { publicId: image.publicId, mimeType: image.mimeType, sizeBytes: image.sizeBytes };
  }

  /**
   * Deliberately unauthenticated — a plain <img src> tag can't send an
   * Authorization header. Access control instead relies on publicId being an
   * unguessable UUID, only ever handed out (by `upload` above) to users already
   * authorized to edit the case. Weaker than the evidence access-grant model,
   * which is the appropriate trade-off: these are illustrative narrative images,
   * not forensic evidence.
   */
  @Get('case-images/:publicId/raw')
  async raw(@Param('publicId') publicId: string, @Res() res: Response) {
    const { buffer, mimeType } = await this.caseImagesService.readRaw(publicId);
    res.set({
      'Content-Type': mimeType,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Length': String(buffer.length),
    });
    res.send(buffer);
  }

  /**
   * Manual trigger for the same sweep NarrativeImageGcService otherwise runs
   * automatically (after every narrative/PIR save, and nightly across every
   * case) — lets an admin confirm cleanup is actually working, or reclaim
   * storage on demand, without waiting for the 2am cron.
   */
  @Post('case-images/gc')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_USERS)
  runGc() {
    return this.narrativeImageGcService.sweepAllCases();
  }
}
