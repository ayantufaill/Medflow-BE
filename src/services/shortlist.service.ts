import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';

export class ShortlistService {
  private mapShortlist(item: any) {
    return {
      ...item,
      ShortlistNum: item.ShortlistNum.toString(),
      PatNum: item.PatNum.toString(),
      ProvNum: item.ProvNum?.toString(),
      Procedures: item.Procedures ? JSON.parse(item.Procedures) : [],
    };
  }

  async getShortlistItems() {
    const items = await prisma.shortlist.findMany({
      orderBy: { CreatedAt: 'desc' }
    });
    
    return items.map(this.mapShortlist);
  }

  async createShortlistItem(data: any) {
    const { patientId, providerId, durationMins, preferredDay, preferredTime, procedures, notes } = data;
    
    const item = await prisma.shortlist.create({
      data: {
        PatNum: BigInt(patientId),
        ProvNum: providerId ? BigInt(providerId) : null,
        DurationMins: durationMins || null,
        PreferredDay: preferredDay || null,
        PreferredTime: preferredTime || null,
        Procedures: procedures ? JSON.stringify(procedures) : null,
        Notes: notes || null
      }
    });

    return this.mapShortlist(item);
  }

  async deleteShortlistItem(id: string) {
    const existing = await prisma.shortlist.findUnique({
      where: { ShortlistNum: BigInt(id) }
    });

    if (!existing) {
      throw new NotFoundError('Shortlist item not found');
    }

    await prisma.shortlist.delete({
      where: { ShortlistNum: BigInt(id) }
    });
    
    return { success: true };
  }
}

export const shortlistService = new ShortlistService();
