import { validationResult, type ValidationChain } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/error.util';

export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMap: Record<string, string[]> = {};
      errors.array().forEach((error: any) => {
        // Handle nested fields like address.line1
        const field = error.type === 'field' ? error.path : 'general';
        if (!errorMap[field]) {
          errorMap[field] = [];
        }
        errorMap[field].push(error.msg);
      });

      // Create a more descriptive error message
      const errorMessages: string[] = [];
      Object.entries(errorMap).forEach(([field, messages]) => {
        const fieldName = field.replace(/([A-Z])/g, ' $1').replace(/\./g, ' ').trim();
        const capitalizedField = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
        errorMessages.push(`${capitalizedField}: ${messages[0]}`);
      });

      const errorMessage = errorMessages.length > 0 
        ? errorMessages.join('. ') 
        : 'Validation failed. Please check your input.';

      return next(new ValidationError(errorMessage, errorMap));
    }

    next();
  };
};

