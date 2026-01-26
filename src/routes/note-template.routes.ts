import { Router } from 'express';
import { noteTemplateController } from '../controllers/note-template.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  noteTemplateIdValidator,
  createNoteTemplateValidator,
  updateNoteTemplateValidator,
  duplicateNoteTemplateValidator,
  noteTemplateQueryValidator,
  specialtyParamValidator,
} from '../validators/note-template.validator';

const router = Router();

router.get(
  '/',
  authenticate,
  validate(noteTemplateQueryValidator),
  noteTemplateController.getAllNoteTemplates
);

router.get(
  '/active',
  authenticate,
  noteTemplateController.getActiveTemplates
);

router.get(
  '/specialty/:specialty',
  authenticate,
  validate(specialtyParamValidator),
  noteTemplateController.getTemplatesBySpecialty
);

router.get(
  '/:noteTemplateId',
  authenticate,
  validate(noteTemplateIdValidator),
  noteTemplateController.getNoteTemplateById
);

router.post(
  '/',
  authenticate,
  requireRoles('Admin', 'Doctor'),
  validate(createNoteTemplateValidator),
  noteTemplateController.createNoteTemplate
);

router.post(
  '/:noteTemplateId/duplicate',
  authenticate,
  requireRoles('Admin', 'Doctor'),
  validate([...noteTemplateIdValidator, ...duplicateNoteTemplateValidator]),
  noteTemplateController.duplicateNoteTemplate
);

router.put(
  '/:noteTemplateId',
  authenticate,
  requireRoles('Admin', 'Doctor'),
  validate([...noteTemplateIdValidator, ...updateNoteTemplateValidator]),
  noteTemplateController.updateNoteTemplate
);

router.patch(
  '/:noteTemplateId/status',
  authenticate,
  requireRoles('Admin', 'Doctor'),
  validate(noteTemplateIdValidator),
  noteTemplateController.toggleNoteTemplateStatus
);

router.delete(
  '/:noteTemplateId',
  authenticate,
  requireRoles('Admin', 'Doctor'),
  validate(noteTemplateIdValidator),
  noteTemplateController.deleteNoteTemplate
);

export default router;
