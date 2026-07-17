import { Module } from '@nestjs/common';
import { BattleService } from './battle.service';
import { BattleController } from './battle.controller';
import { DatabaseModule } from '../../database/database.module';
import { SlcModule } from '../slc/slc.module';

@Module({
  imports: [DatabaseModule, SlcModule],
  controllers: [BattleController],
  providers: [BattleService],
  exports: [BattleService],
})
export class BattleModule {}
