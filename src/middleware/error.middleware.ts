import type { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/error.util';
import { ErrorCode } from '../constants/errorCodes';
import { SYSTEM_ERROR_MESSAGES } from '../constants/systemErrorMessages';

export const errorHandler = (
  err: Error | AppError | any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const timestamp = new Date().toISOString();

  // 1. AppError and custom subclasses
  if (err instanceof AppError) {
    const responseObj: any = {
      success: false,
      error: {
        code: err.code || ErrorCode.BAD_REQUEST,
        message: err.message,
        details: err.details || null,
        timestamp,
      },
    };

    // For backward compatibility if someone checks err.errors
    if (err instanceof ValidationError && err.errors && !err.details) {
      responseObj.error.details = err.errors;
    }

    return res.status(err.statusCode).json(responseObj);
  }

  // 2. JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        code: ErrorCode.UNAUTHORIZED,
        message: SYSTEM_ERROR_MESSAGES.TOKEN_INVALID,
        details: null,
        timestamp,
      },
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: {
        code: ErrorCode.UNAUTHORIZED,
        message: SYSTEM_ERROR_MESSAGES.TOKEN_EXPIRED,
        details: null,
        timestamp,
      },
    });
  }

  // 3. Validation / Cast Errors
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: err.message || SYSTEM_ERROR_MESSAGES.VALIDATION_ERROR,
        details: null,
        timestamp,
      },
    });
  }

  // 4. Prisma database known errors
  if (err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    if (err.code === 'P2002') {
      const targetFields = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field';
      return res.status(409).json({
        success: false,
        error: {
          code: ErrorCode.CONFLICT,
          message: `A record with this ${targetFields} already exists.`,
          details: err.meta || null,
          timestamp,
        },
      });
    }

    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'The requested record could not be found.',
          details: null,
          timestamp,
        },
      });
    }
  }

  // 5. Default 500 Server Error
  console.error('[GlobalErrorHandler] Unhandled Exception:', err);

  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  const isProduction = process.env.NODE_ENV === 'production';

  return res.status(statusCode).json({
    success: false,
    error: {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: isProduction ? SYSTEM_ERROR_MESSAGES.INTERNAL_SERVER_ERROR : (err.message || SYSTEM_ERROR_MESSAGES.INTERNAL_SERVER_ERROR),
      details: isProduction ? null : { stack: err.stack },
      timestamp,
    },
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: ErrorCode.NOT_FOUND,
      message: `Route ${req.method} ${req.originalUrl} not found.`,
      details: null,
      timestamp: new Date().toISOString(),
    },
  });
};
