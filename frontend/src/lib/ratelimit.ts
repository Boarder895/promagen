type Bucket = { tokens: number; last: number };

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  refill?: number;
  keyPrefix?: string;
};

export function createRateLimiter(opts: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const refill = opts.refill ?? opts.max / opts.windowMs;

  function keyFor(ip: string) {
    return `${opts.keyPrefix || 'rl'}:${ip}`;
  }

  function take(ip: string) {
    const k = keyFor(ip);
    const now = Date.now();
    const b = buckets.get(k) ?? { tokens: opts.max, last: now };
    const elapsed = now - b.last;
    b.tokens = Math.min(opts.max, b.tokens + elapsed * refill);
    b.last = now;

    if (b.tokens >= 1) {
      b.tokens -= 1;
      buckets.set(k, b);
      return { allowed: true, remaining: Math.floor(b.tokens) };
    }
    buckets.set(k, b);
    return { allowed: false, remaining: Math.floor(b.tokens) };
  }

  return { take };
}

export function clientIpFromHeaders(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const cf = headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const fwd = headers.get('forwarded');
  if (fwd) {
    const m = /for="?([^;"]+)/i.exec(fwd);
    if (m) return m[1].replace(/"/g, '');
  }
  return '0.0.0.0';
}




