import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ViewsService } from './views.service';
import { CreateViewDto, UpdateViewDto } from './views.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('views')
export class ViewsController {
  constructor(private viewsService: ViewsService) {}

  @Get()
  list(@Query('scope') scope: string, @Query('scopeId') scopeId: string) {
    return this.viewsService.listForScope(scope, scopeId);
  }

  @Get('default')
  getDefault(@Query('scope') scope: string, @Query('scopeId') scopeId: string) {
    return this.viewsService.getOrCreateDefault(scope, scopeId);
  }

  @Post()
  create(@Body() dto: CreateViewDto) {
    return this.viewsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateViewDto) {
    return this.viewsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.viewsService.delete(id);
  }
}
