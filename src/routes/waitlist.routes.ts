import { Router } from 'express';
import { waitlistController } from '../controllers/waitlist.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  waitlistEntryIdValidator,
  createWaitlistEntryValidator,
  updateWaitlistEntryValidator,
  waitlistQueryValidator,
  convertWaitlistToAppointmentValidator,
} from '../validators/waitlist.validator';

const router = Router();

// All waitlist routes require authentication
router.use(authenticate);

// Get all waitlist entries
router.get(
  '/',
  validate(waitlistQueryValidator),
  waitlistController.getAllWaitlistEntries.bind(waitlistController)
);

// Get waitlist entry by ID
router.get(
  '/:waitlistEntryId',
  validate(waitlistEntryIdValidator),
  waitlistController.getWaitlistEntryById.bind(waitlistController)
);

// Create waitlist entry
// Front Desk, Admin can create waitlist entries
router.post(
  '/',
  requireRoles('Front Desk', 'Admin'),
  validate(createWaitlistEntryValidator),
  waitlistController.createWaitlistEntry.bind(waitlistController)
);

// Update waitlist entry
// Front Desk, Admin can update waitlist entries
router.put(
  '/:waitlistEntryId',
  requireRoles('Front Desk', 'Admin'),
  validate([...waitlistEntryIdValidator, ...updateWaitlistEntryValidator]),
  waitlistController.updateWaitlistEntry.bind(waitlistController)
);

// Mark waitlist entry as called
// Front Desk, Admin can mark as called
router.post(
  '/:waitlistEntryId/called',
  requireRoles('Front Desk', 'Admin'),
  validate(waitlistEntryIdValidator),
  waitlistController.markAsCalled.bind(waitlistController)
);

// Mark waitlist entry as scheduled
// Front Desk, Admin can mark as scheduled
router.post(
  '/:waitlistEntryId/scheduled',
  requireRoles('Front Desk', 'Admin'),
  validate(waitlistEntryIdValidator),
  waitlistController.markAsScheduled.bind(waitlistController)
);

// Convert waitlist entry to appointment
// Front Desk, Admin can convert waitlist to appointment
router.post(
  '/:waitlistEntryId/convert-to-appointment',
  requireRoles('Front Desk', 'Admin'),
  validate([...waitlistEntryIdValidator, ...convertWaitlistToAppointmentValidator]),
  waitlistController.convertToAppointment.bind(waitlistController)
);

// Delete waitlist entry
// Front Desk, Admin can delete waitlist entries
router.delete(
  '/:waitlistEntryId',
  requireRoles('Front Desk', 'Admin'),
  validate(waitlistEntryIdValidator),
  waitlistController.deleteWaitlistEntry.bind(waitlistController)
);

export default router;
