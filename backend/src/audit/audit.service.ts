import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { Case, CaseHistoryEntry, User } from '../entities';

const GENESIS_HASH = 'GENESIS';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(CaseHistoryEntry)
    private readonly history: Repository<CaseHistoryEntry>,
  ) {}

  /** Appends one field-change entry to the case's hash chain. */
  async record(params: {
    case: Case;
    actor: User;
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }): Promise<CaseHistoryEntry> {
    const last = await this.history.findOne({
      where: { case: { id: params.case.id } },
      order: { id: 'DESC' },
    });
    const prevHash = last?.hash ?? GENESIS_HASH;
    const ts = new Date();
    const hash = this.computeHash({
      prevHash,
      caseId: params.case.id,
      actorId: params.actor.id,
      field: params.field,
      oldValue: params.oldValue,
      newValue: params.newValue,
      ts: ts.toISOString(),
    });

    const entry = this.history.create({
      case: params.case,
      actor: params.actor,
      field: params.field,
      oldValue: params.oldValue,
      newValue: params.newValue,
      prevHash,
      hash,
      ts,
    });
    return this.history.save(entry);
  }

  findForCase(caseId: number): Promise<CaseHistoryEntry[]> {
    return this.history.find({
      where: { case: { id: caseId } },
      order: { id: 'ASC' },
      relations: ['actor'],
    });
  }

  /** Walks the chain and confirms no entry has been altered or removed. */
  async verifyChain(caseId: number): Promise<{ valid: boolean; brokenAtId?: number }> {
    const entries = await this.findForCase(caseId);
    let expectedPrevHash = GENESIS_HASH;
    for (const entry of entries) {
      if (entry.prevHash !== expectedPrevHash) {
        return { valid: false, brokenAtId: entry.id };
      }
      const recomputed = this.computeHash({
        prevHash: entry.prevHash,
        caseId,
        actorId: entry.actor.id,
        field: entry.field,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        ts: new Date(entry.ts).toISOString(),
      });
      if (recomputed !== entry.hash) {
        return { valid: false, brokenAtId: entry.id };
      }
      expectedPrevHash = entry.hash;
    }
    return { valid: true };
  }

  private computeHash(payload: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}
