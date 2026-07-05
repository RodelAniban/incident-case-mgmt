import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { EvidenceItem } from './evidence-item.entity';
import { User } from './user.entity';

/**
 * Per-item access grant. Being on the case team or holding a role with
 * DOWNLOAD_EVIDENCE is not sufficient by itself — see EvidenceService.canDownload.
 */
@Entity('evidence_access_grants')
@Unique(['evidenceItem', 'user'])
export class EvidenceAccessGrant {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => EvidenceItem, { onDelete: 'CASCADE' })
  evidenceItem: EvidenceItem;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => User)
  grantedBy: User;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn()
  grantedAt: Date;
}
