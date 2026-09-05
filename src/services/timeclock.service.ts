import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { getUsersMeta, getRolesMeta } from '../utils/opendental-auth.util';

export interface TimeClockRecordPayload {
  userId?: string;
  employeeNum?: number | string;
  date: string;
  time: string;
  recordType: 'Clock In' | 'Clock Out' | 'Break';
  note?: string;
}

export class TimeClockService {
  /**
   * Helper to format minutes into HH:mm
   */
  private formatMinutesToHHMM(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    const paddedHours = String(hours).padStart(2, '0');
    const paddedMins = String(mins).padStart(2, '0');
    return `${paddedHours}:${paddedMins}`;
  }

  /**
   * Get Timesheets within date range with aggregated hours and break counts
   */
  async getTimesheets(startDate?: string, endDate?: string, dateRange?: string) {
    let whereClause: any = {};

    let start: Date | null = null;
    let end: Date | null = null;

    const now = new Date();

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else if (dateRange) {
      if (dateRange === 'This Week') {
        const dayOfWeek = now.getDay();
        const firstDayOfWeek = new Date(now);
        firstDayOfWeek.setDate(now.getDate() - dayOfWeek);
        firstDayOfWeek.setHours(0, 0, 0, 0);

        const lastDayOfWeek = new Date(firstDayOfWeek);
        lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
        lastDayOfWeek.setHours(23, 59, 59, 999);

        start = firstDayOfWeek;
        end = lastDayOfWeek;
      } else if (dateRange === 'Last Week') {
        const dayOfWeek = now.getDay();
        const lastDayOfLastWeek = new Date(now);
        lastDayOfLastWeek.setDate(now.getDate() - dayOfWeek - 1);
        lastDayOfLastWeek.setHours(23, 59, 59, 999);

        const firstDayOfLastWeek = new Date(lastDayOfLastWeek);
        firstDayOfLastWeek.setDate(lastDayOfLastWeek.getDate() - 6);
        firstDayOfLastWeek.setHours(0, 0, 0, 0);

        start = firstDayOfLastWeek;
        end = lastDayOfLastWeek;
      } else if (dateRange === 'This Month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      }
    }

    if (start && end) {
      whereClause = {
        OR: [
          { TimeDisplayed1: { gte: start, lte: end } },
          { TimeEntered1: { gte: start, lte: end } },
        ],
      };
    }

    // Retrieve all clock events with employee detail
    const events = await prisma.clockevent.findMany({
      where: whereClause,
      include: {
        employee: true,
      },
      orderBy: [
        { EmployeeNum: 'asc' },
        { TimeDisplayed1: 'asc' },
        { TimeEntered1: 'asc' },
      ],
    });

    // Group events by EmployeeNum
    const employeeMap = new Map<string, any[]>();
    for (const ev of events) {
      const empKey = ev.EmployeeNum ? ev.EmployeeNum.toString() : 'unassigned';
      if (!employeeMap.has(empKey)) {
        employeeMap.set(empKey, []);
      }
      employeeMap.get(empKey)!.push(ev);
    }

    // Get employees metadata & user metadata for role mapping
    const allEmployees = await prisma.employee.findMany();
    const empUserList = await prisma.userod.findMany({
      select: { UserNum: true, EmployeeNum: true, UserGroupNum: true, UserName: true },
    });

    const userNums = empUserList.map((u) => u.UserNum);
    const usersMeta = await getUsersMeta(userNums);

    const userGroupNums = empUserList
      .map((u) => u.UserGroupNum)
      .filter((g): g is bigint => Boolean(g));

    const userGroups = await prisma.usergroup.findMany({
      where: { UserGroupNum: { in: userGroupNums } },
    });

    const groupMap = new Map<string, string>();
    for (const g of userGroups) {
      groupMap.set(g.UserGroupNum.toString(), g.Description || 'Staff');
    }

    let overallRegularMinutes = 0;
    let overallBreakMinutes = 0;
    let overallBreaks = 0;

    const timesheetRows = [];

    // Calculate aggregated stats per employee
    for (const [empKey, empEvents] of employeeMap.entries()) {
      if (empKey === 'unassigned') continue;

      let regMinutes = 0;
      let breakMinutes = 0;
      let numBreaks = 0;

      // Iterate through events chronologically to calculate intervals
      for (let i = 0; i < empEvents.length; i++) {
        const current = empEvents[i];
        const currentTime = current.TimeDisplayed1 || current.TimeEntered1;
        if (!currentTime) continue;

        const next = empEvents[i + 1];
        const nextTime = next ? next.TimeDisplayed1 || next.TimeEntered1 : null;

        // ClockStatus: 0 = Work, 1 = Home, 2 = Break
        const status = current.ClockStatus;

        if (status === 0) {
          // Working segment
          if (nextTime) {
            const diffMs = nextTime.getTime() - currentTime.getTime();
            if (diffMs > 0) {
              regMinutes += diffMs / (1000 * 60);
            }
          }
        } else if (status === 2) {
          // Break segment
          numBreaks += 1;
          if (nextTime) {
            const diffMs = nextTime.getTime() - currentTime.getTime();
            if (diffMs > 0) {
              breakMinutes += diffMs / (1000 * 60);
            }
          }
        }
      }

      const empRecord = allEmployees.find((e) => e.EmployeeNum.toString() === empKey);
      const userRecord = empUserList.find((u) => u.EmployeeNum?.toString() === empKey);

      let userName = 'Unknown';
      if (userRecord) {
        const meta = usersMeta[userRecord.UserNum.toString()] || {};
        if (meta.firstName || meta.lastName) {
          userName = `${meta.firstName || ''} ${meta.lastName || ''}`.trim();
        } else if (empRecord && (empRecord.FName || empRecord.LName)) {
          userName = `${empRecord.FName || ''} ${empRecord.LName || ''}`.trim();
        } else {
          userName = userRecord.UserName || `Employee #${empKey}`;
        }
      } else if (empRecord && (empRecord.FName || empRecord.LName)) {
        userName = `${empRecord.FName || ''} ${empRecord.LName || ''}`.trim();
      }

      let roleName = 'Staff';
      if (userRecord && userRecord.UserGroupNum) {
        roleName = groupMap.get(userRecord.UserGroupNum.toString()) || 'Staff';
      }

      const totalMinutes = regMinutes;

      overallRegularMinutes += regMinutes;
      overallBreakMinutes += breakMinutes;
      overallBreaks += numBreaks;

      timesheetRows.push({
        employeeNum: empKey,
        userName,
        role: roleName,
        regularHours: this.formatMinutesToHHMM(regMinutes),
        numBreaks,
        breakHours: this.formatMinutesToHHMM(breakMinutes),
        totalHours: this.formatMinutesToHHMM(totalMinutes),
        rawStats: {
          regMinutes,
          breakMinutes,
          numBreaks,
          totalMinutes,
        },
      });
    }

    const summary = {
      regularHours: this.formatMinutesToHHMM(overallRegularMinutes),
      numBreaks: overallBreaks,
      breakHours: this.formatMinutesToHHMM(overallBreakMinutes),
      totalHours: this.formatMinutesToHHMM(overallRegularMinutes),
    };

    return {
      summary,
      timesheets: timesheetRows,
    };
  }

  /**
   * Add a new time clock record into clockevent table
   */
  async addTimeClockRecord(payload: TimeClockRecordPayload) {
    const { userId, employeeNum, date, time, recordType, note } = payload;

    let targetEmployeeNum: bigint | null = null;

    if (employeeNum) {
      targetEmployeeNum = BigInt(employeeNum);
    } else if (userId) {
      const user = await prisma.userod.findUnique({
        where: { UserNum: BigInt(userId) },
      });
      if (user && user.EmployeeNum) {
        targetEmployeeNum = user.EmployeeNum;
      }
    }

    if (!targetEmployeeNum) {
      // Create a dedicated employee record for this user
      const newEmpId = await getNextId('employee', 'EmployeeNum');
      let fName = 'System';
      let lName = 'Employee';

      if (userId) {
        const metaMap = await getUsersMeta([BigInt(userId)]);
        const meta = metaMap[userId.toString()];
        if (meta) {
          fName = meta.firstName || 'User';
          lName = meta.lastName || `#${userId}`;
        }
      }

      await prisma.employee.create({
        data: {
          EmployeeNum: newEmpId,
          FName: fName,
          LName: lName,
          IsHidden: 0,
        }
      });
      
      if (userId) {
        await prisma.userod.update({
          where: { UserNum: BigInt(userId) },
          data: { EmployeeNum: newEmpId }
        });
      }
      
      targetEmployeeNum = newEmpId;
    }

    const dateObj = new Date(date);
    
    // Parse time which is typically in "HH:mm" format
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    if (time.includes(':')) {
      const parts = time.split(':');
      hours = parseInt(parts[0], 10) || 0;
      minutes = parseInt(parts[1], 10) || 0;
      if (parts[2]) seconds = parseInt(parts[2], 10) || 0;
    } else {
      const timeObj = new Date(time);
      if (!isNaN(timeObj.getTime())) {
        hours = timeObj.getHours();
        minutes = timeObj.getMinutes();
        seconds = timeObj.getSeconds();
      }
    }

    const combinedDateTime = new Date(
      dateObj.getFullYear(),
      dateObj.getMonth(),
      dateObj.getDate(),
      hours,
      minutes,
      seconds
    );

    let clockStatus = 0;
    if (recordType === 'Clock Out') {
      clockStatus = 1;
    } else if (recordType === 'Break') {
      clockStatus = 2;
    }

    const clockEventNum = await getNextId('clockevent', 'ClockEventNum');

    const newClockEvent = await prisma.clockevent.create({
      data: {
        ClockEventNum: clockEventNum,
        EmployeeNum: targetEmployeeNum,
        ClockStatus: clockStatus,
        TimeEntered1: combinedDateTime,
        TimeDisplayed1: combinedDateTime,
        Note: note || null,
      },
      include: {
        employee: true,
      },
    });

    return {
      clockEventNum: newClockEvent.ClockEventNum.toString(),
      employeeNum: newClockEvent.EmployeeNum?.toString(),
      clockStatus: newClockEvent.ClockStatus,
      timeDisplayed: newClockEvent.TimeDisplayed1,
      note: newClockEvent.Note,
    };
  }
}

export const timeClockService = new TimeClockService();
