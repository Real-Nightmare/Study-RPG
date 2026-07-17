import { Module } from '@nestjs/common';
import { SlcModule } from './slc/slc.module';
import { BattleModule } from './battle/battle.module';
import { CardsModule } from './cards/cards.module';
import { AreasModule } from './areas/areas.module';
import { BattlepassModule } from './battlepass/battlepass.module';
import { ShopsModule } from './shops/shops.module';
import { SpecialModule } from './special/special.module';

@Module({
  imports: [
    SlcModule,
    BattleModule,
    CardsModule,
    AreasModule,
    BattlepassModule,
    ShopsModule,
    SpecialModule,
  ],
})
export class RpgModule {}
