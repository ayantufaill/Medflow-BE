import type { Request, Response, NextFunction } from 'express';
import { taskService } from '../services/task.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class TaskController {
  async createTask(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId as string;
      const task = await taskService.createTask(req.body, userId);

      if (userId) {
        await logActivityFromRequest(req, 'created', 'task', task.TaskNum?.toString() || '');
      }

      res.status(201).json({
        success: true,
        data: { task },
        message: 'Task created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const status = req.query.status as string | undefined;
      const taskListNum = req.query.taskListNum as string | undefined;
      const assignedTo = req.query.assignedTo as string | undefined;
      const createdDateFrom = req.query.createdDateFrom as string | undefined;
      const createdDateTo = req.query.createdDateTo as string | undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;

      const filters = {
        page,
        limit,
        status,
        taskListNum,
        assignedTo,
        createdDateFrom,
        createdDateTo,
        sortBy,
        sortOrder,
      };

      const result = await taskService.getAllTasks(filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTaskById(req: Request, res: Response, next: NextFunction) {
    try {
      const { taskId } = req.params;
      const task = await taskService.getTaskById(taskId);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'task', taskId);
      }

      res.status(200).json({
        success: true,
        data: { task },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateTask(req: Request, res: Response, next: NextFunction) {
    try {
      const { taskId } = req.params;
      const userId = req.userId as string;

      const task = await taskService.updateTask(taskId, req.body, userId);

      if (userId) {
        await logActivityFromRequest(req, 'updated', 'task', taskId);
      }

      res.status(200).json({
        success: true,
        data: { task },
        message: 'Task updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteTask(req: Request, res: Response, next: NextFunction) {
    try {
      const { taskId } = req.params;
      const userId = req.userId as string;

      await taskService.deleteTask(taskId, userId);

      if (userId) {
        await logActivityFromRequest(req, 'deleted', 'task', taskId);
      }

      res.status(200).json({
        success: true,
        message: 'Task deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async addComment(req: Request, res: Response, next: NextFunction) {
    try {
      const { taskId } = req.params;
      const userId = req.userId as string;
      const { text, comment } = req.body;

      const noteText = text || comment;

      const note = await taskService.addComment(taskId, noteText, userId);

      if (userId) {
        await logActivityFromRequest(req, 'updated', 'task', taskId);
      }

      res.status(201).json({
        success: true,
        data: { comment: note },
        message: 'Comment added successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateTaskStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { taskId } = req.params;
      const userId = req.userId as string;
      const { status, TaskStatus } = req.body;

      const statusVal = status !== undefined ? parseInt(status, 10) : parseInt(TaskStatus, 10);

      const task = await taskService.updateStatus(taskId, statusVal, userId);

      if (userId) {
        await logActivityFromRequest(req, 'updated', 'task', taskId);
      }

      res.status(200).json({
        success: true,
        data: { task },
        message: 'Task status updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const taskController = new TaskController();
