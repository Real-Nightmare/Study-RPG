import { Module } from '@nestjs/common';
import { CardsService } from './cards.service';
import { CardsController } from './cards.controller';
import { DatabaseModule } from '../../database/database.module';
import { SlcModule } from '../slc/slc.module';

@Module({
  imports: [DatabaseModule, SlcModule],
  controllers: [CardsController],
  providers: [CardsService],
  exports: [CardsService],
})
export class CardsModule {}
