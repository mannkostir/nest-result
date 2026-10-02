import { Controller, Get, Inject, Param, Post } from '@nestjs/common';
import type { Result } from 'neverthrow';
import { toHttp } from 'nest-result';
import type { DealAlreadyClosed, DealNotFound } from './deal-errors.js';
import { domainDefaults, MapDomainErrors } from './domain-errors.js';
import { type Deal, DealsService } from './deals.service.js';

@Controller('deals')
export class DealsController {
  constructor(@Inject(DealsService) private readonly deals: DealsService) {}

  @Get(':id')
  find(@Param('id') id: string): Promise<Deal> {
    return toHttp(this.deals.find(id), {}, domainDefaults);
  }

  @Post(':id/close')
  @MapDomainErrors({})
  close(@Param('id') id: string): Result<Deal, DealNotFound | DealAlreadyClosed> {
    return this.deals.close(id);
  }
}
