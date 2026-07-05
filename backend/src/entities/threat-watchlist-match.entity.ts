import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Case } from './case.entity';
import { ThreatIndicator } from './threat-indicator.entity';
import { User } from './user.entity';

/**
 * A feed import touched an indicator that's already linked to this case —
 * i.e. fresh intel arrived on something we'd already flagged. Created by
 * ThreatIntelService.importIndicators, surfaced case-side until acknowledged.
 */
@Entity('threat_watchlist_matches')
export class ThreatWatchlistMatch {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ThreatIndicator, { onDelete: 'CASCADE' })
  threatIndicator: ThreatIndicator;

  @ManyToOne(() => Case, { onDelete: 'CASCADE' })
  case: Case;

  @CreateDateColumn()
  matchedAt: Date;

  @Column({ default: false })
  acknowledged: boolean;

  @ManyToOne(() => User, { nullable: true })
  acknowledgedBy: User | null;

  @Column({ type: 'datetime', nullable: true })
  acknowledgedAt: Date | null;
}
