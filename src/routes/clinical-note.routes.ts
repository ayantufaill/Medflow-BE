import { Router } from 'express';
import { clinicalNoteController } from '../controllers/clinical-note.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  clinicalNoteIdValidator,
  patientIdParamValidator,
  appointmentIdParamValidator,
  providerIdParamValidator,
  templateIdParamValidator,
  createClinicalNoteValidator,
  updateClinicalNoteValidator,
  saveDraftValidator,
  createFromTemplateValidator,
  attachmentValidator,
  clinicalNoteQueryValidator,
  paginationQueryValidator,
} from '../validators/clinical-note.validator';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate(clinicalNoteQueryValidator),
  clinicalNoteController.getAllClinicalNotes
);

router.get(
  '/patient/:patientId',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate([...patientIdParamValidator, ...paginationQueryValidator]),
  clinicalNoteController.getClinicalNotesByPatient
);

router.get(
  '/patient/:patientId/medical-history',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate(patientIdParamValidator),
  clinicalNoteController.getPatientMedicalHistory
);

router.get(
  '/appointment/:appointmentId',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate(appointmentIdParamValidator),
  clinicalNoteController.getClinicalNoteByAppointment
);

router.get(
  '/unsigned/:providerId',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate(providerIdParamValidator),
  clinicalNoteController.getUnsignedNotes
);

router.get(
  '/:clinicalNoteId',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate(clinicalNoteIdValidator),
  clinicalNoteController.getClinicalNoteById
);

router.post(
  '/',
  authenticate,
  requirePermission('clinical-notes.create'),
  validate(createClinicalNoteValidator),
  clinicalNoteController.createClinicalNote
);

router.post(
  '/from-template/:templateId',
  authenticate,
  requirePermission('clinical-notes.create'),
  validate([...templateIdParamValidator, ...createFromTemplateValidator]),
  clinicalNoteController.createNoteFromTemplate
);

router.put(
  '/:clinicalNoteId',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate([...clinicalNoteIdValidator, ...updateClinicalNoteValidator]),
  clinicalNoteController.updateClinicalNote
);

router.put(
  '/:clinicalNoteId/draft',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate([...clinicalNoteIdValidator, ...saveDraftValidator]),
  clinicalNoteController.saveDraft
);

router.post(
  '/:clinicalNoteId/sign',
  authenticate,
  requirePermission('clinical-notes.sign'),
  validate(clinicalNoteIdValidator),
  clinicalNoteController.signClinicalNote
);

router.post(
  '/:clinicalNoteId/attachments',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate([...clinicalNoteIdValidator, ...attachmentValidator]),
  clinicalNoteController.addAttachment
);

router.delete(
  '/:clinicalNoteId/attachments',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate([...clinicalNoteIdValidator, ...attachmentValidator]),
  clinicalNoteController.removeAttachment
);

router.delete(
  '/:clinicalNoteId',
  authenticate,
  requirePermission('clinical-notes.delete'),
  validate(clinicalNoteIdValidator),
  clinicalNoteController.deleteClinicalNote
);

export default router;
