import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SlcService } from './slc.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators';
import { Role } from '../../../common/decorators/roles.decorator';

@ApiTags('RPG - SLC Wallet')
@Controller('rpg/slc')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SlcController {
  constructor(private readonly slcService: SlcService) {}

  @Get('wallet')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get SLC wallet balance and stats' })
  async getWallet(@CurrentUser() user: JwtPayload) {
    return this.slcService.getWallet(user.sub);
  }

  @Get('transactions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get SLC transaction history' })
  async getTransactionHistory(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.slcService.getTransactionHistory(
      user.sub,
      parseInt(limit || '50', 10),
      parseInt(offset || '0', 10),
    );
  }

  @Get('revision-centre')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Revision Centre funds and streak' })
  async getRevisionCentreFunds(@CurrentUser() user: JwtPayload) {
    return this.slcService.getRevisionCentreFunds(user.sub);
  }

  @Post('revision-centre/update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update Revision Centre funds based on quiz score' })
  async updateRevisionCentreFunds(
    @CurrentUser() user: JwtPayload,
    @Body() body: { score: number; totalQuestions: number },
  ) {
    return this.slcService.updateRevisionCentreFunds(user.sub, body.score, body.totalQuestions);
  }

  @Get('admin/wallets')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: View all SLC wallets' })
  async getAllWallets() {
    return this.slcService.getAllWallets();
  }
}
