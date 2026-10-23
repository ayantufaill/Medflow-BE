import cors from 'cors';
import helmet from 'helmet';

const apiPort = process.env.PORT || '5001';

const defaultDevOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  // Swagger UI is served by the API itself (/api-docs), so its "Try it out"
  // requests carry the API's own origin.
  `http://localhost:${apiPort}`,
  `http://127.0.0.1:${apiPort}`,
];

// In development the Vite dev server falls back to the next free port when its
// preferred one is taken (5173 -> 5174 -> ...), and `host: true` in vite.config
// also exposes it on the machine's LAN address. Pinning the allowlist to a
// single port lets a stale dev server silently break CORS, so accept any port
// on a loopback or private-network host instead.
const devHostPattern =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

const isDevelopment = (): boolean => process.env.NODE_ENV !== 'production';

export const getAllowedOrigins = (): string[] => {
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
  }

  if (process.env.NODE_ENV === 'production') {
    return [];
  }

  return defaultDevOrigins;
};

export const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true;
  if (getAllowedOrigins().includes(origin)) return true;
  // Loopback/LAN origins only, and never in production.
  return isDevelopment() && devHostPattern.test(origin);
};

export const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    // Reject by omitting the CORS headers rather than throwing: an Error here
    // propagates to the error handler and surfaces as a misleading 500, when
    // the actual outcome is simply "this origin is not allowed".
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Branch-Id', 'ngrok-skip-browser-warning'],
  optionsSuccessStatus: 200
};

export const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:', 'http:'],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' as const },
};
