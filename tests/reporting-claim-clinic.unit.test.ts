import { describe, expect, it } from 'vitest';
import { claimClinicFromLines } from '../src/utils/claim-clinic.util';

describe('claim ownership from persisted source lines', () => {
  it('assigns the common procedure branch, including repeated lines', () => {
    expect(claimClinicFromLines([1n, 1n])).toBe(1n);
    expect(claimClinicFromLines([2n])).toBe(2n);
  });
  it('leaves mixed branches unassigned instead of taking the first', () => {
    expect(claimClinicFromLines([1n, 2n])).toBeNull();
  });
  it('does not guess a branch for missing or sentinel line ownership', () => {
    expect(claimClinicFromLines([])).toBeNull();
    expect(claimClinicFromLines([1n, null])).toBeNull();
    expect(claimClinicFromLines([undefined])).toBeNull();
    expect(claimClinicFromLines([0n])).toBeNull();
  });
});
