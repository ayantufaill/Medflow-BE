import { Router } from 'express';
import { documentController } from '../controllers/document.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  documentIdValidator,
  patientIdParamValidator,
  appointmentIdParamValidator,
  documentQueryValidator,
  paginationQueryValidator,
  createDocumentValidator,
  updateDocumentValidator,
  attachToNoteValidator,
} from '../validators/document.validator';

const router = Router();

router.get(
  '/types',
  authenticate,
  documentController.getDocumentTypes
);

router.get(
  '/',
  authenticate,
  requirePermission('documents.read'),
  validate(documentQueryValidator),
  documentController.getAllDocuments
);

router.get(
  '/patient/:patientId',
  authenticate,
  requirePermission('documents.read'),
  validate([...patientIdParamValidator, ...paginationQueryValidator]),
  documentController.getDocumentsByPatient
);

router.get(
  '/appointment/:appointmentId',
  authenticate,
  requirePermission('documents.read'),
  validate(appointmentIdParamValidator),
  documentController.getDocumentsByAppointment
);

router.get(
  '/:documentId',
  authenticate,
  requirePermission('documents.read'),
  validate(documentIdValidator),
  documentController.getDocumentById
);

router.post(
  '/',
  authenticate,
  requirePermission('documents.create'),
  validate(createDocumentValidator),
  documentController.createDocument
);

router.put(
  '/:documentId',
  authenticate,
  requirePermission('documents.update'),
  validate([...documentIdValidator, ...updateDocumentValidator]),
  documentController.updateDocument
);

router.post(
  '/:documentId/attach-to-note',
  authenticate,
  requirePermission('documents.update'),
  validate([...documentIdValidator, ...attachToNoteValidator]),
  documentController.attachToNote
);

router.delete(
  '/:documentId',
  authenticate,
  requirePermission('documents.delete'),
  validate(documentIdValidator),
  documentController.deleteDocument
);

export default router;
