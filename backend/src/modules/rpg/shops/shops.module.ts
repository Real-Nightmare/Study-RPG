import { Module } from '@nestjs/common';
import { ShopsService } from './shops.service';
import { ShopsController } from './shops.controller';
import { DatabaseModule } from '../../database/database.module';
import { SlcModule } from '../slc/slc.module';

@Module({
  imports: [DatabaseModule, SlcModule],
  controllers: [ShopsController],
  providers: [ShopsService],
  exports: [ShopsService],
})
export class ShopsModule {}
