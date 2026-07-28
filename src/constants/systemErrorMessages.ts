export const SYSTEM_ERROR_MESSAGES = {
  VALIDATION_ERROR: 'Validation failed. Please check your inputs.',
  BAD_REQUEST: 'Bad request. Please verify the request data.',
  UNAUTHORIZED: 'Authentication required. Please log in to continue.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  TOKEN_INVALID: 'Invalid authentication token. Please log in again.',
  FORBIDDEN: 'Access denied. You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'Resource conflict occurred. A duplicate record already exists.',
  UNPROCESSABLE_ENTITY: 'Unable to process the request due to invalid data.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',
  INTERNAL_SERVER_ERROR: 'An unexpected server error occurred. Please try again later.',
  NOT_IMPLEMENTED: 'This feature is not implemented yet.',
} as const;
