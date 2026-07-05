import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Phase 5 (Threat Intelligence Integration) — schema reserved now, feed ingestion ships later. */
@Entity('threat_indicators')
export class ThreatIndicator {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: string;

  @Column()
  value: string;

  @Column({ type: 'float', default: 0 })
  confidence: number;

  @Column({ default: 'TLP:AMBER' })
  tlp: string;

  @Column()
  source: string;

  @CreateDateColumn()
  createdAt: Date;
}
