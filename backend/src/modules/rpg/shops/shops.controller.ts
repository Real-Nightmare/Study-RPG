import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShopsService } from './shops.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators';
import { Role } from '../../../common/decorators/roles.decorator';

@ApiTags('RPG - Shops')
@Controller('rpg/shops')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Get('abilities')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all available abilities' })
  getAbilities() {
    return this.shopsService.getAbilities();
  }

  @Post('abilities/buy')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buy an ability' })
  buyAbility(@CurrentUser() user: JwtPayload, @Body() body: { abilityId: string }) {
    return this.shopsService.buyAbility(user.sub, body.abilityId);
  }

  @Get('items')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all available items' })
  getItems() {
    return this.shopsService.getItems();
  }

  @Post('items/buy')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buy an item' })
  buyItem(@CurrentUser() user: JwtPayload, @Body() body: { itemId: string }) {
    return this.shopsService.buyItem(user.sub, body.itemId);
  }

  @Get('cosmetics')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all available cosmetics' })
  getCosmetics() {
    return this.shopsService.getCosmetics();
  }

  @Post('cosmetics/buy')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buy a cosmetic' })
  buyCosmetic(@CurrentUser() user: JwtPayload, @Body() body: { cosmeticId: string }) {
    return this.shopsService.buyCosmetic(user.sub, body.cosmeticId);
  }

  @Get('inventory')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user shop inventory' })
  getInventory(@CurrentUser() user: JwtPayload) {
    return this.shopsService.getInventory(user.sub);
  }

  @Post('admin/abilities')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create an ability' })
  createAbility(@Body() body: Record<string, unknown>) {
    return this.shopsService.createAbility(body);
  }

  @Post('admin/items')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create an item' })
  createItem(@Body() body: Record<string, unknown>) {
    return this.shopsService.createItem(body);
  }

  @Post('admin/cosmetics')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create a cosmetic' })
  createCosmetic(@Body() body: Record<string, unknown>) {
    return this.shopsService.createCosmetic(body);
  }
}
