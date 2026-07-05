import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Case } from './case.entity';
import { User } from './user.entity';

/** Phase 2 (Evidence Management) — schema reserved now, intake/custody logic ships later. */
@Entity('evidence_items')
export class EvidenceItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Case, { onDelete: 'CASCADE' })
  case: Case;

  @Column()
  type: string;

  @Column({ nullable: true })
  sha256: string;

  @Column({ nullable: true })
  storageRef: string;

  @ManyToOne(() => User)
  collectedBy: User;

  @CreateDateColumn()
  collectedAt: Date;
}
