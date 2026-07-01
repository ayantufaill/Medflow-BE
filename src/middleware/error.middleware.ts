import type { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/error.util';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    const errorResponse: any = {
      success: false,
      error: {
        message: err.message,
      },
    };

    // Include validation errors if available (for ValidationError)
    if (err instanceof ValidationError && (err as any).errors) {
      errorResponse.error.errors = (err as any).errors;
      // Also create a combined message from validation errors
      const errorMessages: string[] = [];
      Object.values((err as any).errors).forEach((fieldErrors: any) => {
        if (Array.isArray(fieldErrors)) {
          errorMessages.push(...fieldErrors);
        }
      });
      if (errorMessages.length > 0) {
        errorResponse.error.message = errorMessages.join('. ');
      }
    }


    return res.status(err.statusCode).json(errorResponse);
  }

  // Handle validation errors from express-validator
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: {
        message: err.message || 'Validation error',
      },
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Invalid token',
      },
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Token expired',
      },
    });
  }

  // Default error
  console.error('Error:', err);
  return res.status(500).json({
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    },
  });
};

export class UnprocessableEntityError extends AppError {
  constructor(message: string = 'Unprocessable entity') {
    super(422, message);
    this.name = 'UnprocessableEntityError';
  }
}

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.originalUrl} not found`,
    },
  });
};

