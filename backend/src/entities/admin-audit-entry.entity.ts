import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * Same append-only, hash-chained shape as CaseHistoryEntry (see AdminAuditService
 * for verification), but chained globally rather than per-case — admin actions
 * (role/team changes, deactivation, password resets, user/team creation) have
 * no natural case to scope under.
 */
@Entity('admin_audit_entries')
export class AdminAuditEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  actor: User;

  /** Null for actions with no single affected account, e.g. team creation. */
  @ManyToOne(() => User, { nullable: true })
  targetUser: User | null;

  @Column()
  action: string;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @Column()
  prevHash: string;

  @Column()
  hash: string;

  @CreateDateColumn()
  ts: Date;
}
