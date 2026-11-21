/**
 * Token bucket rate limiter (SECURITY_DESIGN T6). One bucket per client per message
 * type. `now` is injectable for tests.
 */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    now: number,
  ) {
    this.tokens = capacity;
    this.last = now;
  }

  tryTake(now: number): boolean {
    const elapsed = Math.max(0, now - this.last) / 1000;
    this.last = now;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

export interface RateLimitRule {
  /** Burst size. */
  capacity: number;
  /** Sustained messages per second. */
  perSecond: number;
}

/** Per-session buckets for several message types + a violation counter. */
export class SessionRateLimiter {
  private readonly buckets = new Map<string, TokenBucket>();
  violations = 0;

  constructor(
    private readonly rules: Record<string, RateLimitRule>,
    private readonly clock: () => number = () => performance.now(),
  ) {}

  allow(type: string): boolean {
    const rule = this.rules[type];
    if (!rule) return true;
    let bucket = this.buckets.get(type);
    if (!bucket) {
      bucket = new TokenBucket(rule.capacity, rule.perSecond, this.clock());
      this.buckets.set(type, bucket);
    }
    const ok = bucket.tryTake(this.clock());
    if (!ok) this.violations++;
    return ok;
  }
}
