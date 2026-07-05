import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission, roleHasPermission } from '../common/permissions';
import { Case, CaseSeverity, CaseStatus } from '../entities';
import { RequestUser } from '../cases/cases.service';

const SLA_RISK_WINDOW_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(@InjectRepository(Case) private readonly cases: Repository<Case>) {}

  async summary(actor: RequestUser) {
    const scoped = roleHasPermission(actor.role, Permission.VIEW_ALL_CASES)
      ? this.cases.find()
      : this.cases.find({ where: { team: { id: actor.teamId ?? -1 } } });
    const cases = await scoped;

    const open = cases.filter((c) => c.status !== CaseStatus.CLOSED);
    const now = Date.now();
    const slaAtRisk = open.filter(
      (c) => c.slaDueAt && new Date(c.slaDueAt).getTime() - now <= SLA_RISK_WINDOW_MS,
    );

    const bySeverity: Record<CaseSeverity, number> = {
      [CaseSeverity.CRITICAL]: 0,
      [CaseSeverity.HIGH]: 0,
      [CaseSeverity.MEDIUM]: 0,
      [CaseSeverity.LOW]: 0,
    };
    for (const c of open) {
      bySeverity[c.severity] += 1;
    }

    const recent = cases
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);

    return {
      openCaseCount: open.length,
      slaAtRiskCount: slaAtRisk.length,
      bySeverity,
      recentCases: recent,
    };
  }
}
