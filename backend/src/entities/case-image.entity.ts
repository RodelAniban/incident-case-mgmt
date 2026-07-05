import { Exclude } from 'class-transformer';
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Case } from './case.entity';
import { User } from './user.entity';

/**
 * Inline images embedded in a case narrative (screenshots, diagrams). Deliberately
 * lighter-weight than EvidenceItem — no chain-of-custody ledger or per-item access
 * grants, since being able to view the narrative already implies authorization to
 * see what's embedded in it. Served by publicId (a random UUID) rather than the
 * sequential id, and the raw read endpoint is intentionally unauthenticated so a
 * plain <img src> tag works — see case-images.controller.ts for that trade-off.
 */
@Entity('case_images')
export class CaseImage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  publicId: string;

  @ManyToOne(() => Case, { onDelete: 'CASCADE' })
  case: Case;

  @ManyToOne(() => User)
  uploadedBy: User;

  @Column({ type: 'varchar' })
  mimeType: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  @Exclude()
  @Column()
  storageRef: string;

  @Exclude()
  @Column()
  encryptionIv: string;

  @Exclude()
  @Column()
  encryptionAuthTag: string;

  @CreateDateColumn()
  createdAt: Date;
}
