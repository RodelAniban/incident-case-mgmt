import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { RequestUser } from '../cases/cases.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/permissions';
import { CreateActionDto } from './dto/create-action.dto';
import { CreatePirDto } from './dto/create-pir.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { UpdatePirDto } from './dto/update-pir.dto';
import { PIR_TEMPLATES } from './pir-templates';
import { PirService } from './pir.service';

@Controller('pir')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PirController {
  constructor(private readonly pirService: PirService) {}

  @Get('templates')
  templates() {
    return PIR_TEMPLATES;
  }

  @Get('cases/:caseId')
  @RequirePermissions(Permission.VIEW_ASSIGNED_CASES, Permission.VIEW_ALL_CASES)
  getCurrent(@Param('caseId', ParseIntPipe) caseId: number, @Req() req: { user: RequestUser }) {
    return this.pirService.getCurrentForCase(caseId, req.user);
  }

  @Get('cases/:caseId/versions')
  @RequirePermissions(Permission.VIEW_ASSIGNED_CASES, Permission.VIEW_ALL_CASES)
  getVersions(@Param('caseId', ParseIntPipe) caseId: number, @Req() req: { user: RequestUser }) {
    return this.pirService.getVersions(caseId, req.user);
  }

  @Post('cases/:caseId')
  @RequirePermissions(Permission.CREATE_EDIT_CASE)
  create(@Param('caseId', ParseIntPipe) caseId: number, @Body() dto: CreatePirDto, @Req() req: { user: RequestUser }) {
    return this.pirService.create(caseId, dto, req.user);
  }

  @Post('cases/:caseId/versions')
  @RequirePermissions(Permission.FINALIZE_PIR)
  startNewVersion(@Param('caseId', ParseIntPipe) caseId: number, @Req() req: { user: RequestUser }) {
    return this.pirService.startNewVersion(caseId, req.user);
  }

  @Patch('reports/:id')
  @RequirePermissions(Permission.CREATE_EDIT_CASE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePirDto, @Req() req: { user: RequestUser }) {
    return this.pirService.update(id, dto, req.user);
  }

  @Post('reports/:id/finalize')
  @RequirePermissions(Permission.FINALIZE_PIR)
  finalize(@Param('id', ParseIntPipe) id: number, @Req() req: { user: RequestUser }) {
    return this.pirService.finalize(id, req.user);
  }

  @Get('reports/:id/actions')
  @RequirePermissions(Permission.VIEW_ASSIGNED_CASES, Permission.VIEW_ALL_CASES)
  listActions(@Param('id', ParseIntPipe) id: number, @Req() req: { user: RequestUser }) {
    return this.pirService.listActions(id, req.user);
  }

  @Post('reports/:id/actions')
  @RequirePermissions(Permission.CREATE_EDIT_CASE)
  addAction(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateActionDto, @Req() req: { user: RequestUser }) {
    return this.pirService.addAction(id, dto, req.user);
  }

  @Patch('actions/:actionId')
  @RequirePermissions(Permission.CREATE_EDIT_CASE)
  updateAction(
    @Param('actionId', ParseIntPipe) actionId: number,
    @Body() dto: UpdateActionDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.pirService.updateAction(actionId, dto, req.user);
  }

  @Delete('actions/:actionId')
  @RequirePermissions(Permission.CREATE_EDIT_CASE)
  deleteAction(@Param('actionId', ParseIntPipe) actionId: number, @Req() req: { user: RequestUser }) {
    return this.pirService.deleteAction(actionId, req.user);
  }
}
