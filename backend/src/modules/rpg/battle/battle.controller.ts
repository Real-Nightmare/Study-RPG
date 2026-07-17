import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BattleService } from './battle.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators';

@ApiTags('RPG - Battle System')
@Controller('rpg/battle')
@UseGuards(JwtAuthGuard)
export class BattleController {
  constructor(private readonly battleService: BattleService) {}

  @Post('start/:monsterId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a battle against a monster' })
  startBattle(@CurrentUser() user: JwtPayload, @Param('monsterId') monsterId: string) {
    return this.battleService.startBattle(user.sub, monsterId);
  }

  @Post('play-card/:battleId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Play a card in battle' })
  playCard(
    @CurrentUser() user: JwtPayload,
    @Param('battleId') battleId: string,
    @Body() body: { cardId: string; target?: string },
  ) {
    return this.battleService.playCard(user.sub, battleId, body.cardId, body.target);
  }

  @Post('monster-turn/:battleId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Process monster turn' })
  monsterTurn(@CurrentUser() user: JwtPayload, @Param('battleId') battleId: string) {
    return this.battleService.monsterTurn(user.sub, battleId);
  }

  @Post('end/:battleId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'End battle and collect rewards' })
  endBattle(@CurrentUser() user: JwtPayload, @Param('battleId') battleId: string) {
    return this.battleService.endBattle(user.sub, battleId);
  }

  @Get('state/:battleId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current battle state' })
  getBattleState(@CurrentUser() user: JwtPayload, @Param('battleId') battleId: string) {
    return this.battleService.getBattleState(user.sub, battleId);
  }

  @Post('flee/:battleId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Flee from battle' })
  fleeBattle(@CurrentUser() user: JwtPayload, @Param('battleId') battleId: string) {
    return this.battleService.fleeBattle(user.sub, battleId);
  }
}
