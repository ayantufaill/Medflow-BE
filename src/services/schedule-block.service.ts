import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import { parseDurationMinutes } from '../utils/opendental-mappers.util';

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
    // Overlap validation check
    const startOfDay = new Date(`${data.date}T00:00:00.000Z`);
    const endOfDay = new Date(`${data.date}T23:59:59.999Z`);
    const blockStart = new Date(`${data.date}T${data.startTime}:00.000Z`);
    const blockEnd = new Date(`${data.date}T${data.endTime}:00.000Z`);

    const appointments = await prisma.appointment.findMany({
      where: {
        Op: BigInt(data.roomId),
        AptDateTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const activeAppts = appointments.filter(
      (appt) => appt.AptStatus !== null && appt.AptStatus !== 3 && appt.AptStatus !== 6
    );

    for (const appt of activeAppts) {
      if (!appt.AptDateTime) continue;

      const apptStart = appt.AptDateTime;
      const duration = parseDurationMinutes(appt.Pattern);
      const apptEnd = new Date(apptStart.getTime() + duration * 60 * 1000);

      // Overlap occurs if: BlockStart < ApptEnd AND BlockEnd > ApptStart
      if (blockStart < apptEnd && blockEnd > apptStart) {
        throw new BadRequestError('Cannot create block slot: Overlaps with an existing appointment');
      }
    }

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
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            notes = parsed.notes !== undefined ? String(parsed.notes) : '';
            color = parsed.color || color;
          } else {
            notes = row.Note;
          }
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
   * Update an existing schedule block
   */
  async updateBlock(
    blockId: string,
    updates: Partial<{
      roomId: string;
      date: string; // YYYY-MM-DD
      startTime: string; // HH:mm
      endTime: string; // HH:mm
      notes: string;
      color: string;
    }>,
    updatedBy: string
  ) {
    const blockIdBig = BigInt(blockId);

    const existingSchedule = await prisma.schedule.findUnique({
      where: { ScheduleNum: blockIdBig },
      include: { scheduleop: true },
    });

    if (!existingSchedule || existingSchedule.SchedType !== 2) {
      throw new NotFoundError('Schedule block not found');
    }

    const currentRoomId =
      existingSchedule.scheduleop && existingSchedule.scheduleop.length > 0
        ? existingSchedule.scheduleop[0].OperatoryNum?.toString() || ''
        : '';

    const targetRoomId = updates.roomId ?? currentRoomId;

    const currentDateStr = existingSchedule.SchedDate
      ? existingSchedule.SchedDate.toISOString().substring(0, 10)
      : '';
    const targetDate = updates.date ?? currentDateStr;

    const formatTime = (d: Date | null) => (d ? d.toISOString().substring(11, 16) : '');
    const currentStartTime = formatTime(existingSchedule.StartTime);
    const currentEndTime = formatTime(existingSchedule.StopTime);

    const targetStartTime = updates.startTime ?? currentStartTime;
    const targetEndTime = updates.endTime ?? currentEndTime;

    if (
      updates.roomId !== undefined ||
      updates.date !== undefined ||
      updates.startTime !== undefined ||
      updates.endTime !== undefined
    ) {
      const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
      const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);
      const blockStart = new Date(`${targetDate}T${targetStartTime}:00.000Z`);
      const blockEnd = new Date(`${targetDate}T${targetEndTime}:00.000Z`);

      const appointments = await prisma.appointment.findMany({
        where: {
          Op: BigInt(targetRoomId),
          AptDateTime: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      const activeAppts = appointments.filter(
        (appt) => appt.AptStatus !== null && appt.AptStatus !== 3 && appt.AptStatus !== 6
      );

      for (const appt of activeAppts) {
        if (!appt.AptDateTime) continue;

        const apptStart = appt.AptDateTime;
        const duration = parseDurationMinutes(appt.Pattern);
        const apptEnd = new Date(apptStart.getTime() + duration * 60 * 1000);

        if (blockStart < apptEnd && blockEnd > apptStart) {
          throw new BadRequestError('Cannot update block slot: Overlaps with an existing appointment');
        }
      }
    }

    let existingNotes = '';
    let existingColor = '#7e57c2';
    if (existingSchedule.Note) {
      try {
        const parsed = JSON.parse(existingSchedule.Note);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          existingNotes = parsed.notes !== undefined ? String(parsed.notes) : '';
          existingColor = parsed.color || existingColor;
        } else {
          existingNotes = existingSchedule.Note;
        }
      } catch {
        existingNotes = existingSchedule.Note;
      }
    }

    const updatedNotes = updates.notes !== undefined ? updates.notes : existingNotes;
    const updatedColor = updates.color !== undefined ? updates.color : existingColor;

    const blockMeta = {
      notes: updatedNotes,
      color: updatedColor,
    };

    const updateData: any = {
      Note: JSON.stringify(blockMeta),
      DateTStamp: new Date(),
    };

    if (updates.date !== undefined) {
      updateData.SchedDate = new Date(`${updates.date}T00:00:00.000Z`);
    }
    if (updates.startTime !== undefined) {
      updateData.StartTime = new Date(`1970-01-01T${updates.startTime}:00Z`);
    }
    if (updates.endTime !== undefined) {
      updateData.StopTime = new Date(`1970-01-01T${updates.endTime}:00Z`);
    }

    await prisma.schedule.update({
      where: { ScheduleNum: blockIdBig },
      data: updateData,
    });

    if (updates.roomId !== undefined && updates.roomId !== currentRoomId) {
      await prisma.scheduleop.deleteMany({
        where: { ScheduleNum: blockIdBig },
      });

      const scheduleOpNum = await getNextId('scheduleop', 'ScheduleOpNum');
      await prisma.scheduleop.create({
        data: {
          ScheduleOpNum: scheduleOpNum,
          ScheduleNum: blockIdBig,
          OperatoryNum: BigInt(updates.roomId),
        },
      });
    }

    const updatedBlock = {
      _id: blockId,
      roomId: targetRoomId,
      date: targetDate,
      startTime: targetStartTime,
      endTime: targetEndTime,
      notes: updatedNotes,
      color: updatedColor,
    };

    await logActivity(
      updatedBy,
      'updated',
      'schedule-blocks',
      blockId,
      { _id: blockId, roomId: currentRoomId, date: currentDateStr, startTime: currentStartTime, endTime: currentEndTime, notes: existingNotes, color: existingColor },
      updatedBlock,
      undefined,
      undefined,
      'low'
    );

    return updatedBlock;
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
