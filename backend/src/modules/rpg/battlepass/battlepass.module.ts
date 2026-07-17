import { Module } from '@nestjs/common';
import { BattlepassService } from './battlepass.service';
import { BattlepassController } from './battlepass.controller';
import { DatabaseModule } from '../../database/database.module';
import { SlcModule } from '../slc/slc.module';
import { LlmModule } from '../../llm/llm.module';

@Module({
  imports: [DatabaseModule, SlcModule, LlmModule],
  controllers: [BattlepassController],
  providers: [BattlepassService],
  exports: [BattlepassService],
})
export class BattlepassModule {}
