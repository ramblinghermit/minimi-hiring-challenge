import { Request, Response, NextFunction } from 'express';

export interface RateLimiterOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
  message?: string;
  isSseEndpoint?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  total: number;
  remaining: number;
  resetTimeMs: number;
  retryAfterSec: number;
}

/**
 * High-performance sliding-window in-memory Rate Limiter
 * Tracks requests with microsecond timestamps and cleans up expired keys automatically.
 */
export class RateLimiter {
  private hits: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxRequests: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: { windowMs: number; maxRequests: number }) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;

    // Periodically evict completely expired keys to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.evictExpired();
    }, Math.max(30000, this.windowMs)).unref();
  }

  /**
   * Consume a rate limit unit for a given identifier (IP / user ID / token)
   */
  public consume(key: string, cost = 1): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.hits.get(key);
    if (!timestamps) {
      timestamps = [];
      this.hits.set(key, timestamps);
    }

    // Filter out timestamps outside the sliding window
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length + cost > this.maxRequests) {
      const oldestValid = timestamps[0] || now;
      const resetTimeMs = oldestValid + this.windowMs;
      const retryAfterSec = Math.max(1, Math.ceil((resetTimeMs - now) / 1000));

      this.hits.set(key, timestamps);
      return {
        allowed: false,
        total: timestamps.length,
        remaining: 0,
        resetTimeMs,
        retryAfterSec,
      };
    }

    // Record hits
    for (let i = 0; i < cost; i++) {
      timestamps.push(now);
    }
    this.hits.set(key, timestamps);

    const remaining = Math.max(0, this.maxRequests - timestamps.length);
    const resetTimeMs = timestamps[0] + this.windowMs;
    const retryAfterSec = Math.max(0, Math.ceil((resetTimeMs - now) / 1000));

    return {
      allowed: true,
      total: timestamps.length,
      remaining,
      resetTimeMs,
      retryAfterSec,
    };
  }

  /**
   * Get current usage without consuming
   */
  public get(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = (this.hits.get(key) || []).filter((t) => t > windowStart);

    const remaining = Math.max(0, this.maxRequests - timestamps.length);
    const oldest = timestamps[0] || now;
    const resetTimeMs = oldest + this.windowMs;
    const retryAfterSec = Math.max(0, Math.ceil((resetTimeMs - now) / 1000));

    return {
      allowed: timestamps.length < this.maxRequests,
      total: timestamps.length,
      remaining,
      resetTimeMs,
      retryAfterSec,
    };
  }

  /**
   * Reset limits for a specific key, or all keys
   */
  public reset(key?: string): void {
    if (key) {
      this.hits.delete(key);
    } else {
      this.hits.clear();
    }
  }

  /**
   * Evict keys that have zero hits within current sliding window
   */
  private evictExpired(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    for (const [key, timestamps] of this.hits.entries()) {
      const valid = timestamps.filter((t) => t > windowStart);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }

  /**
   * Clean up timer on shutdown
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Default Key Generator: Prioritizes Authenticated User ID, then Auth Token, then IP
export function defaultKeyGenerator(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return `token_${authHeader.slice(7).trim().slice(0, 24)}`;
  }
  if (req.query.token) {
    return `token_${String(req.query.token).trim().slice(0, 24)}`;
  }
  if (req.query.user_id) {
    return `user_${String(req.query.user_id).trim()}`;
  }
  if (req.body?.user_id) {
    return `user_${String(req.body.user_id).trim()}`;
  }

  // Fallback to IP address
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || '127.0.0.1';
  return `ip_${ip}`;
}

/**
 * Creates an Express Middleware using a RateLimiter instance
 */
export function createRateLimitMiddleware(limiter: RateLimiter, options: RateLimiterOptions) {
  const keyGen = options.keyGenerator || defaultKeyGenerator;
  const message = options.message || 'Too many requests. Please slow down and try again later.';

  return (req: Request, res: Response, next: NextFunction): void => {
    const rawKey = keyGen(req);
    const key = options.keyPrefix ? `${options.keyPrefix}:${rawKey}` : rawKey;

    const result = limiter.consume(key);

    // Standard Rate Limit Headers
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTimeMs / 1000));

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfterSec);

      // Handle SSE stream endpoints with friendly SSE agent_error event
      if (options.isSseEndpoint || req.headers.accept?.includes('text/event-stream')) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`event: agent_error\ndata: ${JSON.stringify({ message, retryAfter: result.retryAfterSec })}\n\n`);
        res.end();
        return;
      }

      res.status(429).json({
        error: message,
        retryAfter: result.retryAfterSec,
      });
      return;
    }

    next();
  };
}

// Pre-configured Application Limiters
// 1. Auth routes (15 requests/min per IP to stop brute force credential stuffing)
export const authRateLimiter = new RateLimiter({ windowMs: 60 * 1000, maxRequests: 15 });

// 2. Chat Stream routes (30 requests/min per user/IP to prevent LLM quota exhaustion)
export const chatRateLimiter = new RateLimiter({ windowMs: 60 * 1000, maxRequests: 30 });

// 3. General API routes (120 requests/min per user/IP)
export const generalApiRateLimiter = new RateLimiter({ windowMs: 60 * 1000, maxRequests: 120 });
