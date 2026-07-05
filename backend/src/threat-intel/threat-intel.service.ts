import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CasesService, RequestUser } from '../cases/cases.service';
import { Permission, roleHasPermission } from '../common/permissions';
import { Role } from '../common/roles.enum';
import {
  CaseStatus,
  CaseThreatIndicator,
  ShareRequestStatus,
  ThreatIndicator,
  ThreatShareRequest,
  ThreatWatchlistMatch,
  Tlp,
  User,
} from '../entities';
import { CreateShareRequestDto } from './dto/create-share-request.dto';
import { DecideShareRequestDto } from './dto/decide-share-request.dto';
import { ImportIndicatorsDto } from './dto/import-indicators.dto';
import { LinkIndicatorDto } from './dto/link-indicator.dto';

// Only these TLP tiers may ever leave the organization. AMBER+STRICT and RED
// explicitly mean "not for external disclosure" — this isn't a UI nicety,
// requestShare() below refuses to even create a pending request otherwise.
const SHAREABLE_TLP = new Set([Tlp.CLEAR, Tlp.GREEN]);

@Injectable()
export class ThreatIntelService {
  constructor(
    @InjectRepository(ThreatIndicator) private readonly indicators: Repository<ThreatIndicator>,
    @InjectRepository(CaseThreatIndicator) private readonly caseLinks: Repository<CaseThreatIndicator>,
    @InjectRepository(ThreatWatchlistMatch) private readonly matches: Repository<ThreatWatchlistMatch>,
    @InjectRepository(ThreatShareRequest) private readonly shareRequests: Repository<ThreatShareRequest>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly casesService: CasesService,
    private readonly auditService: AuditService,
  ) {}

  async listIndicators(search: string | undefined): Promise<ThreatIndicator[]> {
    return this.indicators.find({
      where: search ? { value: Like(`%${search}%`) } : {},
      order: { lastSeenAt: 'DESC' },
      take: 100,
    });
  }

  /**
   * Upserts by (type, value) so re-imports refresh confidence/attribution on the
   * same row rather than duplicating it, then flags a watchlist match for any
   * case that already had this indicator linked before this import touched it.
   */
  async importIndicators(dto: ImportIndicatorsDto, actor: RequestUser): Promise<{ imported: number; matched: number }> {
    this.assertAdmin(actor);

    let matched = 0;
    for (const item of dto.indicators) {
      let indicator = await this.indicators.findOne({ where: { type: item.type, value: item.value } });
      const isNewIndicator = !indicator;

      if (indicator) {
        indicator.confidence = item.confidence ?? indicator.confidence;
        indicator.tlp = item.tlp ?? indicator.tlp;
        indicator.source = item.source;
        indicator.threatActor = item.threatActor ?? indicator.threatActor;
        indicator.campaign = item.campaign ?? indicator.campaign;
      } else {
        indicator = this.indicators.create({
          type: item.type,
          value: item.value,
          confidence: item.confidence ?? 50,
          tlp: item.tlp ?? Tlp.AMBER,
          source: item.source,
          threatActor: item.threatActor ?? null,
          campaign: item.campaign ?? null,
        });
      }
      indicator = await this.indicators.save(indicator);

      if (!isNewIndicator) {
        const links = await this.caseLinks.find({
          where: { threatIndicator: { id: indicator.id } },
          relations: ['case'],
        });
        for (const link of links) {
          await this.matches.save(this.matches.create({ threatIndicator: indicator, case: link.case }));
          matched += 1;
        }
      }
    }

    return { imported: dto.indicators.length, matched };
  }

  async linkToCase(caseId: number, dto: LinkIndicatorDto, actor: RequestUser): Promise<CaseThreatIndicator> {
    const kase = await this.casesService.findOneScoped(caseId, actor);
    const actorEntity = await this.users.findOneOrFail({ where: { id: actor.userId } });

    let indicator: ThreatIndicator;
    if (dto.indicatorId) {
      const found = await this.indicators.findOne({ where: { id: dto.indicatorId } });
      if (!found) {
        throw new NotFoundException(`Indicator ${dto.indicatorId} not found`);
      }
      indicator = found;
    } else if (dto.type && dto.value) {
      const existing = await this.indicators.findOne({ where: { type: dto.type, value: dto.value } });
      indicator =
        existing ??
        (await this.indicators.save(
          this.indicators.create({
            type: dto.type,
            value: dto.value,
            confidence: 50,
            tlp: dto.tlp ?? Tlp.AMBER,
            source: `Analyst-reported (${actorEntity.name})`,
          }),
        ));
    } else {
      throw new BadRequestException('Provide either indicatorId or a type + value to record a new indicator.');
    }

    const existingLink = await this.caseLinks.findOne({
      where: { case: { id: kase.id }, threatIndicator: { id: indicator.id } },
      relations: ['case', 'threatIndicator', 'linkedBy'],
    });
    if (existingLink) {
      return existingLink;
    }

    return this.caseLinks.save(
      this.caseLinks.create({ case: kase, threatIndicator: indicator, linkedBy: actorEntity, note: dto.note ?? null }),
    );
  }

  async getCaseIndicators(
    caseId: number,
    actor: RequestUser,
  ): Promise<{ links: CaseThreatIndicator[]; threatActors: string[]; campaigns: string[] }> {
    await this.casesService.findOneScoped(caseId, actor);
    const links = await this.caseLinks.find({
      where: { case: { id: caseId } },
      relations: ['threatIndicator', 'linkedBy'],
      order: { linkedAt: 'DESC' },
    });
    const threatActors = [...new Set(links.map((l) => l.threatIndicator.threatActor).filter((v): v is string => !!v))];
    const campaigns = [...new Set(links.map((l) => l.threatIndicator.campaign).filter((v): v is string => !!v))];
    return { links, threatActors, campaigns };
  }

  async listMatchesForCase(caseId: number, actor: RequestUser): Promise<ThreatWatchlistMatch[]> {
    await this.casesService.findOneScoped(caseId, actor);
    return this.matches.find({
      where: { case: { id: caseId } },
      relations: ['threatIndicator'],
      order: { matchedAt: 'DESC' },
    });
  }

  async acknowledgeMatch(matchId: number, actor: RequestUser): Promise<ThreatWatchlistMatch> {
    const match = await this.matches.findOne({ where: { id: matchId }, relations: ['case'] });
    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }
    await this.casesService.findOneScoped(match.case.id, actor);
    const actorEntity = await this.users.findOneOrFail({ where: { id: actor.userId } });

    match.acknowledged = true;
    match.acknowledgedBy = actorEntity;
    match.acknowledgedAt = new Date();
    return this.matches.save(match);
  }

  /** Confirmed IOCs from closed cases only, and never anything marked AMBER+STRICT or RED. */
  async requestShare(caseId: number, dto: CreateShareRequestDto, actor: RequestUser): Promise<ThreatShareRequest> {
    const kase = await this.casesService.findOneScoped(caseId, actor);
    if (kase.status !== CaseStatus.CLOSED) {
      throw new BadRequestException('Only indicators from a closed case can be proposed for outbound sharing.');
    }
    const link = await this.caseLinks.findOne({
      where: { case: { id: caseId }, threatIndicator: { id: dto.indicatorId } },
      relations: ['threatIndicator'],
    });
    if (!link) {
      throw new NotFoundException('That indicator is not linked to this case.');
    }
    if (!SHAREABLE_TLP.has(link.threatIndicator.tlp)) {
      throw new ForbiddenException(
        `Indicator is marked ${link.threatIndicator.tlp} — only TLP:CLEAR or TLP:GREEN indicators are eligible for outbound sharing.`,
      );
    }
    const actorEntity = await this.users.findOneOrFail({ where: { id: actor.userId } });

    return this.shareRequests.save(
      this.shareRequests.create({
        case: kase,
        threatIndicator: link.threatIndicator,
        requestedBy: actorEntity,
        status: ShareRequestStatus.PENDING,
      }),
    );
  }

  async listShareRequestsForCase(caseId: number, actor: RequestUser): Promise<ThreatShareRequest[]> {
    await this.casesService.findOneScoped(caseId, actor);
    return this.shareRequests.find({
      where: { case: { id: caseId } },
      relations: ['threatIndicator', 'requestedBy', 'decidedBy'],
      order: { requestedAt: 'DESC' },
    });
  }

  /** Cross-case queue — this is what a CISO actually works from, not a per-case view. */
  async listPendingShareRequests(actor: RequestUser): Promise<ThreatShareRequest[]> {
    const all = await this.shareRequests.find({
      where: { status: ShareRequestStatus.PENDING },
      relations: ['threatIndicator', 'requestedBy', 'case'],
      order: { requestedAt: 'ASC' },
    });
    if (roleHasPermission(actor.role, Permission.VIEW_ALL_CASES)) {
      return all;
    }
    return all.filter((r) => r.case.team?.id === actor.teamId);
  }

  async decideShareRequest(
    requestId: number,
    approve: boolean,
    dto: DecideShareRequestDto,
    actor: RequestUser,
  ): Promise<ThreatShareRequest> {
    const request = await this.shareRequests.findOne({
      where: { id: requestId },
      relations: ['case', 'threatIndicator'],
    });
    if (!request) {
      throw new NotFoundException(`Share request ${requestId} not found`);
    }
    if (request.status !== ShareRequestStatus.PENDING) {
      throw new BadRequestException('This request has already been decided.');
    }
    await this.casesService.findOneScoped(request.case.id, actor);
    const actorEntity = await this.users.findOneOrFail({ where: { id: actor.userId } });

    request.status = approve ? ShareRequestStatus.APPROVED : ShareRequestStatus.REJECTED;
    request.decidedBy = actorEntity;
    request.decidedAt = new Date();
    request.reason = dto.reason ?? null;
    const saved = await this.shareRequests.save(request);

    await this.auditService.record({
      case: request.case,
      actor: actorEntity,
      field: approve ? 'ti_share_approved' : 'ti_share_rejected',
      oldValue: null,
      newValue: `${request.threatIndicator.value} (${request.threatIndicator.tlp})`,
    });

    return saved;
  }

  private assertAdmin(actor: RequestUser): void {
    if (actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Only an Admin can import threat intelligence feeds.');
    }
  }
}
