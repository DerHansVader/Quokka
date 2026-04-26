import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './projects.dto';
import { CurrentUser } from '../common/current-user.decorator';

@UseGuards(AuthGuard('jwt'))
@Controller('teams/:teamSlug/projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  list(@Param('teamSlug') teamSlug: string, @CurrentUser() user: any) {
    return this.projectsService.listForTeam(teamSlug, user.id);
  }

  @Post()
  create(
    @Param('teamSlug') teamSlug: string,
    @CurrentUser() user: any,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(teamSlug, user.id, dto);
  }

  @Get(':projectSlug')
  get(
    @Param('teamSlug') teamSlug: string,
    @Param('projectSlug') projectSlug: string,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.getBySlug(teamSlug, projectSlug, user.id);
  }
}
