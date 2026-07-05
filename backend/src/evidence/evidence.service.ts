import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { CasesService, RequestUser } from '../cases/cases.service';
import { Permission, roleHasPermission } from '../common/permissions';
import { Role } from '../common/roles.enum';
import {
  CustodyAction,
  EvidenceAccessGrant,
  EvidenceCustodyEntry,
  EvidenceItem,
  EvidenceType,
  User,
} from '../entities';
import { decryptBuffer, encryptBuffer, sha256Hex } from '../common/encryption.util';
import { readWormBlob, writeWormBlob } from './evidence-storage.util';

/** Roles that always retain oversight access, independent of per-item grants. */
const LEADERSHIP_ROLES = [Role.IR_LEAD, Role.CISO_MANAGER, Role.ADMIN];

@Injectable()
export class EvidenceService {
  constructor(
    @InjectRepository(EvidenceItem) private readonly items: Repository<EvidenceItem>,
    @InjectRepository(EvidenceCustodyEntry) private readonly custody: Repository<EvidenceCustodyEntry>,
    @InjectRepository(EvidenceAccessGrant) private readonly grants: Repository<EvidenceAccessGrant>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly casesService: CasesService,
  ) {}

  async upload(params: {
    caseId: number;
    type: EvidenceType;
    source?: string;
    tags?: string;
    notes?: string;
    file: Express.Multer.File;
    actor: RequestUser;
  }): Promise<EvidenceItem> {
    const kase = await this.casesService.findOneScoped(params.caseId, params.actor);
    const actorEntity = await this.users.findOneOrFail({ where: { id: params.actor.userId } });

    const sha256 = sha256Hex(params.file.buffer);
    const { ciphertext, iv, authTag } = encryptBuffer(params.file.buffer);
    const storageRef = writeWormBlob(kase.id, `${randomUUID()}.bin`, ciphertext);

    const item = await this.items.save(
      this.items.create({
        case: kase,
        type: params.type,
        source: params.source ?? null,
        originalFilename: params.file.originalname,
        mimeType: params.file.mimetype ?? null,
        sizeBytes: params.file.size,
        sha256,
        storageRef,
        encryptionIv: iv,
        encryptionAuthTag: authTag,
        tags: params.tags ?? null,
        notes: params.notes ?? null,
        collectedBy: actorEntity,
      }),
    );

    await this.custody.save(
      this.custody.create({
        evidenceItem: item,
        actor: actorEntity,
        action: CustodyAction.UPLOADED,
        reason: null,
      }),
    );

    return item;
  }

  async findForCase(caseId: number, actor: RequestUser): Promise<EvidenceItem[]> {
    await this.casesService.findOneScoped(caseId, actor);
    return this.items.find({
      where: { case: { id: caseId } },
      relations: ['collectedBy'],
      order: { collectedAt: 'DESC' },
    });
  }

  async findOneScoped(id: number, actor: RequestUser): Promise<EvidenceItem> {
    const item = await this.items.findOne({ where: { id }, relations: ['case', 'collectedBy'] });
    if (!item) {
      throw new NotFoundException(`Evidence item ${id} not found`);
    }
    await this.casesService.findOneScoped(item.case.id, actor);
    return item;
  }

  async download(id: number, reason: string, actor: RequestUser): Promise<{ buffer: Buffer; item: EvidenceItem }> {
    if (!reason?.trim()) {
      throw new BadRequestException('A justification reason is required to download evidence');
    }
    const item = await this.findOneScoped(id, actor);
    if (!(await this.canDownload(item, actor))) {
      throw new ForbiddenException('You do not have access to this evidence item — ask an IR Lead to grant access');
    }

    const ciphertext = readWormBlob(item.storageRef);
    const plaintext = decryptBuffer(ciphertext, item.encryptionIv, item.encryptionAuthTag);
    if (sha256Hex(plaintext) !== item.sha256) {
      throw new InternalServerErrorException(
        'Integrity check failed: stored evidence hash does not match the original — possible tampering',
      );
    }

    const actorEntity = await this.users.findOneOrFail({ where: { id: actor.userId } });
    await this.custody.save(
      this.custody.create({ evidenceItem: item, actor: actorEntity, action: CustodyAction.DOWNLOADED, reason }),
    );

    return { buffer: plaintext, item };
  }

  async custodyLog(id: number, actor: RequestUser): Promise<EvidenceCustodyEntry[]> {
    await this.findOneScoped(id, actor);
    return this.custody.find({
      where: { evidenceItem: { id } },
      order: { id: 'ASC' },
      relations: ['actor'],
    });
  }

  async listGrants(evidenceId: number, actor: RequestUser): Promise<EvidenceAccessGrant[]> {
    this.assertCanManageGrants(actor);
    const item = await this.findOneScoped(evidenceId, actor);
    return this.grants.find({
      where: { evidenceItem: { id: item.id } },
      relations: ['user', 'grantedBy'],
      order: { grantedAt: 'DESC' },
    });
  }

  async grantAccess(evidenceId: number, email: string, reason: string | undefined, actor: RequestUser) {
    this.assertCanManageGrants(actor);
    const item = await this.findOneScoped(evidenceId, actor);
    const targetUser = await this.users.findOne({ where: { email } });
    if (!targetUser) {
      throw new NotFoundException(`No user with email ${email}`);
    }
    const actorEntity = await this.users.findOneOrFail({ where: { id: actor.userId } });

    const existing = await this.grants.findOne({
      where: { evidenceItem: { id: item.id }, user: { id: targetUser.id } },
    });
    if (existing) {
      return existing;
    }

    const grant = await this.grants.save(
      this.grants.create({ evidenceItem: item, user: targetUser, grantedBy: actorEntity, reason: reason ?? null }),
    );
    await this.custody.save(
      this.custody.create({
        evidenceItem: item,
        actor: actorEntity,
        action: CustodyAction.ACCESS_GRANTED,
        reason: reason ? `granted to ${targetUser.email}: ${reason}` : `granted to ${targetUser.email}`,
      }),
    );
    return grant;
  }

  async revokeAccess(evidenceId: number, targetUserId: number, actor: RequestUser): Promise<void> {
    this.assertCanManageGrants(actor);
    const item = await this.findOneScoped(evidenceId, actor);
    const grant = await this.grants.findOne({
      where: { evidenceItem: { id: item.id }, user: { id: targetUserId } },
      relations: ['user'],
    });
    if (!grant) {
      return;
    }
    const actorEntity = await this.users.findOneOrFail({ where: { id: actor.userId } });
    await this.grants.remove(grant);
    await this.custody.save(
      this.custody.create({
        evidenceItem: item,
        actor: actorEntity,
        action: CustodyAction.ACCESS_REVOKED,
        reason: `revoked for ${grant.user.email}`,
      }),
    );
  }

  /**
   * DOWNLOAD_EVIDENCE alone isn't enough — Analyst L2 holds that permission
   * generally but still needs a per-item grant unless they collected it
   * themselves. Leadership roles keep unconditional oversight access.
   */
  private async canDownload(item: EvidenceItem, actor: RequestUser): Promise<boolean> {
    if (!roleHasPermission(actor.role, Permission.DOWNLOAD_EVIDENCE)) {
      return false;
    }
    if (LEADERSHIP_ROLES.includes(actor.role)) {
      return true;
    }
    if (item.collectedBy.id === actor.userId) {
      return true;
    }
    const grant = await this.grants.findOne({
      where: { evidenceItem: { id: item.id }, user: { id: actor.userId } },
    });
    return !!grant;
  }

  private assertCanManageGrants(actor: RequestUser): void {
    if (!LEADERSHIP_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only an IR Lead, CISO/Manager, or Admin can manage evidence access grants');
    }
  }
}
