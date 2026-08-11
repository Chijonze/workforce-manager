import type { NextFunction, Request, Response } from "express";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  key?: (req: Request) => string;
};

type RateLimitEntry = { count: number; resetAt: number };

/** A small in-process limiter; use a shared store when scaling horizontally. */
export const createRateLimit = ({ limit, windowMs, key }: RateLimitOptions) => {
  const requests = new Map<string, RateLimitEntry>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const requestKey = key?.(req) || req.ip || "unknown";
    const existing = requests.get(requestKey);
    const entry = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existing;

    entry.count += 1;
    requests.set(requestKey, entry);

    res.setHeader("RateLimit-Limit", String(limit));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - entry.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > limit) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }

    if (requests.size > 10_000) {
      for (const [storedKey, storedEntry] of requests) {
        if (storedEntry.resetAt <= now) requests.delete(storedKey);
      }
    }

    next();
  };
};

export const apiSecurityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
};
