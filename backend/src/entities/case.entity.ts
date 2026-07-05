import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Team } from './team.entity';
import { User } from './user.entity';

export enum CaseSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum CaseCategory {
  PHISHING = 'phishing',
  MALWARE = 'malware',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  DATA_EXFILTRATION = 'data_exfiltration',
  DENIAL_OF_SERVICE = 'denial_of_service',
  INSIDER_THREAT = 'insider_threat',
  OTHER = 'other',
}

export enum CaseStatus {
  NEW = 'new',
  TRIAGE = 'triage',
  CONTAINED = 'contained',
  ERADICATED = 'eradicated',
  RECOVERED = 'recovered',
  CLOSED = 'closed',
}

@Entity('cases')
export class Case {
  @PrimaryGeneratedColumn()
  id: number;

  /** Human-facing identifier, e.g. INC-2026-0417 */
  @Column({ unique: true })
  caseNumber: string;

  @Column()
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'varchar' })
  severity: CaseSeverity;

  @Column({ type: 'varchar' })
  category: CaseCategory;

  @Column({ type: 'varchar', default: CaseStatus.NEW })
  status: CaseStatus;

  @ManyToOne(() => User, { nullable: true, eager: true })
  assignee: User | null;

  @ManyToOne(() => Team, { eager: true })
  team: Team;

  @Column({ type: 'datetime', nullable: true })
  slaDueAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
