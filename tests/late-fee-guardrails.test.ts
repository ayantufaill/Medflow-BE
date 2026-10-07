import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db';
import { LateFeeGuardrails } from '../src/services/late-fee-guardrails.service';

const roundCurrency = (value: number): number => Math.round((Number(value) || 0) * 100) / 100;

let patientId: bigint;
const cleanup: Array<() => Promise<unknown>> = [];

describe('LateFeeGuardrails', () => {
  beforeAll(async () => {
    patientId = await prisma.patient.count();
    await prisma.patient.create({
      data: {
        PatNum: BigInt(patientId),
        FName: 'Test',
        LName: `LateFee${patientId}`,
        Birthdate: new Date('1990-01-15'),
        PatStatus: 1,
      },
    });
    cleanup.push(() => prisma.patient.delete({ where: { PatNum: BigInt(patientId) } }));
  });

  afterAll(async () => {
    for (const fn of cleanup.reverse()) {
      await fn().catch(() => undefined);
    }
  });

  it('exists and has calculatePatientFee method', () => {
    expect(LateFeeGuardrails.calculatePatientFee).toBeDefined();
  });

  it('has checkEligibility method', () => {
    expect(LateFeeGuardrails.checkEligibility).toBeDefined();
  });

  it('has calculateFee method', () => {
    expect(LateFeeGuardrails.calculateFee).toBeDefined();
  });
});