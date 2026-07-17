import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BattlepassService } from './battlepass.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators';
import { Role } from '../../../common/decorators/roles.decorator';

@ApiTags('RPG - Battlepass')
@Controller('rpg/battlepass')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BattlepassController {
  constructor(private readonly battlepassService: BattlepassService) {}

  @Get('current-season')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current active season' })
  getCurrentSeason() {
    return this.battlepassService.getCurrentSeason();
  }

  @Get('progress')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user battlepass progress' })
  getUserProgress(@CurrentUser() user: JwtPayload) {
    return this.battlepassService.getUserProgress(user.sub);
  }

  @Post('add-exp')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add EXP to user battlepass' })
  addExp(@CurrentUser() user: JwtPayload, @Body() body: { seasonId?: string; amount: number }) {
    return this.battlepassService.addExp(user.sub, body.seasonId, body.amount);
  }

  @Post('claim-reward')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Claim battlepass tier reward' })
  claimReward(
    @CurrentUser() user: JwtPayload,
    @Body() body: { seasonId?: string; tierId: string },
  ) {
    return this.battlepassService.claimReward(user.sub, body.seasonId, body.tierId);
  }

  @Get('missions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available event missions' })
  getMissions(@CurrentUser() user: JwtPayload) {
    return this.battlepassService.getMissions(user.sub);
  }

  @Post('missions/:missionId/claim')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Claim event mission reward' })
  claimMission(@CurrentUser() user: JwtPayload, @Param('missionId') missionId: string) {
    return this.battlepassService.claimMission(user.sub, missionId);
  }

  @Post('admin/seasons')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create a battlepass season' })
  createSeason(@Body() body: Record<string, unknown>) {
    return this.battlepassService.createSeason(body);
  }

  @Post('admin/tiers')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create a battlepass tier' })
  createTier(@Body() body: Record<string, unknown>) {
    return this.battlepassService.createTier(body);
  }
}
