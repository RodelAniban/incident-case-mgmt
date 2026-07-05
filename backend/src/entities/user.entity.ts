import { Exclude } from 'class-transformer';
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '../common/roles.enum';
import { Team } from './team.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  /** bcrypt hash — excluded from serialization so it never reaches a client. */
  @Exclude()
  @Column()
  passwordHash: string;

  @Column({ type: 'varchar' })
  role: Role;

  @ManyToOne(() => Team, { nullable: true, eager: true })
  team: Team | null;

  @Column({ default: false })
  mfaEnabled: boolean;

  /** A disabled account can't log in, and any live token it's still holding stops working on its very next request — see JwtStrategy. */
  @Column({ default: true })
  isActive: boolean;

  /**
   * Embedded in every issued JWT as `sv`; incremented whenever an admin
   * resets this user's password or deactivates the account. JwtStrategy
   * rejects any token whose `sv` doesn't match the current value, so those
   * actions cut off live sessions immediately instead of only blocking the
   * next login. A counter rather than a timestamp deliberately — comparing
   * `iat` (1-second resolution) against an invalidation instant is racy
   * when a reset and a fresh login land in the same wall-clock second;
   * exact integer equality has no such ambiguity.
   */
  @Exclude()
  @Column({ default: 0 })
  sessionVersion: number;

  /**
   * AES-256-GCM-encrypted TOTP secret (see common/encryption.util.ts) —
   * split across three columns rather than one blob so it round-trips
   * through TypeORM's plain column types without a custom transformer.
   * Populated on /auth/mfa/setup before mfaEnabled flips true on
   * /auth/mfa/verify; a pending-but-unconfirmed secret is never trusted for
   * login since mfaEnabled is what gates the login flow.
   */
  @Exclude()
  @Column({ type: 'text', nullable: true })
  mfaSecretCiphertext: string | null;

  @Exclude()
  @Column({ type: 'varchar', nullable: true })
  mfaSecretIv: string | null;

  @Exclude()
  @Column({ type: 'varchar', nullable: true })
  mfaSecretAuthTag: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
