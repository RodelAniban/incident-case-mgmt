import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/permissions';
import { CreateTeamDto } from './dto/create-team.dto';
import { UsersService } from './users.service';

@Controller('teams')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.MANAGE_USERS)
export class TeamsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.listTeams();
  }

  @Post()
  create(@Body() dto: CreateTeamDto) {
    return this.usersService.createTeam(dto.name);
  }
}
