import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EvidenceItem } from './evidence-item.entity';
import { User } from './user.entity';

export enum CustodyAction {
  UPLOADED = 'uploaded',
  DOWNLOADED = 'downloaded',
  ACCESS_GRANTED = 'access_granted',
  ACCESS_REVOKED = 'access_revoked',
}

/** Append-only. Records only custody-relevant events — not routine metadata views. */
@Entity('evidence_custody_entries')
export class EvidenceCustodyEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => EvidenceItem, { onDelete: 'CASCADE' })
  evidenceItem: EvidenceItem;

  @ManyToOne(() => User)
  actor: User;

  @Column({ type: 'varchar' })
  action: CustodyAction;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn()
  ts: Date;
}
