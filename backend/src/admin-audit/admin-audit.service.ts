import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { AdminAuditEntry, User } from '../entities';

const GENESIS_HASH = 'GENESIS';

@Injectable()
export class AdminAuditService {
  constructor(
    @InjectRepository(AdminAuditEntry)
    private readonly entries: Repository<AdminAuditEntry>,
  ) {}

  /** Appends one entry to the global (not per-case) hash chain. */
  async record(params: {
    actor: User | { id: number };
    targetUser?: User | { id: number } | null;
    action: string;
    details?: string | null;
  }): Promise<AdminAuditEntry> {
    const [last] = await this.entries.find({ order: { id: 'DESC' }, take: 1 });
    const prevHash = last?.hash ?? GENESIS_HASH;
    const ts = new Date();
    const targetUserId = params.targetUser?.id ?? null;
    const hash = this.computeHash({
      prevHash,
      actorId: params.actor.id,
      targetUserId,
      action: params.action,
      details: params.details ?? null,
      ts: ts.toISOString(),
    });

    const entry = this.entries.create({
      actor: params.actor as User,
      targetUser: (params.targetUser as User) ?? null,
      action: params.action,
      details: params.details ?? null,
      prevHash,
      hash,
      ts,
    });
    return this.entries.save(entry);
  }

  findAll(): Promise<AdminAuditEntry[]> {
    return this.entries.find({ order: { id: 'ASC' }, relations: ['actor', 'targetUser'] });
  }

  /** Walks the chain and confirms no entry has been altered or removed — mirrors AuditService.verifyChain. */
  async verifyChain(): Promise<{ valid: boolean; brokenAtId?: number }> {
    const entries = await this.findAll();
    let expectedPrevHash = GENESIS_HASH;
    for (const entry of entries) {
      if (entry.prevHash !== expectedPrevHash) {
        return { valid: false, brokenAtId: entry.id };
      }
      const recomputed = this.computeHash({
        prevHash: entry.prevHash,
        actorId: entry.actor.id,
        targetUserId: entry.targetUser?.id ?? null,
        action: entry.action,
        details: entry.details,
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
