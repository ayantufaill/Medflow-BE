import cors from 'cors';
import helmet from 'helmet';

// Default allowed origins for development
const defaultDevOrigins = [
  'http://localhost:5175'
];

// Get allowed origins from environment or use defaults
const getAllowedOrigins = (): string[] | string => {
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
  }

  if (process.env.NODE_ENV === 'production') {
    return defaultDevOrigins;
  }

  return defaultDevOrigins;
};

export const corsOptions: cors.CorsOptions = {
  origin: getAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
};

export const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
};

