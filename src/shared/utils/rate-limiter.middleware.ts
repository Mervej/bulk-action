import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { RATE_LIMIT_PER_MINUTE, RATE_LIMIT_WINDOW_MS } from '../constants';

const rateCache = new Map<string, { count: number, timestamp: number }>();

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const accountId = req.headers['x-account-id'] || 'default';
    const now = Date.now();
    const limitWindow = RATE_LIMIT_WINDOW_MS;

    let entry = rateCache.get(accountId);

    if (!entry || now - entry.timestamp > limitWindow) {
      entry = { count: 0, timestamp: now };
      rateCache.set(accountId, entry);
    }
  
    entry.count++;

    if (entry.count > RATE_LIMIT_PER_MINUTE) {
      throw new BadRequestException('Rate limit exceeded');
    }

    next();
  }
}
