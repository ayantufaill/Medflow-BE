import { Request, Response, NextFunction } from 'express';

// Custom rate limiter that only counts failed login attempts
// This is stored in memory and resets on server restart
// For production, consider using Redis for distributed rate limiting

interface LoginAttempt {
  count: number;
  resetTime: number;
}

const loginAttempts = new Map<string, LoginAttempt>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 20;

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of loginAttempts.entries()) {
    if (now > value.resetTime) {
      loginAttempts.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute

export const loginRateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const key = `login:${ip}`;
  const now = Date.now();

  // Get or create entry
  let entry = loginAttempts.get(key);
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + WINDOW_MS };
    loginAttempts.set(key, entry);
  }

  // Check if limit exceeded
  if (entry.count >= MAX_ATTEMPTS) {
    const remainingTime = Math.ceil((entry.resetTime - now) / 1000 / 60);
    return res.status(429).json({
      success: false,
      error: {
        message: `Too many failed login attempts. Please wait ${remainingTime} minute(s) before trying again. The rate limit will reset automatically after the time window expires.`,
      },
    });
  }

  // Store reference to check after response
  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);

  // Override res.json to check if login was successful
  res.json = function (body: any) {
    // If login was successful (status 200 and success: true), don't count this attempt
    if (res.statusCode === 200 && body?.success === true) {
      // Successful login - reset the counter for this IP
      const currentEntry = loginAttempts.get(key);
      if (currentEntry) {
        currentEntry.count = 0;
        loginAttempts.set(key, currentEntry);
      }
    } else if (res.statusCode === 401 || res.statusCode === 400 || res.statusCode >= 500) {
      // Failed login attempt - increment count (already incremented before)
      // Count stays incremented
    }

    // Restore original methods
    res.json = originalJson;
    res.send = originalSend;

    // Call original json method
    return originalJson(body);
  };

  // Override res.send for consistency
  res.send = function (body: any) {
    // Similar logic for res.send
    if (res.statusCode === 200) {
      try {
        const parsed = typeof body === 'string' ? JSON.parse(body) : body;
        if (parsed?.success === true) {
          const currentEntry = loginAttempts.get(key);
          if (currentEntry) {
            currentEntry.count = 0;
            loginAttempts.set(key, currentEntry);
          }
        }
      } catch {
        // Not JSON, ignore
      }
    }

    // Restore original methods
    res.json = originalJson;
    res.send = originalSend;

    return originalSend(body);
  };

  // Increment attempt count before proceeding
  // If login succeeds, it will be reset in the response handler
  entry.count++;
  loginAttempts.set(key, entry);

  next();
};

