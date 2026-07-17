import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AreasService } from './areas.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators';
import { Role } from '../../../common/decorators/roles.decorator';

@ApiTags('RPG - Areas & Worlds')
@Controller('rpg/areas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Get('worlds')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all worlds' })
  getWorlds() {
    return this.areasService.getWorlds();
  }

  @Get('worlds/:worldId/areas')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get areas for a world with user progress' })
  getAreas(@CurrentUser() user: JwtPayload, @Param('worldId') worldId: string) {
    return this.areasService.getAreas(user.sub, worldId);
  }

  @Post('unlock/:areaId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlock an area' })
  unlockArea(@CurrentUser() user: JwtPayload, @Param('areaId') areaId: string) {
    return this.areasService.unlockArea(user.sub, areaId);
  }

  @Post('subsections/:subsectionId/complete')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete a subsection' })
  completeSubsection(
    @CurrentUser() user: JwtPayload,
    @Param('subsectionId') subsectionId: string,
    @Body() body: { score?: number },
  ) {
    return this.areasService.completeSubsection(user.sub, subsectionId, body.score || 100);
  }

  @Get('progress')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user progress across all areas' })
  getUserProgress(@CurrentUser() user: JwtPayload) {
    return this.areasService.getUserProgress(user.sub);
  }

  @Post('admin/worlds')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create a world' })
  createWorld(@Body() body: Record<string, unknown>) {
    return this.areasService.createWorld(body);
  }

  @Post('admin/areas')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create an area' })
  createArea(@Body() body: Record<string, unknown>) {
    return this.areasService.createArea(body);
  }

  @Put('admin/areas/:id')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update an area' })
  updateArea(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.areasService.updateArea(id, body);
  }
}
