import { Module } from '@nestjs/common';
import { SlcService } from './slc.service';
import { SlcController } from './slc.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SlcController],
  providers: [SlcService],
  exports: [SlcService],
})
export class SlcModule {}
