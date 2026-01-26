import type { JWTPayload } from './auth.types';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      userId?: string;
    }
  }
}

export {};

