import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';

export class ShortlistService {
  private mapShortlist(item: any) {
    let parsedCustomFields = item.CustomFields;
    if (typeof parsedCustomFields === 'string') {
      try {
        parsedCustomFields = JSON.parse(parsedCustomFields);
      } catch (e) {
        // ignore
      }
    }
    return {
      ...item,
      ShortlistNum: item.ShortlistNum.toString(),
      PatNum: item.PatNum.toString(),
      ProvNum: item.ProvNum?.toString(),
      RoomId: item.RoomId?.toString(),
      CustomFields: parsedCustomFields || {},
    };
  }

  async getShortlistItems() {
    const items = await prisma.shortlist.findMany({
      orderBy: { CreatedAt: 'desc' }
    });
    
    return items.map(this.mapShortlist);
  }

  async createShortlistItem(data: any) {
    const { 
      patientId, 
      patientName,
      appointmentDate,
      startTime,
      endTime,
      durationMins, 
      status,
      notes,
      providerId, 
      roomId,
      customFields
    } = data;
    
    const item = await prisma.shortlist.create({
      data: {
        PatNum: BigInt(patientId),
        PatientName: patientName || null,
        AppointmentDate: appointmentDate || null,
        StartTime: startTime || null,
        EndTime: endTime || null,
        DurationMins: durationMins || null,
        Status: status || null,
        Notes: notes || null,
        ProvNum: providerId ? BigInt(providerId) : null,
        RoomId: roomId ? BigInt(roomId) : null,
        CustomFields: customFields || null
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
