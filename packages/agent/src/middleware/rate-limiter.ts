interface Window {
  count:    number
  resetAt:  number
}

// In-memory store — scoped per deployment instance
// For true distributed rate limiting, replace with Supabase KV or Upstash
const windows = new Map<string, Window>()

export interface RateLimitConfig {
  maxRequests:     number   // requests per window
  windowMs:        number   // window size in ms
  maxTokensPerDay: number   // estimated token budget per merchant per day
}

export const RATE_LIMITS = {
  chat: {
    maxRequests:     30,          // 30 messages per 10 minutes
    windowMs:        10 * 60_000,
    maxTokensPerDay: 500_000      // ~$37.50/day cap per merchant
  },
  scheduled: {
    maxRequests:     100,         // more headroom for automated runs
    windowMs:        60 * 60_000, // per hour
    maxTokensPerDay: 2_000_000
  }
} satisfies Record<string, RateLimitConfig>

export function checkRateLimit(
  merchantId: string,
  type:       keyof typeof RATE_LIMITS = 'chat'
): { allowed: boolean; retryAfterMs?: number } {
  const config = RATE_LIMITS[type]
  const key    = `${merchantId}:${type}`
  const now    = Date.now()

  const win = windows.get(key)

  if (!win || now > win.resetAt) {
    windows.set(key, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true }
  }

  if (win.count >= config.maxRequests) {
    return { allowed: false, retryAfterMs: win.resetAt - now }
  }

  win.count++
  return { allowed: true }
}
