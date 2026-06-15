import { Router } from 'express';
import { aiConversationController } from '../controllers/ai-conversation.controller';
import { authenticate } from '../middleware/auth.middleware';
import { body } from 'express-validator';
import { validate } from '../middleware/validation.middleware';

const router = Router();

// Secure all endpoints with authentication middleware
router.use(authenticate);

const aiMessageValidator = [
  body('message')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Message content is required'),
];

/**
 * @swagger
 * /ai-conversation:
 *   post:
 *     summary: Interact with the AI assistant for clinical suggestions
 *     tags: [AI Conversation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string }
 *     responses:
 *       200:
 *         description: AI assistant response
 */
router.post('/', validate(aiMessageValidator), aiConversationController.getAiResponse.bind(aiConversationController));

export default router;
