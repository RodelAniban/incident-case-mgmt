import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { CasesService, RequestUser } from '../cases/cases.service';
import { decryptBuffer, encryptBuffer } from '../common/encryption.util';
import { CaseImage, User } from '../entities';
import { readCaseImageBlob, writeCaseImageBlob } from './case-image-storage.util';

export const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

@Injectable()
export class CaseImagesService {
  constructor(
    @InjectRepository(CaseImage) private readonly images: Repository<CaseImage>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly casesService: CasesService,
  ) {}

  async upload(caseId: number, file: Express.Multer.File, actor: RequestUser): Promise<CaseImage> {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported image type: ${file.mimetype}`);
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Image exceeds the 8MB limit');
    }

    // Enforces the same case-scope check as everything else — only someone
    // authorized to see (and, via the controller guard, edit) this case can attach
    // an image to it.
    const kase = await this.casesService.findOneScoped(caseId, actor);
    const actorEntity = await this.users.findOneOrFail({ where: { id: actor.userId } });

    const publicId = randomUUID();
    const { ciphertext, iv, authTag } = encryptBuffer(file.buffer);
    const storageRef = writeCaseImageBlob(kase.id, `${publicId}.bin`, ciphertext);

    return this.images.save(
      this.images.create({
        publicId,
        case: kase,
        uploadedBy: actorEntity,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageRef,
        encryptionIv: iv,
        encryptionAuthTag: authTag,
      }),
    );
  }

  async readRaw(publicId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const image = await this.images.findOne({ where: { publicId } });
    if (!image) {
      throw new NotFoundException('Image not found');
    }
    const ciphertext = readCaseImageBlob(image.storageRef);
    const buffer = decryptBuffer(ciphertext, image.encryptionIv, image.encryptionAuthTag);
    return { buffer, mimeType: image.mimeType };
  }
}
