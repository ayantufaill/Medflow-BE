import { Router } from 'express';
import { publicBookingController } from '../controllers/public-booking.controller';
import { validate } from '../middleware/validation.middleware';
import { publicSlotsRateLimiter, publicBookingRateLimiter } from '../middleware/rateLimit.middleware';
import {
  publicSlotsQueryValidator,
  publicGuestBookingValidator,
} from '../validators/public-booking.validator';

// Deliberately NO authenticate/resolveBranchAccess/enterTenantContext here —
// this router exists specifically for prospective patients who don't have
// an account yet. Each handler enters its own narrow, request-scoped RLS
// tenant context (see public-booking.service.ts) instead.
const router = Router();

/**
 * @swagger
 * /public/booking/slots:
 *   get:
 *     summary: Look up available appointment slots (no auth required)
 *     tags: [Public Booking]
 *     parameters:
 *       - in: query
 *         name: branchId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: providerId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: appointmentTypeId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: date
 *         required: true
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Available start-time slots
 *       400:
 *         description: Provider doesn't see patients at this branch, or isn't accepting new patients
 *       404:
 *         description: Branch or provider not found
 */
router.get(
  '/slots',
  publicSlotsRateLimiter,
  validate(publicSlotsQueryValidator),
  publicBookingController.getAvailableSlots.bind(publicBookingController)
);

/**
 * @swagger
 * /public/booking/appointments:
 *   post:
 *     summary: Book a slot as a guest (no auth required) — creates or reuses a patient record and reserves the slot pending staff confirmation
 *     tags: [Public Booking]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [branchId, providerId, appointmentTypeId, appointmentDate, startTime, firstName, lastName, dateOfBirth]
 *             properties:
 *               branchId: { type: string }
 *               providerId: { type: string }
 *               appointmentTypeId: { type: string }
 *               appointmentDate: { type: string, format: date }
 *               startTime: { type: string, example: "09:00" }
 *               chiefComplaint: { type: string }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               dateOfBirth: { type: string, format: date }
 *               phone: { type: string }
 *               email: { type: string }
 *     responses:
 *       201:
 *         description: Booking request received, pending staff confirmation
 *       400:
 *         description: Slot no longer available, or invalid request
 *       404:
 *         description: Branch or provider not found
 *       429:
 *         description: Too many booking attempts from this IP
 */
router.post(
  '/appointments',
  publicBookingRateLimiter,
  validate(publicGuestBookingValidator),
  publicBookingController.createGuestBooking.bind(publicBookingController)
);

export default router;
