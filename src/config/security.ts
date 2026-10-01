import cors from 'cors';
import helmet from 'helmet';

const defaultDevOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

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
  return getAllowedOrigins().includes(origin);
};

export const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin not allowed by CORS'));
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
