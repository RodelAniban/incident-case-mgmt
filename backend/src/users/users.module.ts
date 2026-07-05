import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team, User } from '../entities';
import { TeamsController } from './teams.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Team])],
  controllers: [UsersController, TeamsController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
