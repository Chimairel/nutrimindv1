import prisma from '@/lib/prisma';

export class NotificationService {
  /**
   * Returns all notifications for a user, ordered newest first.
   */
  static async getUserNotifications(userId: string, limit = 50) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Returns the count of unread notifications.
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Marks a single notification as read.
   */
  static async markAsRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  /**
   * Marks all notifications as read for the user.
   */
  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  /**
   * Creates a notification for a user.
   */
  static async create(userId: string, title: string, message: string, type: any) {
    return prisma.notification.create({
      data: { userId, title, message, type },
    });
  }
}
