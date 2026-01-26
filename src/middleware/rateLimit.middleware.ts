import rateLimit from 'express-rate-limit';
// Redis is optional - not installed, using memory store instead
// import { createClient } from 'redis';

// Try to use Redis for rate limiting if available, otherwise use memory store
// let store: any = undefined;

// Note: For production, consider using Redis for distributed rate limiting
// For now, using memory store which resets on server restart

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs (increased)
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

