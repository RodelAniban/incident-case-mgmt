import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CasesService, RequestUser } from '../cases/cases.service';
import { sanitizeNarrativeHtml } from '../cases/sanitize-narrative.util';
import { EvidenceItem, PirActionItem, PirReport, PirSectionKey, PirSections, User } from '../entities';
import { CreateActionDto } from './dto/create-action.dto';
import { CreatePirDto } from './dto/create-pir.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { UpdatePirDto } from './dto/update-pir.dto';

const EMPTY_SECTIONS: PirSections = {
  timelineNotes: '',
  rootCause: '',
  detectionGapAnalysis: '',
  responseEffectiveness: '',
  lessonsLearned: '',
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface PirReportView extends Omit<PirReport, 'sectionsJson'> {
  sections: PirSections;
}

@Injectable()
export class PirService {
  constructor(
    @InjectRepository(PirReport) private readonly reports: Repository<PirReport>,
    @InjectRepository(PirActionItem) private readonly actions: Repository<PirActionItem>,
    @InjectRepository(EvidenceItem) private readonly evidenceItems: Repository<EvidenceItem>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly casesService: CasesService,
    private readonly auditService: AuditService,
  ) {}

  private toView(report: PirReport): PirReportView {
    const { sectionsJson, ...rest } = report;
    let sections: PirSections;
    try {
      sections = { ...EMPTY_SECTIONS, ...JSON.parse(sectionsJson) };
    } catch {
      sections = EMPTY_SECTIONS;
    }
    return { ...rest, sections };
  }

  async getCurrentForCase(caseId: number, actor: RequestUser): Promise<PirReportView | null> {
    await this.casesService.findOneScoped(caseId, actor);
    const latest = await this.reports.findOne({
      where: { case: { id: caseId } },
      order: { version: 'DESC' },
      relations: ['createdBy', 'finalizedBy'],
    });
    return latest ? this.toView(latest) : null;
  }

  async getVersions(caseId: number, actor: RequestUser): Promise<PirReportView[]> {
    await this.casesService.findOneScoped(caseId, actor);
    const versions = await this.reports.find({
      where: { case: { id: caseId } },
      order: { version: 'ASC' },
      relations: ['createdBy', 'finalizedBy'],
    });
    return versions.map((v) => this.toView(v));
  }

  async create(caseId: number, dto: CreatePirDto, actor: RequestUser): Promise<PirReportView> {
    const kase = await this.casesService.findOneScoped(caseId, actor);
    const existing = await this.reports.findOne({ where: { case: { id: caseId } }, order: { version: 'DESC' } });
    if (existing && !existing.finalizedAt) {
      return this.toView(existing);
    }
    if (existing?.finalizedAt) {
      throw new ConflictException('A finalized PIR already exists for this case — start a new version instead.');
    }

    const actorEntity = await this.users.findOneOrFail({ where: { id: actor.userId } });
    const sections: PirSections = { ...EMPTY_SECTIONS, timelineNotes: await this.buildAutoTimelineHtml(caseId) };

    const saved = await this.reports.save(
      this.reports.create({
        case: kase,
        templateId: dto.templateId,
        sectionsJson: JSON.stringify(sections),
        version: 1,
        createdBy: actorEntity,
      }),
    );
    return this.toView(saved);
  }

  async update(reportId: number, dto: UpdatePirDto, actor: RequestUser): Promise<PirReportView> {
    const report = await this.loadScoped(reportId, actor);
    if (report.finalizedAt) {
      throw new ForbiddenException('Finalized reports are immutable — start a new version to make further edits.');
    }

    const current = this.toView(report).sections;
    const next: PirSections = { ...current };
    (Object.keys(dto) as PirSectionKey[]).forEach((key) => {
      const value = dto[key];
      if (value !== undefined) {
        next[key] = sanitizeNarrativeHtml(value);
      }
    });

    report.sectionsJson = JSON.stringify(next);
    return this.toView(await this.reports.save(report));
  }

  async finalize(reportId: number, actor: RequestUser): Promise<PirReportView> {
    const report = await this.loadScoped(reportId, actor);
    if (report.finalizedAt) {
      throw new ConflictException('This report is already finalized.');
    }
    const actorEntity = await this.users.findOneOrFail({ where: { id: actor.userId } });

    report.finalizedAt = new Date();
    report.finalizedBy = actorEntity;
    const saved = await this.reports.save(report);

    await this.auditService.record({
      case: report.case,
      actor: actorEntity,
      field: 'pir_finalized',
      oldValue: null,
      newValue: `v${report.version}`,
    });

    return this.toView(saved);
  }

  async startNewVersion(caseId: number, actor: RequestUser): Promise<PirReportView> {
    const kase = await this.casesService.findOneScoped(caseId, actor);
    const latest = await this.reports.findOne({ where: { case: { id: caseId } }, order: { version: 'DESC' } });
    if (!latest || !latest.finalizedAt) {
      throw new ConflictException('There is no finalized report to version from.');
    }
    const actorEntity = await this.users.findOneOrFail({ where: { id: actor.userId } });

    const saved = await this.reports.save(
      this.reports.create({
        case: kase,
        templateId: latest.templateId,
        sectionsJson: latest.sectionsJson,
        version: latest.version + 1,
        createdBy: actorEntity,
      }),
    );
    return this.toView(saved);
  }

  // Action items remain editable even after the report is finalized — remediation
  // tracking continues after sign-off; only the narrative sections freeze.
  async listActions(reportId: number, actor: RequestUser): Promise<PirActionItem[]> {
    await this.loadScoped(reportId, actor);
    return this.actions.find({ where: { pirReport: { id: reportId } }, order: { createdAt: 'ASC' } });
  }

  async addAction(reportId: number, dto: CreateActionDto, actor: RequestUser): Promise<PirActionItem> {
    const report = await this.loadScoped(reportId, actor);
    return this.actions.save(
      this.actions.create({
        pirReport: report,
        description: dto.description,
        owner: dto.owner ?? null,
        dueDate: dto.dueDate ?? null,
      }),
    );
  }

  async updateAction(actionId: number, dto: UpdateActionDto, actor: RequestUser): Promise<PirActionItem> {
    const action = await this.actions.findOne({ where: { id: actionId }, relations: ['pirReport', 'pirReport.case'] });
    if (!action) {
      throw new NotFoundException(`Action item ${actionId} not found`);
    }
    await this.casesService.findOneScoped(action.pirReport.case.id, actor);

    Object.assign(action, dto);
    return this.actions.save(action);
  }

  async deleteAction(actionId: number, actor: RequestUser): Promise<void> {
    const action = await this.actions.findOne({ where: { id: actionId }, relations: ['pirReport', 'pirReport.case'] });
    if (!action) {
      return;
    }
    await this.casesService.findOneScoped(action.pirReport.case.id, actor);
    await this.actions.remove(action);
  }

  private async loadScoped(reportId: number, actor: RequestUser): Promise<PirReport> {
    const report = await this.reports.findOne({ where: { id: reportId }, relations: ['case'] });
    if (!report) {
      throw new NotFoundException(`PIR report ${reportId} not found`);
    }
    await this.casesService.findOneScoped(report.case.id, actor);
    return report;
  }

  /** One-time seed at creation — not continuously re-synced, so it won't clobber edits. */
  private async buildAutoTimelineHtml(caseId: number): Promise<string> {
    const history = await this.auditService.findForCase(caseId);
    const evidence = await this.evidenceItems.find({
      where: { case: { id: caseId } },
      relations: ['collectedBy'],
    });

    const events = [
      ...history.map((h) => ({
        ts: new Date(h.ts),
        label: `${h.actor.name} changed ${h.field} from "${h.oldValue ?? '—'}" to "${h.newValue ?? '—'}"`,
      })),
      ...evidence.map((e) => ({
        ts: new Date(e.collectedAt),
        label: `${e.collectedBy.name} collected evidence: ${e.originalFilename}`,
      })),
    ].sort((a, b) => a.ts.getTime() - b.ts.getTime());

    if (events.length === 0) {
      return '<p>No case history or evidence recorded yet — fill in the timeline manually.</p>';
    }

    const items = events.map((e) => `<li>${escapeHtml(e.ts.toISOString())} — ${escapeHtml(e.label)}</li>`).join('');
    return sanitizeNarrativeHtml(`<ul>${items}</ul>`);
  }
}
