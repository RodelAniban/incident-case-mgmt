import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Role } from '../common/roles.enum';
import { Team, User } from '../entities';

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
    return this.users.find();
  }

  async createUser(params: {
    email: string;
    name: string;
    password: string;
    role: Role;
    teamName?: string;
  }): Promise<User> {
    let team: Team | null = null;
    if (params.teamName) {
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
    return this.users.save(user);
  }
}
