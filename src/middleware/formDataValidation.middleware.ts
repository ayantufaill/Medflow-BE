import { validationResult, type ValidationChain } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/error.util';

/**
 * Parse FormData fields (for multipart/form-data)
 */
const parseFormDataFields = (body: any): any => {
  const parsed = { ...body };

  // Parse address if it's a string
  if (typeof parsed.address === 'string' && parsed.address) {
    try {
      parsed.address = JSON.parse(parsed.address);
    } catch (e) {
      // If parsing fails, try to create object from empty string
      if (parsed.address.trim() === '') {
        parsed.address = {};
      }
    }
  }

  // Parse businessHours if it's a string
  if (typeof parsed.businessHours === 'string' && parsed.businessHours) {
    try {
      parsed.businessHours = JSON.parse(parsed.businessHours);
    } catch (e) {
      // If parsing fails, set to empty object
      parsed.businessHours = {};
    }
  }

  // Parse practiceSettings if it's a string
  if (typeof parsed.practiceSettings === 'string' && parsed.practiceSettings) {
    try {
      parsed.practiceSettings = JSON.parse(parsed.practiceSettings);
    } catch (e) {
      // If parsing fails, set to empty object
      parsed.practiceSettings = {};
    }
  }

  // Parse appointmentBufferMinutes if it's a string
  if (typeof parsed.appointmentBufferMinutes === 'string' && parsed.appointmentBufferMinutes) {
    const parsedValue = parseInt(parsed.appointmentBufferMinutes, 10);
    if (!isNaN(parsedValue)) {
      parsed.appointmentBufferMinutes = parsedValue;
    }
  }

  return parsed;
};

/**
 * Validation middleware that handles FormData parsing
 */
export const validateFormData = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Parse FormData fields before validation
    req.body = parseFormDataFields(req.body);

    // Run validations
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

