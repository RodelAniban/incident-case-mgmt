import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { Role } from '../common/roles.enum';
import { Team, User } from '../entities';

function generateTemporaryPassword(): string {
  // 24 base64url-ish chars — meets the login DTO's MinLength(8) with a wide
  // margin, and is only ever used once by an admin to hand off out-of-band.
  return randomBytes(18).toString('base64').replace(/[+/=]/g, '');
}

export interface SafeUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  team: { id: number; name: string } | null;
  mfaEnabled: boolean;
  isActive: boolean;
  createdAt: Date;
}

/**
 * An explicit allow-list, not a `{ passwordHash: _, ...rest }` block-list —
 * a block-list silently leaks every *new* sensitive column (this one missed
 * the MFA secret columns and sessionVersion the moment MFA was added, since
 * object spread ignores @Exclude() entirely once the value is a plain
 * object rather than a User instance).
 */
export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    team: user.team ? { id: user.team.id, name: user.team.name } : null,
    mfaEnabled: user.mfaEnabled,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email } });
  }

  findById(id: number): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  findAll(): Promise<User[]> {
    return this.users.find({ order: { createdAt: 'ASC' } });
  }

  async createUser(params: {
    email: string;
    name: string;
    password: string;
    role: Role;
    teamName?: string;
    teamId?: number | null;
  }): Promise<User> {
    let team: Team | null = null;
    if (params.teamId != null) {
      team = await this.teams.findOne({ where: { id: params.teamId } });
      if (!team) {
        throw new NotFoundException('Team not found');
      }
    } else if (params.teamName) {
      team = await this.teams.findOne({ where: { name: params.teamName } });
      if (!team) {
        team = await this.teams.save(this.teams.create({ name: params.teamName }));
      }
    }
    const passwordHash = await bcrypt.hash(params.password, 12);
    const user = this.users.create({
      email: params.email,
      name: params.name,
      passwordHash,
      role: params.role,
      team,
    });
    try {
      return await this.users.save(user);
    } catch (err) {
      if (err instanceof Error && /UNIQUE constraint failed/.test(err.message)) {
        throw new ConflictException('A user with this email already exists');
      }
      throw err;
    }
  }

  /** Admin-initiated creation — the caller never picks a password; it's generated and returned once. */
  async createUserByAdmin(params: {
    email: string;
    name: string;
    role: Role;
    teamId?: number | null;
  }): Promise<{ user: User; temporaryPassword: string }> {
    const temporaryPassword = generateTemporaryPassword();
    const user = await this.createUser({ ...params, password: temporaryPassword });
    return { user, temporaryPassword };
  }

  async updateUser(
    targetId: number,
    actorId: number,
    changes: { role?: Role; teamId?: number | null; isActive?: boolean },
  ): Promise<User> {
    const target = await this.users.findOne({ where: { id: targetId } });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const changingOwnRole = changes.role !== undefined && changes.role !== target.role && targetId === actorId;
    const changingOwnActive = changes.isActive !== undefined && changes.isActive !== target.isActive && targetId === actorId;
    if (changingOwnRole || changingOwnActive) {
      throw new ForbiddenException('You cannot change your own role or active status — ask another admin to do it');
    }

    const losesAdmin =
      target.role === Role.ADMIN &&
      ((changes.role !== undefined && changes.role !== Role.ADMIN) || changes.isActive === false);
    if (losesAdmin) {
      const activeAdmins = await this.users.count({ where: { role: Role.ADMIN, isActive: true } });
      if (activeAdmins <= 1) {
        throw new ForbiddenException('Cannot remove the last active admin account');
      }
    }

    if (changes.role !== undefined) {
      target.role = changes.role;
    }
    if (changes.teamId !== undefined) {
      if (changes.teamId === null) {
        target.team = null;
      } else {
        const team = await this.teams.findOne({ where: { id: changes.teamId } });
        if (!team) {
          throw new NotFoundException('Team not found');
        }
        target.team = team;
      }
    }
    if (changes.isActive !== undefined) {
      target.isActive = changes.isActive;
      if (!changes.isActive) {
        // Deactivating must cut off any session the account is mid-use in
        // right now, not just block the next login attempt.
        target.sessionVersion += 1;
      }
    }

    return this.users.save(target);
  }

  async resetPassword(targetId: number): Promise<{ temporaryPassword: string }> {
    const target = await this.users.findOne({ where: { id: targetId } });
    if (!target) {
      throw new NotFoundException('User not found');
    }
    const temporaryPassword = generateTemporaryPassword();
    target.passwordHash = await bcrypt.hash(temporaryPassword, 12);
    target.sessionVersion += 1;
    await this.users.save(target);
    return { temporaryPassword };
  }

  listTeams(): Promise<Team[]> {
    return this.teams.find({ order: { name: 'ASC' } });
  }

  async createTeam(name: string): Promise<Team> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Team name is required');
    }
    const existing = await this.teams.findOne({ where: { name: trimmed } });
    if (existing) {
      throw new ConflictException('A team with this name already exists');
    }
    return this.teams.save(this.teams.create({ name: trimmed }));
  }

  async setPendingMfaSecret(userId: number, ciphertext: string, iv: string, authTag: string): Promise<void> {
    await this.users.update(userId, {
      mfaSecretCiphertext: ciphertext,
      mfaSecretIv: iv,
      mfaSecretAuthTag: authTag,
    });
  }

  async setMfaEnabled(userId: number, enabled: boolean): Promise<void> {
    await this.users.update(userId, { mfaEnabled: enabled });
  }

  async clearMfa(userId: number): Promise<void> {
    await this.users.update(userId, {
      mfaEnabled: false,
      mfaSecretCiphertext: null,
      mfaSecretIv: null,
      mfaSecretAuthTag: null,
    });
  }
}
