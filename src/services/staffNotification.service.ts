import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { NotFoundError } from '../utils/error.util';
import { emitToUser } from '../sockets/socket';

const mapNotification = (row: {
  NotificationNum: bigint;
  UserNum: bigint | null;
  Type: string;
  Title: string;
  Body: string | null;
  RelatedType: string | null;
  RelatedId: bigint | null;
  IsRead: boolean;
  DateTimeEntry: Date;
  ReadAt: Date | null;
}) => ({
  id: row.NotificationNum.toString(),
  userId: row.UserNum?.toString() ?? null,
  type: row.Type,
  title: row.Title,
  body: row.Body,
  relatedType: row.RelatedType,
  relatedId: row.RelatedId?.toString() ?? null,
  isRead: row.IsRead,
  createdAt: row.DateTimeEntry,
  readAt: row.ReadAt,
});

export class StaffNotificationService {
  async createAndEmit(params: {
    userNum: bigint;
    type: string;
    title: string;
    body?: string;
    relatedType?: string;
    relatedId?: bigint;
  }) {
    if (!prisma.notification) return null;
    const id = await getNextId('notification', 'NotificationNum');
    const notification = await prisma.notification.create({
      data: {
        NotificationNum: id,
        UserNum: params.userNum,
        Type: params.type,
        Title: params.title,
        Body: params.body,
        RelatedType: params.relatedType,
        RelatedId: params.relatedId,
      },
    });

    const mapped = mapNotification(notification);
    emitToUser(params.userNum.toString(), 'notification:new', mapped);
    return mapped;
  }

  async getForUser(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [rows, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { UserNum: BigInt(userId) },
        orderBy: { DateTimeEntry: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { UserNum: BigInt(userId) } }),
      prisma.notification.count({ where: { UserNum: BigInt(userId), IsRead: false } }),
    ]);

    return {
      notifications: rows.map(mapNotification),
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await prisma.notification.count({
      where: { UserNum: BigInt(userId), IsRead: false },
    });
    return { unreadCount };
  }

  async markAsRead(notificationId: string, userId: string) {
    const existing = await prisma.notification.findUnique({
      where: { NotificationNum: BigInt(notificationId) },
    });
    if (!existing || existing.UserNum?.toString() !== userId) {
      throw new NotFoundError('Notification not found');
    }

    const updated = await prisma.notification.update({
      where: { NotificationNum: existing.NotificationNum },
      data: { IsRead: true, ReadAt: new Date() },
    });
    return mapNotification(updated);
  }

  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { UserNum: BigInt(userId), IsRead: false },
      data: { IsRead: true, ReadAt: new Date() },
    });
    return { message: 'All notifications marked as read' };
  }
}

export const staffNotificationService = new StaffNotificationService();
