import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../src/services/appointment.service', () => ({
  appointmentService: { createAppointment: vi.fn().mockResolvedValue({ id: '1' }) },
}));
vi.mock('../src/services/patient-workspace.service', () => ({ patientWorkspaceService: {} }));
vi.mock('../src/utils/activity-logger.util', () => ({ logActivityFromRequest: vi.fn() }));

import { appointmentController } from '../src/controllers/appointment.controller';
import { appointmentService } from '../src/services/appointment.service';

describe('Appointment creation branch selection', () => {
  it.each([
    { bodyBranch: undefined, headerBranch: '2', expected: '2' },
    { bodyBranch: '1', headerBranch: '2', expected: '1' },
    { bodyBranch: undefined, headerBranch: undefined, expected: undefined },
  ])('uses body $bodyBranch / header $headerBranch as branch $expected', async ({ bodyBranch, headerBranch, expected }) => {
    vi.mocked(appointmentService.createAppointment).mockClear();
    const req = {
      userId: 'user',
      body: { branchId: bodyBranch, appointmentDate: '2026-10-23', startTime: '10:40' },
      header: vi.fn().mockReturnValue(headerBranch),
      branchAccess: { clinicIds: [1n, 2n] },
    } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn();

    await appointmentController.createAppointment(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(appointmentService.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: expected }), 'user'
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects a selected header branch outside the user’s access', async () => {
    vi.mocked(appointmentService.createAppointment).mockClear();
    const req = {
      userId: 'user', body: {}, header: vi.fn().mockReturnValue('3'),
      branchAccess: { clinicIds: [1n, 2n] },
    } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;

    await appointmentController.createAppointment(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(appointmentService.createAppointment).not.toHaveBeenCalled();
  });
});
