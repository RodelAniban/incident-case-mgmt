import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { RequestUser } from '../cases/cases.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/permissions';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { toSafeUser, UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.MANAGE_USERS)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map(toSafeUser);
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @Req() req: { user: RequestUser }) {
    const { user, temporaryPassword } = await this.usersService.createUserByAdmin(dto, req.user.userId);
    return { user: toSafeUser(user), temporaryPassword };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Req() req: { user: RequestUser },
  ) {
    const updated = await this.usersService.updateUser(id, req.user.userId, dto);
    return toSafeUser(updated);
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id', ParseIntPipe) id: number, @Req() req: { user: RequestUser }) {
    return this.usersService.resetPassword(id, req.user.userId);
  }
}
