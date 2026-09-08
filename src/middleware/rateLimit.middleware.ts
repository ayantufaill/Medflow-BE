import rateLimit from 'express-rate-limit';
// Redis is optional - not installed, using memory store instead
// import { createClient } from 'redis';

// Try to use Redis for rate limiting if available, otherwise use memory store
// let store: any = undefined;

// Note: For production, consider using Redis for distributed rate limiting
// For now, using memory store which resets on server restart

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs (register, forgot-password, etc.)
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many login attempts. Please wait 15 minutes before trying again.',
      },
    });
  },
  // Use memory store (default) - resets on server restart
  // For production with multiple servers, use Redis store
});

// Separate rate limiter for login that allows more attempts
// This is a workaround - ideally we'd skip successful requests
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Allow more attempts for login (30 instead of 20)
  message: {
    success: false,
    error: {
      message: 'Too many login attempts. Please wait 15 minutes before trying again.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many login attempts. Please wait 15 minutes before trying again. The rate limit will reset automatically after the time window expires.',
      },
    });
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window (resets faster)
  max: 300, // 300 requests per minute – normal use (pages, logout, etc.) should not hit this
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Unauthenticated public booking widget — read-only slot lookups. Looser
// than the write limiter below since browsing several days/providers in one
// visit is normal, but still bounded since it's reachable with no login.
export const publicSlotsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: { message: 'Too many requests. Please wait a few minutes and try again.' },
    });
  },
});

// Unauthenticated public booking widget — actually creates a patient record
// and reserves a real slot, so this is the real spam/abuse surface and gets
// the tightest limit of any endpoint in the app.
export const publicBookingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: { message: 'Too many booking attempts. Please call our office directly, or wait 15 minutes and try again.' },
    });
  },
});

