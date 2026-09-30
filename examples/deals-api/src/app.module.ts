import { Module } from '@nestjs/common';
import { ResultModule } from 'nest-result';
import { DealsController } from './deals/deals.controller.js';
import { DealsService } from './deals/deals.service.js';

@Module({
  imports: [ResultModule.forRoot()],
  controllers: [DealsController],
  providers: [DealsService],
})
export class AppModule {}
