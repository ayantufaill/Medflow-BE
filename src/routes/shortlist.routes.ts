import { Router } from 'express';
import { shortlistController } from '../controllers/shortlist.controller';
import { validate } from '../middleware/validation.middleware';
import { createShortlistValidator } from '../validators/shortlist.validator';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/shortlist:
 *   get:
 *     summary: Get all shortlist items
 *     tags: [Shortlist]
 *     responses:
 *       200:
 *         description: Array of shortlist items
 */
router.get('/', shortlistController.getShortlistItems);

/**
 * @swagger
 * /api/shortlist:
 *   post:
 *     summary: Add a new item to the shortlist
 *     tags: [Shortlist]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               patientId:
 *                 type: string
 *               providerId:
 *                 type: string
 *               durationMins:
 *                 type: number
 *               preferredDay:
 *                 type: string
 *               preferredTime:
 *                 type: string
 *               procedures:
 *                 type: array
 *                 items:
 *                   type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Shortlist item created
 */
router.post('/', validate(createShortlistValidator), shortlistController.createShortlistItem);

/**
 * @swagger
 * /api/shortlist/{id}:
 *   put:
 *     summary: Update an item in the shortlist
 *     tags: [Shortlist]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Shortlist item updated
 */
router.put('/:id', validate(createShortlistValidator), shortlistController.updateShortlistItem);

/**
 * @swagger
 * /api/shortlist/{id}:
 *   delete:
 *     summary: Remove an item from the shortlist
 *     tags: [Shortlist]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shortlist item deleted
 */
router.delete('/:id', shortlistController.deleteShortlistItem);

export default router;
