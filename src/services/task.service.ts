import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { NotFoundError, BadRequestError } from '../utils/error.util';
import { getUsersMeta } from '../utils/opendental-auth.util';

export function serializeBigInt<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

export interface CreateTaskInput {
  Descript: string;
  TaskListNum?: string | number;
  PriorityDefNum?: string | number;
  DateTask?: string | Date;
  dueTime?: string;
  KeyNum?: string | number;
  assignedTo?: string | number;
  IsRepeating?: number;
  ReminderFrequency?: number;
  ReminderType?: number;
  comment?: string;
}

export interface UpdateTaskInput {
  Descript?: string;
  TaskListNum?: string | number;
  PriorityDefNum?: string | number;
  DateTask?: string | Date;
  dueTime?: string;
  KeyNum?: string | number;
  assignedTo?: string | number;
  IsRepeating?: number;
  ReminderFrequency?: number;
  ReminderType?: number;
  comment?: string;
  TaskStatus?: number;
}

export interface TaskFilters {
  status?: string | number;
  taskListNum?: string | number;
  assignedTo?: string | number;
  createdDateFrom?: string;
  createdDateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isRepeating?: boolean;
}

export class TaskService {
  /**
   * Helper include query for task relations
   */
  private defaultInclude = {
    userod: true,
    patient: true,
    tasknote: {
      include: {
        userod: true,
      },
      orderBy: {
        DateTimeNote: 'asc' as const,
      },
    },
    definition_task_PriorityDefNumTodefinition: true,
    tasklist: true,
  };

  /**
   * Helper to map raw database fields to frontend-expected fields
   */
  private mapTaskOutput(task: any, userMetaMap?: Record<string, Record<string, any>>) {
    if (!task) return task;
    
    const assignedUserRaw = task.userod;
    const creatorRaw = task.tasknote && task.tasknote.length > 0 ? task.tasknote[0].userod : null;

    const assignedMeta = assignedUserRaw && userMetaMap ? userMetaMap[assignedUserRaw.UserNum.toString()] : null;
    const creatorMeta = creatorRaw && userMetaMap ? userMetaMap[creatorRaw.UserNum.toString()] : null;

    return {
      ...task,
      assignedUser: assignedUserRaw ? { ...assignedUserRaw, firstName: assignedMeta?.firstName, lastName: assignedMeta?.lastName } : null,
      creator: creatorRaw ? { ...creatorRaw, firstName: creatorMeta?.firstName, lastName: creatorMeta?.lastName } : null,
    };
  }

  /**
   * Create a new task and optionally an initial comment
   */
  async createTask(data: CreateTaskInput, userId: string) {
    const taskNum = await getNextId('task', 'TaskNum');

    const assignedUserNumRaw = data.assignedTo
      ? BigInt(data.assignedTo)
      : userId
      ? BigInt(userId)
      : null;
    const assignedUserNum = assignedUserNumRaw === 0n ? null : assignedUserNumRaw;

    const keyNumRaw = data.KeyNum ? BigInt(data.KeyNum) : null;
    const keyNum = keyNumRaw === 0n ? null : keyNumRaw;

    const taskListNumRaw = data.TaskListNum ? BigInt(data.TaskListNum) : null;
    const taskListNum = taskListNumRaw === 0n ? null : taskListNumRaw;

    const priorityDefNumRaw = data.PriorityDefNum ? BigInt(data.PriorityDefNum) : null;
    const priorityDefNum = priorityDefNumRaw === 0n ? null : priorityDefNumRaw;

    const dateTask = data.DateTask ? new Date(data.DateTask) : null;

    console.log('[DEBUG createTask] taskListNum:', taskListNum, typeof taskListNum);
    console.log('[DEBUG createTask] data:', data);

    const newTask = await prisma.task.create({
      data: {
        TaskNum: taskNum,
        TaskListNum: taskListNum,
        DateTask: dateTask,
        KeyNum: keyNum,
        ObjectType: keyNum ? 1 : 0,
        Descript: data.Descript,
        TaskStatus: 0, // 0 = New
        UserNum: assignedUserNum,
        DateTimeEntry: new Date(),
        PriorityDefNum: priorityDefNum,
        IsRepeating: data.IsRepeating ?? 0,
        ReminderType: data.ReminderType ?? null,
        ReminderFrequency: data.ReminderFrequency ?? null,
      },
    });

    const initialNoteText = (data.comment && data.comment.trim()) ? data.comment.trim() : "Task created";
    const taskNoteNum = await getNextId('tasknote', 'TaskNoteNum');
    await prisma.tasknote.create({
      data: {
        TaskNoteNum: taskNoteNum,
        TaskNum: taskNum,
        UserNum: userId ? BigInt(userId) : null,
        DateTimeNote: new Date(),
        Note: initialNoteText,
      },
    });

    return this.getTaskById(newTask.TaskNum.toString());
  }

  /**
   * Get all tasks with filters, sorting, and pagination
   */
  async getAllTasks(filters: TaskFilters = {}) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filter by status
    if (filters.status !== undefined && filters.status !== '') {
      if (typeof filters.status === 'string' && filters.status.includes(',')) {
        const statusArray = filters.status
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
        where.TaskStatus = { in: statusArray };
      } else {
        const statusNum = typeof filters.status === 'number' ? filters.status : parseInt(filters.status as string, 10);
        if (!isNaN(statusNum)) {
          where.TaskStatus = statusNum;
        }
      }
    }

    // Filter by taskListNum
    if (filters.taskListNum) {
      where.TaskListNum = BigInt(filters.taskListNum);
    }

    // Filter by assignedTo user
    if (filters.assignedTo) {
      where.UserNum = BigInt(filters.assignedTo);
    }

    // Filter by created date range
    if (filters.createdDateFrom || filters.createdDateTo) {
      where.DateTimeEntry = {};
      if (filters.createdDateFrom) {
        where.DateTimeEntry.gte = new Date(filters.createdDateFrom);
      }
      if (filters.createdDateTo) {
        where.DateTimeEntry.lte = new Date(filters.createdDateTo);
      }
    }

    // Filter by IsRepeating
    if (filters.isRepeating !== undefined) {
      if (filters.isRepeating) {
        where.IsRepeating = { gt: 0 };
      } else {
        where.IsRepeating = 0;
      }
    }

    const sortBy = filters.sortBy || 'DateTimeEntry';
    const sortOrder = filters.sortOrder || 'desc';

    const validSortFields = ['TaskNum', 'DateTask', 'DateTimeEntry', 'DateTimeFinished', 'TaskStatus', 'PriorityDefNum'];
    const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'DateTimeEntry';

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: this.defaultInclude,
        orderBy: { [actualSortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const userNumsToFetch = new Set<bigint>();
    tasks.forEach(t => {
      if (t.userod?.UserNum) userNumsToFetch.add(t.userod.UserNum);
      if (t.tasknote?.[0]?.userod?.UserNum) userNumsToFetch.add(t.tasknote[0].userod.UserNum);
    });
    
    const userMetaMap = await getUsersMeta(Array.from(userNumsToFetch));

    return {
      tasks: serializeBigInt(tasks.map(t => this.mapTaskOutput(t, userMetaMap))),
    return {
      tasks: serializeBigInt(tasks),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get single task by ID
   */
  async getTaskById(taskId: string) {
    const taskNum = BigInt(taskId);
    const task = await prisma.task.findUnique({
      where: { TaskNum: taskNum },
      include: this.defaultInclude,
    });

    if (!task) {
      throw new NotFoundError(`Task with ID ${taskId} not found`);
    }

    const userNumsToFetch = new Set<bigint>();
    if (task.userod?.UserNum) userNumsToFetch.add(task.userod.UserNum);
    if (task.tasknote?.[0]?.userod?.UserNum) userNumsToFetch.add(task.tasknote[0].userod.UserNum);
    
    const userMetaMap = await getUsersMeta(Array.from(userNumsToFetch));

    return serializeBigInt(this.mapTaskOutput(task, userMetaMap));
  }

  /**
   * Update task
   */
  async updateTask(taskId: string, data: UpdateTaskInput, userId: string) {
    await this.getTaskById(taskId);
    const taskNum = BigInt(taskId);

    const updateData: any = {};

    if (data.Descript !== undefined) updateData.Descript = data.Descript;
    if (data.TaskListNum !== undefined) {
      if (data.TaskListNum === null || data.TaskListNum === '') {
        updateData.TaskListNum = null;
      } else {
        const taskListNumRaw = BigInt(data.TaskListNum);
        updateData.TaskListNum = taskListNumRaw === 0n ? null : taskListNumRaw;
      }
    }

    if (data.PriorityDefNum !== undefined) {
      if (data.PriorityDefNum === null || data.PriorityDefNum === '') {
        updateData.PriorityDefNum = null;
      } else {
        const priorityDefNumRaw = BigInt(data.PriorityDefNum);
        updateData.PriorityDefNum = priorityDefNumRaw === 0n ? null : priorityDefNumRaw;
      }
    }

    if (data.DateTask !== undefined) {
      updateData.DateTask = data.DateTask ? new Date(data.DateTask) : null;
    }

    if (data.KeyNum !== undefined) {
      if (data.KeyNum === null || data.KeyNum === '') {
        updateData.KeyNum = null;
        updateData.ObjectType = 0;
      } else {
        const keyNumRaw = BigInt(data.KeyNum);
        updateData.KeyNum = keyNumRaw === 0n ? null : keyNumRaw;
        updateData.ObjectType = updateData.KeyNum ? 1 : 0;
      }
    }

    if (data.assignedTo !== undefined) {
      if (data.assignedTo === null || data.assignedTo === '') {
        updateData.UserNum = null;
      } else {
        const assignedUserNumRaw = BigInt(data.assignedTo);
        updateData.UserNum = assignedUserNumRaw === 0n ? null : assignedUserNumRaw;
      }
    }

    if (data.IsRepeating !== undefined) updateData.IsRepeating = data.IsRepeating;
    if (data.ReminderFrequency !== undefined) updateData.ReminderFrequency = data.ReminderFrequency;
    if (data.ReminderType !== undefined) updateData.ReminderType = data.ReminderType;

    if (data.TaskStatus !== undefined) {
      updateData.TaskStatus = data.TaskStatus;
      if (data.TaskStatus === 1) {
        updateData.DateTimeFinished = new Date();
      } else {
        updateData.DateTimeFinished = null;
      }
    }

    await prisma.task.update({
      where: { TaskNum: taskNum },
      data: updateData,
    });

    if (data.comment && data.comment.trim()) {
      await this.addComment(taskId, data.comment, userId);
    }

    return this.getTaskById(taskId);
  }

  /**
   * Delete task with cascade cleanup of notes, ancestors, unreads, attachments, subscriptions
   */
  async deleteTask(taskId: string, userId: string) {
    await this.getTaskById(taskId);
    const taskNum = BigInt(taskId);

    await prisma.$transaction([
      prisma.tasknote.deleteMany({ where: { TaskNum: taskNum } }),
      prisma.taskancestor.deleteMany({ where: { TaskNum: taskNum } }),
      prisma.taskunread.deleteMany({ where: { TaskNum: taskNum } }),
      prisma.taskattachment.deleteMany({ where: { TaskNum: taskNum } }),
      prisma.tasksubscription.deleteMany({ where: { TaskNum: taskNum } }),
      prisma.task.delete({ where: { TaskNum: taskNum } }),
    ]);

    return true;
  }

  /**
   * Add a comment (tasknote) to a task
   */
  async addComment(taskId: string, text: string, userId: string) {
    await this.getTaskById(taskId);
    const taskNum = BigInt(taskId);

    if (!text || !text.trim()) {
      throw new BadRequestError('Comment text cannot be empty');
    }

    const taskNoteNum = await getNextId('tasknote', 'TaskNoteNum');
    const comment = await prisma.tasknote.create({
      data: {
        TaskNoteNum: taskNoteNum,
        TaskNum: taskNum,
        UserNum: userId ? BigInt(userId) : null,
        DateTimeNote: new Date(),
        Note: text.trim(),
      },
      include: {
        userod: true,
      },
    });

    return serializeBigInt(comment);
  }

  /**
   * Update task status (0 = New, 1 = Done, 2 = InProgress)
   */
  async updateStatus(taskId: string, status: number, userId: string) {
    await this.getTaskById(taskId);
    const taskNum = BigInt(taskId);

    const isFinished = status === 1;

    await prisma.task.update({
      where: { TaskNum: taskNum },
      data: {
        TaskStatus: status,
        DateTimeFinished: isFinished ? new Date() : null,
      },
    });

    return this.getTaskById(taskId);
  }
  /**
   * Get all task lists
   */
  async getTaskLists() {
    const taskLists = await prisma.tasklist.findMany({
      orderBy: { Descript: 'asc' },
    });
    return serializeBigInt(taskLists);
  }
}

export const taskService = new TaskService();
