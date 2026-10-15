import { describe, expect, it } from 'vitest';
import { validateGroupFields } from '../src/utils/insurance-group-validation.util';

describe('insurance group validation', () => {
  it('normalizes and validates employer group fields', () => {
    const result = validateGroupFields({ groupNumber: '  ab-001 ', groupName: 'Blue Cross & Co.' });
    expect(result.groupNumber).toBe('AB-001');
    expect(result.errors).toEqual({});
    expect(validateGroupFields({ groupNumber: 'A B', groupName: 'ACME' }).errors.groupNumber).toBeTruthy();
    expect(validateGroupFields({ groupNumber: 'AB-001', groupName: 'ACME' }).errors).toEqual({});
  });

  it('requires both fields and rejects unsupported characters', () => {
    expect(validateGroupFields({}).errors.groupNumber).toBeTruthy();
    expect(validateGroupFields({}).errors.groupName).toBeTruthy();
    expect(validateGroupFields({ groupNumber: 'ABC' }).errors.groupName).toBeTruthy();
    expect(validateGroupFields({ groupNumber: 'ABC', groupName: '<script>' }).errors.groupName).toBeTruthy();
  });
});
