import { Exclude } from 'class-transformer';
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PirReport } from './pir-report.entity';

/**
 * Remediation action item tracked against a PIR. `owner` is a free-text label
 * rather than a User relation — deliberately, to avoid needing a
 * "list assignable team members" endpoint for what's often assigned to a team
 * or a third party ("IT Security", "Vendor X"), not always an individual user.
 */
@Entity('pir_action_items')
export class PirActionItem {
  @PrimaryGeneratedColumn()
  id: number;

  /** Excluded from responses — callers already know the report id from the route; no need to leak its raw sectionsJson. */
  @Exclude()
  @ManyToOne(() => PirReport, { onDelete: 'CASCADE' })
  pirReport: PirReport;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', nullable: true })
  owner: string | null;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ default: false })
  done: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
