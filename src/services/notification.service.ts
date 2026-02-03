import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';

const parseJson = <T>(value?: string | null): T => {
  if (!value) return {} as T;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
};

const buildJson = (value: Record<string, unknown>) => JSON.stringify(value);

type NotificationMeta = {
  userId?: string;
  type?: string;
  title?: string;
  message?: string;
  isRead?: boolean;
  data?: any;
};

export class NotificationService {
  async getAllNotifications(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const rows = await prisma.securitylog.findMany({
      where: { UserNum: BigInt(userId) },
      orderBy: { LogDateTime: 'desc' },
      skip,
      take: limit,
    });

    const notifications = rows
      .map((row) => {
        const meta = parseJson<NotificationMeta>(row.LogText);
        if (meta.type !== 'notification') return null;
        return {
          _id: row.SecurityLogNum.toString(),
          userId: meta.userId ?? userId,
          type: meta.type ?? 'system',
          title: meta.title ?? 'Notification',
          message: meta.message ?? '',
          isRead: meta.isRead ?? false,
          data: meta.data ?? null,
          createdAt: row.LogDateTime ?? null,
        };
      })
      .filter(Boolean);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total: notifications.length,
        pages: Math.ceil(notifications.length / limit),
      },
    };
  }

  async createNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: any;
  }) {
    const logNum = await getNextId('securitylog', 'SecurityLogNum');
    const payload: NotificationMeta = {
      userId: data.userId,
      type: 'notification',
      title: data.title,
      message: data.message,
      isRead: false,
      data: data.data ?? null,
    };

    const log = await prisma.securitylog.create({
      data: {
        SecurityLogNum: logNum,
        UserNum: BigInt(data.userId),
        LogDateTime: new Date(),
        LogText: buildJson(payload),
        LogSource: 1,
      },
    });

    return log;
  }

  async markAsRead(notificationId: string) {
    const log = await prisma.securitylog.findUnique({
      where: { SecurityLogNum: BigInt(notificationId) },
    });
    if (!log) {
      throw new NotFoundError('Notification not found');
    }

    const meta = parseJson<NotificationMeta>(log.LogText);
    const updated = await prisma.securitylog.update({
      where: { SecurityLogNum: log.SecurityLogNum },
      data: {
        LogText: buildJson({ ...meta, isRead: true }),
      },
    });

    return updated;
  }

  async deleteNotification(notificationId: string) {
    const log = await prisma.securitylog.findUnique({
      where: { SecurityLogNum: BigInt(notificationId) },
    });
    if (!log) {
      throw new NotFoundError('Notification not found');
    }

    await prisma.securitylog.delete({ where: { SecurityLogNum: log.SecurityLogNum } });
    return { message: 'Notification deleted successfully' };
  }
}

export const notificationService = new NotificationService();
