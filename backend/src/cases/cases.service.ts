import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission, roleHasPermission } from '../common/permissions';
import { Role } from '../common/roles.enum';
import { Case, CaseSeverity, CaseStatus, Team, User } from '../entities';
import { AuditService } from '../audit/audit.service';
import { NarrativeImageGcService } from '../case-images/narrative-image-gc.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { htmlToExcerpt, sanitizeNarrativeHtml } from './sanitize-narrative.util';

export interface RequestUser {
  userId: number;
  email: string;
  role: Role;
  teamId: number | null;
}

const HIGH_SEVERITIES = new Set([CaseSeverity.CRITICAL, CaseSeverity.HIGH]);

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(
    @InjectRepository(Case) private readonly cases: Repository<Case>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly auditService: AuditService,
    private readonly narrativeImageGc: NarrativeImageGcService,
  ) {}

  async create(dto: CreateCaseDto, actor: RequestUser): Promise<Case> {
    const team = await this.teams.findOneOrFail({ where: { id: dto.teamId } });
    const assignee = dto.assigneeId
      ? await this.users.findOneOrFail({ where: { id: dto.assigneeId } })
      : null;

    const caseNumber = await this.nextCaseNumber();
    const created = await this.cases.save(
      this.cases.create({
        caseNumber,
        title: dto.title,
        description: dto.description ? sanitizeNarrativeHtml(dto.description) : '',
        severity: dto.severity,
        category: dto.category,
        status: CaseStatus.NEW,
        team,
        assignee,
      }),
    );

    const actorEntity = await this.users.findOneOrFail({ where: { id: actor.userId } });
    await this.auditService.record({
      case: created,
      actor: actorEntity,
      field: 'status',
      oldValue: null,
      newValue: CaseStatus.NEW,
    });

    return created;
  }

  /** Analysts (view_assigned_cases only) see their team's cases; Lead+ see everything. */
  async findAllScoped(actor: RequestUser): Promise<Case[]> {
    if (roleHasPermission(actor.role, Permission.VIEW_ALL_CASES)) {
      return this.cases.find({ order: { createdAt: 'DESC' } });
    }
    return this.cases.find({
      where: { team: { id: actor.teamId ?? -1 } },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneScoped(id: number, actor: RequestUser): Promise<Case> {
    const found = await this.cases.findOne({ where: { id } });
    if (!found) {
      throw new NotFoundException(`Case ${id} not found`);
    }
    const canViewAll = roleHasPermission(actor.role, Permission.VIEW_ALL_CASES);
    if (!canViewAll && found.team.id !== actor.teamId) {
      throw new ForbiddenException('Case is outside your team scope');
    }
    return found;
  }

  async update(id: number, dto: UpdateCaseDto, actor: RequestUser): Promise<Case> {
    const existing = await this.findOneScoped(id, actor);
    const actorEntity = await this.users.findOneOrFail({ where: { id: actor.userId } });

    if (dto.status === CaseStatus.CLOSED) {
      const isHighSeverity = HIGH_SEVERITIES.has(existing.severity);
      const requiredPermission = isHighSeverity
        ? Permission.CLOSE_HIGH_CRITICAL_CASE
        : Permission.CREATE_EDIT_CASE;
      if (!roleHasPermission(actor.role, requiredPermission)) {
        throw new ForbiddenException(
          `Role '${actor.role}' cannot close a ${existing.severity} severity case`,
        );
      }
    } else if (!roleHasPermission(actor.role, Permission.CREATE_EDIT_CASE)) {
      throw new ForbiddenException(`Role '${actor.role}' cannot edit cases`);
    }

    const trackedFields: Array<keyof UpdateCaseDto> = ['title', 'severity', 'category', 'status'];
    for (const field of trackedFields) {
      const nextValue = dto[field];
      if (nextValue === undefined) continue;
      const oldValue = String(existing[field as keyof Case] ?? '');
      if (oldValue === String(nextValue)) continue;
      await this.auditService.record({
        case: existing,
        actor: actorEntity,
        field,
        oldValue,
        newValue: String(nextValue),
      });
      (existing as any)[field] = nextValue;
    }

    // Handled separately from trackedFields: the audit entry logs a plain-text excerpt,
    // not the full HTML, so the hash chain doesn't bloat on every narrative edit.
    let descriptionChanged = false;
    if (dto.description !== undefined) {
      const sanitized = sanitizeNarrativeHtml(dto.description);
      if (sanitized !== existing.description) {
        await this.auditService.record({
          case: existing,
          actor: actorEntity,
          field: 'description',
          oldValue: htmlToExcerpt(existing.description || ''),
          newValue: htmlToExcerpt(sanitized),
        });
        existing.description = sanitized;
        descriptionChanged = true;
      }
    }

    if (dto.assigneeId !== undefined) {
      const assignee = await this.users.findOneOrFail({ where: { id: dto.assigneeId } });
      await this.auditService.record({
        case: existing,
        actor: actorEntity,
        field: 'assignee',
        oldValue: existing.assignee?.email ?? null,
        newValue: assignee.email,
      });
      existing.assignee = assignee;
    }

    const saved = await this.cases.save(existing);

    // Best-effort: an edit that drops an inline image from the narrative
    // shouldn't fail the save itself if cleanup hits a snag.
    if (descriptionChanged) {
      try {
        await this.narrativeImageGc.sweepCase(saved.id);
      } catch (err) {
        this.logger.warn(`Narrative image sweep failed for case ${saved.id}: ${err}`);
      }
    }

    return saved;
  }

  private async nextCaseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.cases.count();
    return `INC-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}
