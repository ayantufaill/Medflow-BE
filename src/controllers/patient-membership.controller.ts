import type { NextFunction, Request, Response } from 'express';
import { patientMembershipService } from '../services/patient-membership.service';

export class PatientMembershipController {
  async getPatientMemberships(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const memberships = await patientMembershipService.getPatientMemberships(patientId);
      res.status(200).json({ success: true, data: memberships });
    } catch (error) {
      next(error);
    }
  }

  async createPatientMembership(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const membership = await patientMembershipService.createPatientMembership(patientId, req.body);
      res.status(201).json({ success: true, data: membership });
    } catch (error) {
      next(error);
    }
  }

  async deletePatientMembership(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId, membershipId } = req.params;
      if (!patientId || !membershipId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID and Membership ID are required' } });
      }
      await patientMembershipService.deletePatientMembership(patientId, membershipId);
      res.status(200).json({ success: true, message: 'Patient membership deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const patientMembershipController = new PatientMembershipController();
