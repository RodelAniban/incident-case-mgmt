import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Case } from './case.entity';
import { User } from './user.entity';

export const PIR_SECTION_KEYS = [
  'timelineNotes',
  'rootCause',
  'detectionGapAnalysis',
  'responseEffectiveness',
  'lessonsLearned',
] as const;

export type PirSectionKey = (typeof PIR_SECTION_KEYS)[number];
export type PirSections = Record<PirSectionKey, string>;

/**
 * ManyToOne, not OneToOne — a case can have several PirReport rows over time,
 * one per version. "Finalizing" freezes a row forever (see PirService); making
 * a change afterward creates a new row at version+1 rather than mutating the
 * finalized one. The "current" report for a case is just the highest version.
 */
@Entity('pir_reports')
export class PirReport {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Case, { onDelete: 'CASCADE' })
  case: Case;

  @Column()
  templateId: string;

  @Column({ type: 'text', default: '{}' })
  sectionsJson: string;

  @Column({ default: 1 })
  version: number;

  @ManyToOne(() => User)
  createdBy: User;

  @Column({ type: 'datetime', nullable: true })
  finalizedAt: Date | null;

  @ManyToOne(() => User, { nullable: true })
  finalizedBy: User | null;

  @CreateDateColumn()
  createdAt: Date;
}
