import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Case } from './case.entity';
import { ThreatIndicator } from './threat-indicator.entity';
import { User } from './user.entity';

/** Analyst-asserted link between a case and an IOC observed in it. */
@Entity('case_threat_indicators')
@Unique(['case', 'threatIndicator'])
export class CaseThreatIndicator {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Case, { onDelete: 'CASCADE' })
  case: Case;

  @ManyToOne(() => ThreatIndicator, { onDelete: 'CASCADE' })
  threatIndicator: ThreatIndicator;

  @ManyToOne(() => User)
  linkedBy: User;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  linkedAt: Date;
}
