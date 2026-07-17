import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CardsService } from './cards.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators';
import { Role } from '../../../common/decorators/roles.decorator';

@ApiTags('RPG - Cards')
@Controller('rpg/cards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Get('all')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all available cards' })
  getAllCards() {
    return this.cardsService.getAllCards();
  }

  @Get('inventory')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user card inventory' })
  getUserCards(@CurrentUser() user: JwtPayload) {
    return this.cardsService.getUserCards(user.sub);
  }

  @Post('buy/:cardId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buy a card from marketplace' })
  buyCard(@CurrentUser() user: JwtPayload, @Param('cardId') cardId: string) {
    return this.cardsService.buyCard(user.sub, cardId);
  }

  @Post('equip')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Equip active deck (max 5 cards)' })
  equipCards(@CurrentUser() user: JwtPayload, @Body() body: { cardIds: string[] }) {
    return this.cardsService.equipCards(user.sub, body.cardIds);
  }

  @Get('deck')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current equipped deck' })
  getDeck(@CurrentUser() user: JwtPayload) {
    return this.cardsService.getDeck(user.sub);
  }

  @Post('admin/cards')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create a card' })
  createCard(@Body() body: Record<string, unknown>) {
    return this.cardsService.createCard(body);
  }
}
