import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Case } from './case.entity';

/** Phase 4 (Post-Incident Review Templates) — schema reserved now, editor ships later. */
@Entity('pir_reports')
export class PirReport {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Case, { onDelete: 'CASCADE' })
  @JoinColumn()
  case: Case;

  @Column()
  templateId: string;

  @Column({ type: 'text', default: '{}' })
  sectionsJson: string;

  @Column({ default: 1 })
  version: number;

  @Column({ type: 'datetime', nullable: true })
  finalizedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
