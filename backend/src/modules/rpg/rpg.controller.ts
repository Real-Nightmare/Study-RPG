import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators';

@ApiTags('RPG')
@Controller('rpg')
@UseGuards(JwtAuthGuard)
export class RpgController {
  @Get('status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get RPG status overview' })
  getStatus(@CurrentUser() user: JwtPayload) {
    return {
      message: 'Study RPG system active',
      userId: user.sub,
      features: ['slc', 'battle', 'cards', 'areas', 'battlepass', 'shops', 'special'],
    };
  }
}
