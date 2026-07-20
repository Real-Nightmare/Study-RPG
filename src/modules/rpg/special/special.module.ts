import { Module } from '@nestjs/common';
import { SpecialService } from './special.service';
import { SpecialController } from './special.controller';
import { DatabaseModule } from '../../database/database.module';
import { SlcModule } from '../slc/slc.module';
import { LlmModule } from '../../llm/llm.module';

@Module({
  imports: [DatabaseModule, SlcModule, LlmModule],
  controllers: [SpecialController],
  providers: [SpecialService],
  exports: [SpecialService],
})
export class SpecialModule {}
