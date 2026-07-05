import { Exclude } from 'class-transformer';
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Case } from './case.entity';
import { User } from './user.entity';

export enum EvidenceType {
  DISK_IMAGE = 'disk_image',
  MEMORY_DUMP = 'memory_dump',
  LOG_EXPORT = 'log_export',
  EMAIL = 'email',
  PCAP = 'pcap',
  SCREENSHOT = 'screenshot',
  OTHER = 'other',
}

@Entity('evidence_items')
export class EvidenceItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Case, { onDelete: 'CASCADE' })
  case: Case;

  @Column({ type: 'varchar' })
  type: EvidenceType;

  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  @Column()
  originalFilename: string;

  @Column({ type: 'varchar', nullable: true })
  mimeType: string | null;

  @Column({ type: 'int' })
  sizeBytes: number;

  /** SHA-256 of the plaintext content — computed at intake, re-verified on every download. */
  @Column()
  sha256: string;

  /** Path to the encrypted blob, relative to EVIDENCE_STORAGE_DIR. The original is write-once. */
  @Exclude()
  @Column()
  storageRef: string;

  @Exclude()
  @Column()
  encryptionIv: string;

  @Exclude()
  @Column()
  encryptionAuthTag: string;

  @Column({ type: 'varchar', nullable: true })
  tags: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => User)
  collectedBy: User;

  @CreateDateColumn()
  collectedAt: Date;
}
