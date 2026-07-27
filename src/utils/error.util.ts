import { ErrorCode } from '../constants/errorCodes';
import { SYSTEM_ERROR_MESSAGES } from '../constants/systemErrorMessages';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details: any;
  public isOperational: boolean;

  constructor(
    statusCode: number = 500,
    message: string = SYSTEM_ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    code: string = ErrorCode.INTERNAL_SERVER_ERROR,
    details: any = null,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string = SYSTEM_ERROR_MESSAGES.VALIDATION_ERROR,
    details?: Record<string, string[]>,
    code: string = ErrorCode.VALIDATION_ERROR
  ) {
    super(400, message, code, details);
    this.name = 'ValidationError';
  }

  get errors(): Record<string, string[]> | undefined {
    return this.details;
  }
}

export class BadRequestError extends AppError {
  constructor(
    message: string = SYSTEM_ERROR_MESSAGES.BAD_REQUEST,
    code: string = ErrorCode.BAD_REQUEST,
    details: any = null
  ) {
    super(400, message, code, details);
    this.name = 'BadRequestError';
  }
}

export class AuthenticationError extends AppError {
  constructor(
    message: string = SYSTEM_ERROR_MESSAGES.UNAUTHORIZED,
    code: string = ErrorCode.UNAUTHORIZED,
    details: any = null
  ) {
    super(401, message, code, details);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(
    message: string = SYSTEM_ERROR_MESSAGES.FORBIDDEN,
    code: string = ErrorCode.FORBIDDEN,
    details: any = null
  ) {
    super(403, message, code, details);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(
    message: string = SYSTEM_ERROR_MESSAGES.NOT_FOUND,
    code: string = ErrorCode.NOT_FOUND,
    details: any = null
  ) {
    super(404, message, code, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(
    message: string = SYSTEM_ERROR_MESSAGES.CONFLICT,
    code: string = ErrorCode.CONFLICT,
    details: any = null
  ) {
    super(409, message, code, details);
    this.name = 'ConflictError';
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(
    message: string = SYSTEM_ERROR_MESSAGES.UNPROCESSABLE_ENTITY,
    code: string = ErrorCode.UNPROCESSABLE_ENTITY,
    details: any = null
  ) {
    super(422, message, code, details);
    this.name = 'UnprocessableEntityError';
  }
}

export class RateLimitError extends AppError {
  constructor(
    message: string = SYSTEM_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
    code: string = ErrorCode.RATE_LIMIT_EXCEEDED,
    details: any = null
  ) {
    super(429, message, code, details);
    this.name = 'RateLimitError';
  }
}

export class NotImplementedError extends AppError {
  constructor(
    message: string = SYSTEM_ERROR_MESSAGES.NOT_IMPLEMENTED,
    code: string = ErrorCode.NOT_IMPLEMENTED,
    details: any = null
  ) {
    super(501, message, code, details);
    this.name = 'NotImplementedError';
  }
}