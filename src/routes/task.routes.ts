import { Router } from 'express';
import { taskController } from '../controllers/task.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createTaskValidator,
  updateTaskValidator,
  taskIdValidator,
  taskQueryValidator,
} from '../validators/task.validator';

const router = Router();

// Global middleware stack for task routes
router.use(authenticate);
router.use(resolveBranchAccess);
router.use(enterTenantContext);

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: Get all tasks with filters and pagination
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/',
  validate(taskQueryValidator),
  taskController.getAllTasks.bind(taskController)
);

/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: Create a new task (Admin only)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  requireRoles('Admin'),
  validate(createTaskValidator),
  taskController.createTask.bind(taskController)
);

/**
 * @swagger
 * /tasks/{taskId}:
 *   get:
 *     summary: Get task details by ID
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/:taskId',
  validate(taskIdValidator),
  taskController.getTaskById.bind(taskController)
);

/**
 * @swagger
 * /tasks/{taskId}:
 *   put:
 *     summary: Update task (Admin only)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/:taskId',
  requireRoles('Admin'),
  validate([...taskIdValidator, ...updateTaskValidator]),
  taskController.updateTask.bind(taskController)
);

/**
 * @swagger
 * /tasks/{taskId}:
 *   delete:
 *     summary: Delete task (Admin only)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:taskId',
  requireRoles('Admin'),
  validate(taskIdValidator),
  taskController.deleteTask.bind(taskController)
);

/**
 * @swagger
 * /tasks/{taskId}/comments:
 *   post:
 *     summary: Add a comment to a task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:taskId/comments',
  validate(taskIdValidator),
  taskController.addComment.bind(taskController)
);

/**
 * @swagger
 * /tasks/{taskId}/status:
 *   patch:
 *     summary: Update task status
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/:taskId/status',
  validate(taskIdValidator),
  taskController.updateTaskStatus.bind(taskController)
);

export default router;
