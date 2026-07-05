import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Case } from './case.entity';
import { ThreatIndicator } from './threat-indicator.entity';
import { User } from './user.entity';

export enum ShareRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Outbound-sharing proposal for a confirmed IOC from a closed case. No actual
 * external push happens in this scaffold (there's no real sharing community
 * to push to) — approval is the complete, real, audited action; delivery is
 * a documented gap. See ThreatIntelService.requestShare for the TLP gate.
 */
@Entity('threat_share_requests')
export class ThreatShareRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ThreatIndicator, { onDelete: 'CASCADE' })
  threatIndicator: ThreatIndicator;

  @ManyToOne(() => Case, { onDelete: 'CASCADE' })
  case: Case;

  @ManyToOne(() => User)
  requestedBy: User;

  @CreateDateColumn()
  requestedAt: Date;

  @Column({ type: 'varchar', default: ShareRequestStatus.PENDING })
  status: ShareRequestStatus;

  @ManyToOne(() => User, { nullable: true })
  decidedBy: User | null;

  @Column({ type: 'datetime', nullable: true })
  decidedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;
}
