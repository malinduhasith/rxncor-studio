type HeaderReader = {
  get(name: string): string | null;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateBucket>();

export function clientIpFromHeaders(headers: HeaderReader) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return forwardedFor || headers.get("x-real-ip") || "unknown";
}

export function checkRateLimit(key: string, options: RateLimitOptions) {
  const now = Date.now();

  if (buckets.size > 5000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(bucketKey);
      }
    }
  }

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs
    });

    return { allowed: true, retryAfter: 0 };
  }

  if (bucket.count >= options.limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    };
  }

  bucket.count += 1;

  return { allowed: true, retryAfter: 0 };
}

export function rateLimitHeaders(retryAfter = 0): Record<string, string> {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store"
  };

  if (retryAfter > 0) {
    headers["Retry-After"] = String(retryAfter);
  }

  return headers;
}
