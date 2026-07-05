import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/permissions';
import { CasesService, RequestUser } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';

@Controller('cases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  @RequirePermissions(Permission.CREATE_EDIT_CASE)
  create(@Body() dto: CreateCaseDto, @Req() req: { user: RequestUser }) {
    return this.casesService.create(dto, req.user);
  }

  @Get()
  @RequirePermissions(Permission.VIEW_ASSIGNED_CASES, Permission.VIEW_ALL_CASES)
  findAll(@Req() req: { user: RequestUser }) {
    return this.casesService.findAllScoped(req.user);
  }

  @Get(':id')
  @RequirePermissions(Permission.VIEW_ASSIGNED_CASES, Permission.VIEW_ALL_CASES)
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: { user: RequestUser }) {
    return this.casesService.findOneScoped(id, req.user);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CREATE_EDIT_CASE, Permission.CLOSE_HIGH_CRITICAL_CASE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCaseDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.casesService.update(id, dto, req.user);
  }
}
