import { prisma } from '../config/db';
import { getHomeClinicNum } from '../services/practice-info.service';

// ---------------------------------------------------------------------------
// Appointment timezone handling
//
// Appointment datetimes are stored so that the UTC wall-clock of the stored
// value equals the clinic's scheduled local wall-clock (this is what
// `appointment.service.ts`'s `toDateTime` produces, e.g. a 6:00 PM booking
// stores 18:00 UTC in the database). The clinic's actual local offset is
// whatever the area uses — +5, -7, +5:30, DST, etc. — so every "is it past
// the scheduled start?" comparison and every wall-clock rendering must be
// done in the clinic's IANA timezone, not the server's own timezone.
//
// The clinic's timezone comes from the clinic row (`clinic.TimeZone`). When
// it isn't configured we fall back to the server's local timezone so the
// system behaves correctly out of the box for any area.
// ---------------------------------------------------------------------------

const SERVER_TIME_ZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
})();

const DEFAULT_CLINIC_TIMEZONE = SERVER_TIME_ZONE;

const tzCache = new Map<string, string>();

const isExplicitZone = (timeZone?: string | null): boolean => {
  if (!timeZone) return false;
  const normalized = timeZone.trim();
  if (!normalized) return false;
  // 'UTC' is the typical default/unset value in the DB — treat it as
  // "not configured" so we fall back to the clinic's actual area.
  if (normalized === 'UTC' || normalized === 'Etc/UTC' || normalized === 'GMT') return false;
  return true;
};

/**
 * Resolves a configured clinic timezone to a usable IANA zone, falling back
 * to the server's own timezone when nothing is configured.
 */
export const resolveClinicTimeZone = (timeZone?: string | null): string => {
  if (!isExplicitZone(timeZone)) return DEFAULT_CLINIC_TIMEZONE;
  return timeZone!.trim();
};

/**
 * Resolves the timezone for an appointment's clinic (or the fallback zone
 * when the clinic is unknown / not configured). Results for explicitly
 * configured zones are cached.
 *
 * When the appointment has no clinic (or its clinic has no explicit zone),
 * falls back to the acting user's home clinic timezone so a configured
 * practice timezone is honored even for legacy/null-clinic appointments.
 */
export const getAppointmentTimeZone = async (
  clinicNum?: bigint | number | null,
  userId?: string | null
): Promise<string> => {
  const resolveClinic = async (num: bigint | number): Promise<string | null> => {
    const cacheKey = String(num);
    const cached = tzCache.get(cacheKey);
    if (cached) return cached;
    try {
      const clinic = await prisma.clinic.findUnique({
        where: { ClinicNum: BigInt(num) },
        select: { TimeZone: true },
      });
      if (isExplicitZone(clinic?.TimeZone)) {
        const zone = clinic!.TimeZone!.trim();
        tzCache.set(cacheKey, zone);
        return zone;
      }
      return null;
    } catch {
      return null;
    }
  };

  let zone: string | null = null;
  if (clinicNum != null) {
    zone = await resolveClinic(clinicNum);
  }
  if (!zone && userId) {
    try {
      const homeClinic = await getHomeClinicNum(userId);
      if (homeClinic != null) {
        zone = await resolveClinic(homeClinic);
      }
    } catch {
      zone = null;
    }
  }
  return zone ?? DEFAULT_CLINIC_TIMEZONE;
};

export interface WallClock {
  year: number;
  monthIndex: number; // 0-based
  day: number;
  hour: number;
  minute: number;
}

/**
 * Extracts the UTC wall-clock of a Date. Because stored appointment values
 * encode the clinic-local wall-clock in their UTC components, this is the
 * clinic's scheduled local time.
 */
export const utcWallClock = (date: Date): WallClock => ({
  year: date.getUTCFullYear(),
  monthIndex: date.getUTCMonth(),
  day: date.getUTCDate(),
  hour: date.getUTCHours(),
  minute: date.getUTCMinutes(),
});

const FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

const getWallFormatter = (timeZone: string): Intl.DateTimeFormat => {
  let formatter = FORMATTER_CACHE.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    FORMATTER_CACHE.set(timeZone, formatter);
  }
  return formatter;
};

const wallClockAtEpoch = (epochMs: number, timeZone: string): WallClock & { second: number } => {
  const fields: Record<string, number> = {};
  for (const part of getWallFormatter(timeZone).formatToParts(epochMs)) {
    if (part.type !== 'literal') fields[part.type] = Number(part.value);
  }
  return {
    year: fields.year,
    monthIndex: fields.month - 1,
    day: fields.day,
    hour: fields.hour,
    minute: fields.minute,
    second: fields.second,
  };
};

/**
 * Converts a wall-clock time inside an IANA timezone to an absolute instant
 * (epoch milliseconds). Correct for any UTC offset, including half hours and
 * DST-affected zones.
 */
export const wallClockToInstant = (wallClock: WallClock, timeZone: string): number => {
  const { year, monthIndex, day, hour, minute } = wallClock;
  if (!isExplicitZone(timeZone)) {
    return Date.UTC(year, monthIndex, day, hour, minute, 0, 0);
  }

  // Start with the naive interpretation (as if UTC) and line up the wall clock
  // reported by the zone with the target wall clock. Corrects for the offset
  // within a few iterations, including the rare DST spring-forward gap where
  // the formatter snaps to a valid adjacent time.
  let guess = Date.UTC(year, monthIndex, day, hour, minute, 0, 0);
  for (let i = 0; i < 4; i += 1) {
    const wall = wallClockAtEpoch(guess, timeZone);
    const actualWallAsUtc = Date.UTC(wall.year, wall.monthIndex, wall.day, wall.hour, wall.minute, wall.second);
    const diff = Date.UTC(year, monthIndex, day, hour, minute, 0, 0) - actualWallAsUtc;
    if (diff === 0) break;
    guess += diff;
  }
  return guess;
};

/**
 * Returns the absolute instant at which a stored appointment datetime actually
 * begins, interpreted in the given clinic timezone.
 */
export const scheduledStartInstant = (appointmentDateTime: Date, timeZone: string): number =>
  wallClockToInstant(utcWallClock(appointmentDateTime), timeZone);