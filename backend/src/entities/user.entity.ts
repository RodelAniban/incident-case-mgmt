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

  @CreateDateColumn()
  createdAt: Date;
}
