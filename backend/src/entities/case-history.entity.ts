import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Case } from './case.entity';
import { User } from './user.entity';

/**
 * Append-only audit trail entry. `hash` is sha256(prevHash + entry payload),
 * so any edit or deletion of a historical row breaks the chain for every
 * entry after it — see AuditService for verification.
 */
@Entity('case_history')
export class CaseHistoryEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @ManyToOne(() => Case, { onDelete: 'CASCADE' })
  case: Case;

  @ManyToOne(() => User)
  actor: User;

  @Column()
  field: string;

  @Column({ type: 'text', nullable: true })
  oldValue: string | null;

  @Column({ type: 'text', nullable: true })
  newValue: string | null;

  @Column()
  prevHash: string;

  @Column()
  hash: string;

  @CreateDateColumn()
  ts: Date;
}
