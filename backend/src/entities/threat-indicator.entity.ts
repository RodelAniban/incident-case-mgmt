import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum IndicatorType {
  IP = 'ip',
  DOMAIN = 'domain',
  URL = 'url',
  FILE_HASH = 'file_hash',
  EMAIL = 'email',
  OTHER = 'other',
}

// TLP 2.0. AMBER_STRICT and RED are never eligible for outbound sharing —
// see ThreatIntelService.requestShare.
export enum Tlp {
  CLEAR = 'TLP:CLEAR',
  GREEN = 'TLP:GREEN',
  AMBER = 'TLP:AMBER',
  AMBER_STRICT = 'TLP:AMBER+STRICT',
  RED = 'TLP:RED',
}

/**
 * Normalized IOC store. Upserted by (type, value) on every feed import — the
 * same row persists across re-imports so existing case links keep pointing at
 * live, corroborated data instead of duplicating entries. `threatActor` /
 * `campaign` back the plan's "attribution linking" — a case's associated
 * actors are just the distinct values across its linked indicators, not a
 * separately stored field.
 */
@Entity('threat_indicators')
export class ThreatIndicator {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  type: IndicatorType;

  @Column()
  value: string;

  @Column({ type: 'float', default: 0 })
  confidence: number;

  @Column({ type: 'varchar', default: Tlp.AMBER })
  tlp: Tlp;

  @Column()
  source: string;

  @Column({ type: 'varchar', nullable: true })
  threatActor: string | null;

  @Column({ type: 'varchar', nullable: true })
  campaign: string | null;

  @CreateDateColumn()
  firstSeenAt: Date;

  @UpdateDateColumn()
  lastSeenAt: Date;
}
