import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  SetAccessDto,
  UpdateProjectDto,
} from './projects.dto';
import { CurrentUser } from '../common/current-user.decorator';

@UseGuards(AuthGuard('jwt'))
@Controller('teams/:teamSlug/projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  list(@Param('teamSlug') teamSlug: string, @CurrentUser() user: any) {
    return this.projectsService.listForTeam(teamSlug, user);
  }

  @Post()
  create(
    @Param('teamSlug') teamSlug: string,
    @CurrentUser() user: any,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(teamSlug, user, dto);
  }

  @Get(':projectSlug')
  get(
    @Param('teamSlug') teamSlug: string,
    @Param('projectSlug') projectSlug: string,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.getBySlug(teamSlug, projectSlug, user);
  }

  @Patch(':projectSlug')
  update(
    @Param('teamSlug') teamSlug: string,
    @Param('projectSlug') projectSlug: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(teamSlug, projectSlug, user, dto);
  }

  @Post(':projectSlug/access')
  grant(
    @Param('teamSlug') teamSlug: string,
    @Param('projectSlug') projectSlug: string,
    @CurrentUser() user: any,
    @Body() dto: SetAccessDto,
  ) {
    return this.projectsService.grantAccess(teamSlug, projectSlug, user, dto.userId);
  }

  @Delete(':projectSlug/access/:userId')
  revoke(
    @Param('teamSlug') teamSlug: string,
    @Param('projectSlug') projectSlug: string,
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.revokeAccess(teamSlug, projectSlug, user, userId);
  }

  @Post(':projectSlug/pin')
  pin(
    @Param('teamSlug') teamSlug: string,
    @Param('projectSlug') projectSlug: string,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.pin(teamSlug, projectSlug, user);
  }

  @Delete(':projectSlug/pin')
  unpin(
    @Param('teamSlug') teamSlug: string,
    @Param('projectSlug') projectSlug: string,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.unpin(teamSlug, projectSlug, user);
  }
}
