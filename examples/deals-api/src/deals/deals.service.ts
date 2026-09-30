import { Injectable } from '@nestjs/common';
import { err, ok, type Result } from 'neverthrow';
import { DealAlreadyClosed, DealNotFound } from './deal-errors.js';

export type Deal = { readonly id: string; readonly title: string; readonly closed: boolean };

@Injectable()
export class DealsService {
  private deals: ReadonlyMap<string, Deal> = new Map([
    ['1', { id: '1', title: 'Office lease', closed: false }],
    ['2', { id: '2', title: 'Fleet renewal', closed: true }],
  ]);

  find(id: string): Result<Deal, DealNotFound> {
    const deal = this.deals.get(id);
    return deal ? ok(deal) : err(new DealNotFound({ dealId: id, message: `Deal ${id} does not exist` }));
  }

  close(id: string): Result<Deal, DealNotFound | DealAlreadyClosed> {
    return this.find(id).andThen((deal) => {
      if (deal.closed) return err(new DealAlreadyClosed({ dealId: id, message: `Deal ${id} is already closed` }));
      const closed = { ...deal, closed: true };
      this.deals = new Map(this.deals).set(id, closed);
      return ok(closed);
    });
  }
}
