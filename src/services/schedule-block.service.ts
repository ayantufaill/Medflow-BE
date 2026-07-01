import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';

export class ScheduleBlockService {
  /**
   * Create a new schedule block
   */
  async createBlock(
    data: {
      roomId: string;
      date: string; // YYYY-MM-DD
      startTime: string; // HH:mm
      endTime: string; // HH:mm
      notes: string;
      color: string;
    },
    createdBy: string
  ) {
    const scheduleNum = await getNextId('schedule', 'ScheduleNum');
    const scheduleOpNum = await getNextId('scheduleop', 'ScheduleOpNum');

    // Parse date into local midnight
    const schedDate = new Date(`${data.date}T00:00:00.000Z`);

    // In prisma/MSSQL, @db.Time fields expect a Date object.
    const startDateTime = new Date(`1970-01-01T${data.startTime}:00Z`);
    const stopDateTime = new Date(`1970-01-01T${data.endTime}:00Z`);

    // Note field will store JSON metadata (notes & color)
    const blockMeta = {
      notes: data.notes,
      color: data.color
    };

    // 1. Create schedule record (SchedType = 2 is Blockout)
    const schedule = await prisma.schedule.create({
      data: {
        ScheduleNum: scheduleNum,
        SchedDate: schedDate,
        StartTime: startDateTime,
        StopTime: stopDateTime,
        SchedType: 2, // Blockout
        Note: JSON.stringify(blockMeta),
        Status: 0,
        DateTStamp: new Date(),
      },
    });

    // 2. Create scheduleop link to operatory (roomId)
    const operatoryNum = BigInt(data.roomId);
    await prisma.scheduleop.create({
      data: {
        ScheduleOpNum: scheduleOpNum,
        ScheduleNum: schedule.ScheduleNum,
        OperatoryNum: operatoryNum,
      },
    });

    const block = {
      _id: schedule.ScheduleNum.toString(),
      roomId: data.roomId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      notes: data.notes,
      color: data.color,
    };

    await logActivity(
      createdBy,
      'created',
      'schedule-blocks',
      block._id,
      undefined,
      block,
      undefined,
      undefined,
      'low'
    );

    return block;
  }

  /**
   * Get all schedule blocks for a specific date
   */
  async getBlocksForDate(dateStr: string) {
    const schedDate = new Date(`${dateStr}T00:00:00.000Z`);

    // Find all schedule records of type 2 (Blockout) for this date
    const rows = await prisma.schedule.findMany({
      where: {
        SchedDate: schedDate,
        SchedType: 2,
      },
      include: {
        scheduleop: true,
      },
    });

    return rows.map((row) => {
      let notes = '';
      let color = '#7e57c2'; // fallback color

      if (row.Note) {
        try {
          const parsed = JSON.parse(row.Note);
          notes = parsed.notes || row.Note;
          color = parsed.color || color;
        } catch {
          notes = row.Note;
        }
      }

      // Find the linked operatory/room ID
      const roomId = row.scheduleop && row.scheduleop.length > 0
        ? row.scheduleop[0].OperatoryNum?.toString() || ''
        : '';

      const formatTime = (date: Date | null) => {
        if (!date) return '';
        const iso = date.toISOString(); // e.g. "1970-01-01T08:30:00.000Z"
        // Wait, iso might be in UTC but input was HH:mm. If we wrote it as UTC "1970-01-01T08:30:00Z",
        // then ISO string is exactly "1970-01-01T08:30:00.000Z".
        // Let's extract HH:mm from the ISO format
        return iso.substring(11, 16);
      };

      return {
        _id: row.ScheduleNum.toString(),
        roomId,
        date: dateStr,
        startTime: formatTime(row.StartTime),
        endTime: formatTime(row.StopTime),
        notes,
        color,
      };
    });
  }

  /**
   * Delete a schedule block
   */
  async deleteBlock(blockId: string, deletedBy: string) {
    const blockIdBig = BigInt(blockId);

    const schedule = await prisma.schedule.findUnique({
      where: { ScheduleNum: blockIdBig },
      include: { scheduleop: true },
    });

    if (!schedule || schedule.SchedType !== 2) {
      throw new NotFoundError('Schedule block not found');
    }

    const oldData = {
      _id: blockId,
      notes: schedule.Note || '',
    };

    // Delete linking scheduleop first to respect foreign keys
    await prisma.scheduleop.deleteMany({
      where: { ScheduleNum: blockIdBig },
    });

    // Delete schedule
    await prisma.schedule.delete({
      where: { ScheduleNum: blockIdBig },
    });

    await logActivity(
      deletedBy,
      'deleted',
      'schedule-blocks',
      blockId,
      oldData,
      undefined,
      undefined,
      undefined,
      'low'
    );

    return { message: 'Schedule block deleted successfully' };
  }
}

export const scheduleBlockService = new ScheduleBlockService();
