import { prisma } from '../config/db';
import type { AppUser, AppRole } from '../types/auth.types';

// OpenDental userodpref.FkeyType is tinyint (0-255). Keep custom values in range.
const ROLE_META_FKEYTYPE = 200;
const USER_META_FKEYTYPE = 201;
const PROVIDER_META_FKEYTYPE = 202;
const APPOINTMENT_TYPE_META_FKEYTYPE = 205;
const PATIENT_META_FKEYTYPE = 206;
const PATIENT_INSURANCE_META_FKEYTYPE = 207;
const ALLERGY_META_FKEYTYPE = 208;
const APPOINTMENT_META_FKEYTYPE = 209;
const VERIFICATION_FKEYTYPE = 203;
const RESET_FKEYTYPE = 204;
const REPORT_META_FKEYTYPE = 210;
const AUDIENCE_META_FKEYTYPE = 211;
const RX_META_FKEYTYPE = 212;

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

type UserOdPrefIdentity = {
  userNum?: bigint;
  fkey?: bigint;
  fkeyType: number;
};

const buildUserOdPrefWhere = (identity: UserOdPrefIdentity) => ({
  UserNum: identity.userNum ?? undefined,
  Fkey: identity.fkey ?? undefined,
  FkeyType: identity.fkeyType,
});

const getNextUserOdPrefId = async () => {
  const nextId = await prisma.$queryRawUnsafe<[{ nextId: any }]>(
    'SELECT COALESCE(MAX("UserOdPrefNum"), 0) + 1 AS "nextId" FROM "userodpref"'
  );
  const id = nextId[0]?.nextId;
  return id ? BigInt(id) : 1n;
};

const upsertUserOdPref = async (identity: UserOdPrefIdentity, valueString: string) => {
  const where = buildUserOdPrefWhere(identity);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const existing = await prisma.userodpref.findFirst({ where });
    if (existing) {
      await prisma.userodpref.update({
        where: { UserOdPrefNum: existing.UserOdPrefNum },
        data: { ValueString: valueString },
      });
      return existing.UserOdPrefNum;
    }

    const id = await getNextUserOdPrefId();
    try {
      await prisma.userodpref.create({
        data: {
          UserOdPrefNum: id,
          UserNum: identity.userNum ?? null,
          Fkey: identity.fkey ?? null,
          FkeyType: identity.fkeyType,
          ValueString: valueString,
        },
      });
      return id;
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        // Another concurrent request inserted this row/ID first; retry.
        continue;
      }
      throw error;
    }
  }

  throw new Error('Failed to persist preference due to concurrent writes');
};

export const getUserMeta = async (userNum: bigint) => {
  const pref = await prisma.userodpref.findFirst({
    where: { UserNum: userNum, FkeyType: USER_META_FKEYTYPE },
  });
  return parseJson<Record<string, any>>(pref?.ValueString);
};

export const getUsersMeta = async (userNums: bigint[]): Promise<Record<string, Record<string, any>>> => {
  const prefs = await prisma.userodpref.findMany({
    where: {
      UserNum: { in: userNums },
      FkeyType: USER_META_FKEYTYPE,
    },
  });
  const map: Record<string, Record<string, any>> = {};
  for (const pref of prefs) {
    if (pref.UserNum) {
      map[pref.UserNum.toString()] = parseJson<Record<string, any>>(pref.ValueString);
    }
  }
  return map;
};

export const setUserMeta = async (userNum: bigint, meta: Record<string, any>) => {
  return upsertUserOdPref(
    { userNum, fkeyType: USER_META_FKEYTYPE },
    buildJson(meta)
  );
};

export const getRoleMeta = async (userGroupNum: bigint) => {
  const pref = await prisma.userodpref.findFirst({
    where: { Fkey: userGroupNum, FkeyType: ROLE_META_FKEYTYPE },
  });
  return parseJson<Record<string, any>>(pref?.ValueString);
};

export const getRolesMeta = async (roleNums: bigint[]): Promise<Record<string, Record<string, any>>> => {
  const prefs = await prisma.userodpref.findMany({
    where: {
      Fkey: { in: roleNums },
      FkeyType: ROLE_META_FKEYTYPE,
    },
  });
  const map: Record<string, Record<string, any>> = {};
  for (const pref of prefs) {
    if (pref.Fkey) {
      map[pref.Fkey.toString()] = parseJson<Record<string, any>>(pref.ValueString);
    }
  }
  return map;
};

export const setRoleMeta = async (userGroupNum: bigint, meta: Record<string, any>) => {
  return upsertUserOdPref(
    { fkey: userGroupNum, fkeyType: ROLE_META_FKEYTYPE },
    buildJson(meta)
  );
};

export const getProviderMeta = async (provNum: bigint) => {
  const pref = await prisma.userodpref.findFirst({
    where: { Fkey: provNum, FkeyType: PROVIDER_META_FKEYTYPE },
  });
  return parseJson<Record<string, any>>(pref?.ValueString);
};

export const getProvidersMeta = async (provNums: bigint[]): Promise<Record<string, Record<string, any>>> => {
  const prefs = await prisma.userodpref.findMany({
    where: {
      Fkey: { in: provNums },
      FkeyType: PROVIDER_META_FKEYTYPE,
    },
  });
  const map: Record<string, Record<string, any>> = {};
  for (const pref of prefs) {
    if (pref.Fkey) {
      map[pref.Fkey.toString()] = parseJson<Record<string, any>>(pref.ValueString);
    }
  }
  return map;
};

export const setProviderMeta = async (provNum: bigint, meta: Record<string, any>) => {
  return upsertUserOdPref(
    { fkey: provNum, fkeyType: PROVIDER_META_FKEYTYPE },
    buildJson(meta)
  );
};

export const getAppointmentTypeMeta = async (appointmentTypeNum: bigint) => {
  const pref = await prisma.userodpref.findFirst({
    where: { Fkey: appointmentTypeNum, FkeyType: APPOINTMENT_TYPE_META_FKEYTYPE },
  });
  return parseJson<Record<string, any>>(pref?.ValueString);
};

export const getAppointmentTypesMeta = async (appointmentTypeNums: bigint[]): Promise<Record<string, Record<string, any>>> => {
  const prefs = await prisma.userodpref.findMany({
    where: {
      Fkey: { in: appointmentTypeNums },
      FkeyType: APPOINTMENT_TYPE_META_FKEYTYPE,
    },
  });
  const map: Record<string, Record<string, any>> = {};
  for (const pref of prefs) {
    if (pref.Fkey) {
      map[pref.Fkey.toString()] = parseJson<Record<string, any>>(pref.ValueString);
    }
  }
  return map;
};

export const setAppointmentTypeMeta = async (
  appointmentTypeNum: bigint,
  meta: Record<string, any>
) => {
  return upsertUserOdPref(
    { fkey: appointmentTypeNum, fkeyType: APPOINTMENT_TYPE_META_FKEYTYPE },
    buildJson(meta)
  );
};

export const getPatientMeta = async (patNum: bigint) => {
  const pref = await prisma.userodpref.findFirst({
    where: { Fkey: patNum, FkeyType: PATIENT_META_FKEYTYPE },
  });
  return parseJson<Record<string, any>>(pref?.ValueString);
};

export const getPatientsMeta = async (patNums: bigint[]): Promise<Record<string, Record<string, any>>> => {
  const prefs = await prisma.userodpref.findMany({
    where: {
      Fkey: { in: patNums },
      FkeyType: PATIENT_META_FKEYTYPE,
    },
  });
  const map: Record<string, Record<string, any>> = {};
  for (const pref of prefs) {
    if (pref.Fkey) {
      map[pref.Fkey.toString()] = parseJson<Record<string, any>>(pref.ValueString);
    }
  }
  return map;
};

export const setPatientMeta = async (patNum: bigint, meta: Record<string, any>) => {
  return upsertUserOdPref(
    { fkey: patNum, fkeyType: PATIENT_META_FKEYTYPE },
    buildJson(meta)
  );
};

export const getPatientInsuranceMeta = async (patPlanNum: bigint) => {
  const pref = await prisma.userodpref.findFirst({
    where: { Fkey: patPlanNum, FkeyType: PATIENT_INSURANCE_META_FKEYTYPE },
  });
  return parseJson<Record<string, any>>(pref?.ValueString);
};

export const getPatientInsurancesMeta = async (patPlanNums: bigint[]): Promise<Record<string, Record<string, any>>> => {
  const prefs = await prisma.userodpref.findMany({
    where: {
      Fkey: { in: patPlanNums },
      FkeyType: PATIENT_INSURANCE_META_FKEYTYPE,
    },
  });
  const map: Record<string, Record<string, any>> = {};
  for (const pref of prefs) {
    if (pref.Fkey) {
      map[pref.Fkey.toString()] = parseJson<Record<string, any>>(pref.ValueString);
    }
  }
  return map;
};

export const setPatientInsuranceMeta = async (patPlanNum: bigint, meta: Record<string, any>) => {
  return upsertUserOdPref(
    { fkey: patPlanNum, fkeyType: PATIENT_INSURANCE_META_FKEYTYPE },
    buildJson(meta)
  );
};

export const getAllergyMeta = async (allergyNum: bigint) => {
  const pref = await prisma.userodpref.findFirst({
    where: { Fkey: allergyNum, FkeyType: ALLERGY_META_FKEYTYPE },
  });
  return parseJson<Record<string, any>>(pref?.ValueString);
};

export const getAllergiesMeta = async (allergyNums: bigint[]): Promise<Record<string, Record<string, any>>> => {
  const prefs = await prisma.userodpref.findMany({
    where: {
      Fkey: { in: allergyNums },
      FkeyType: ALLERGY_META_FKEYTYPE,
    },
  });
  const map: Record<string, Record<string, any>> = {};
  for (const pref of prefs) {
    if (pref.Fkey) {
      map[pref.Fkey.toString()] = parseJson<Record<string, any>>(pref.ValueString);
    }
  }
  return map;
};

export const setAllergyMeta = async (allergyNum: bigint, meta: Record<string, any>) => {
  return upsertUserOdPref(
    { fkey: allergyNum, fkeyType: ALLERGY_META_FKEYTYPE },
    buildJson(meta)
  );
};

export const getAppointmentMeta = async (aptNum: bigint) => {
  const pref = await prisma.userodpref.findFirst({
    where: { Fkey: aptNum, FkeyType: APPOINTMENT_META_FKEYTYPE },
  });
  return parseJson<Record<string, any>>(pref?.ValueString);
};

export const setAppointmentMeta = async (aptNum: bigint, meta: Record<string, any>) => {
  return upsertUserOdPref(
    { fkey: aptNum, fkeyType: APPOINTMENT_META_FKEYTYPE },
    buildJson(meta)
  );
};

export const getReportMeta = async (reportId: bigint) => {
  const pref = await prisma.userodpref.findFirst({
    where: { Fkey: reportId, FkeyType: REPORT_META_FKEYTYPE },
  });
  return parseJson<Record<string, any>>(pref?.ValueString);
};

export const setReportMeta = async (reportId: bigint, meta: Record<string, any>) => {
  return upsertUserOdPref(
    { fkey: reportId, fkeyType: REPORT_META_FKEYTYPE },
    buildJson(meta)
  );
};

export const getAllSavedReports = async () => {
  const reports = await prisma.userodpref.findMany({
    where: { FkeyType: REPORT_META_FKEYTYPE },
  });
  return reports.map(r => ({
    _id: r.Fkey?.toString(),
    ...parseJson<Record<string, any>>(r.ValueString)
  }));
};

export const deleteReportMeta = async (reportId: bigint) => {
  await prisma.userodpref.deleteMany({
    where: { Fkey: reportId, FkeyType: REPORT_META_FKEYTYPE },
  });
};

export const getAudienceMeta = async (audienceId: bigint) => {
  const pref = await prisma.userodpref.findFirst({
    where: { Fkey: audienceId, FkeyType: AUDIENCE_META_FKEYTYPE },
  });
  return parseJson<Record<string, any>>(pref?.ValueString);
};

export const setAudienceMeta = async (audienceId: bigint, meta: Record<string, any>) => {
  return upsertUserOdPref(
    { fkey: audienceId, fkeyType: AUDIENCE_META_FKEYTYPE },
    buildJson(meta)
  );
};

export const getAllSavedAudiences = async () => {
  const audiences = await prisma.userodpref.findMany({
    where: { FkeyType: AUDIENCE_META_FKEYTYPE },
  });
  return audiences.map(a => ({
    _id: a.Fkey?.toString(),
    ...parseJson<Record<string, any>>(a.ValueString)
  }));
};

export const deleteAudienceMeta = async (audienceId: bigint) => {
  await prisma.userodpref.deleteMany({
    where: { Fkey: audienceId, FkeyType: AUDIENCE_META_FKEYTYPE },
  });
};

export const getRxMeta = async (rxNum: bigint) => {
  const pref = await prisma.userodpref.findFirst({
    where: { Fkey: rxNum, FkeyType: RX_META_FKEYTYPE },
  });
  return parseJson<Record<string, any>>(pref?.ValueString);
};

export const getRxsMeta = async (rxNums: bigint[]): Promise<Record<string, Record<string, any>>> => {
  const prefs = await prisma.userodpref.findMany({
    where: {
      Fkey: { in: rxNums },
      FkeyType: RX_META_FKEYTYPE,
    },
  });
  const map: Record<string, Record<string, any>> = {};
  for (const pref of prefs) {
    if (pref.Fkey) {
      map[pref.Fkey.toString()] = parseJson<Record<string, any>>(pref.ValueString);
    }
  }
  return map;
};

export const setRxMeta = async (rxNum: bigint, meta: Record<string, any>) => {
  return upsertUserOdPref(
    { fkey: rxNum, fkeyType: RX_META_FKEYTYPE },
    buildJson(meta)
  );
};

export const mapUser = async (row: any, preloadedMeta?: Record<string, any>): Promise<AppUser> => {
  const meta = preloadedMeta ?? await getUserMeta(row.UserNum);
  return {
    _id: row.UserNum.toString(),
    email: row.UserName ?? meta.email ?? '',
    passwordHash: row.Password ?? meta.passwordHash ?? '',
    firstName: meta.firstName ?? '',
    lastName: meta.lastName ?? '',
    phone: meta.phone ?? null,
    preferredLanguage: meta.preferredLanguage ?? 'en',
    failedLoginAttempts: meta.failedLoginAttempts ?? 0,
    accountLockedUntil: meta.accountLockedUntil ? new Date(meta.accountLockedUntil) : null,
    isActive: meta.isActive ?? (row.IsHidden ? false : true),
    lastLoginAt: meta.lastLoginAt ? new Date(meta.lastLoginAt) : null,
    tokenVersion: meta.tokenVersion ?? 0,
  } as AppUser;
};

export const mapRole = async (row: any, preloadedMeta?: Record<string, any>): Promise<AppRole> => {
  const meta = preloadedMeta ?? await getRoleMeta(row.UserGroupNum);
  return {
    _id: row.UserGroupNum.toString(),
    name: row.Description ?? '',
    description: meta.description ?? null,
    permissions: meta.permissions ?? {},
    isSystemRole: meta.isSystemRole ?? false,
    isActive: meta.isActive ?? true,
  } as AppRole;
};

export const findVerificationByToken = async (token: string) => {
  const record = await prisma.userodpref.findFirst({
    where: {
      FkeyType: VERIFICATION_FKEYTYPE,
      ValueString: { contains: `"token":"${token}"` },
    },
  });
  return record;
};

export const setVerification = async (userNum: bigint, token: string, expiresAt: Date) => {
  const payload = buildJson({ token, expiresAt: expiresAt.toISOString() });
  return upsertUserOdPref(
    { userNum, fkeyType: VERIFICATION_FKEYTYPE },
    payload
  );
};

export const clearVerification = async (prefNum: bigint) => {
  await prisma.userodpref.delete({ where: { UserOdPrefNum: prefNum } });
};

export const findResetByToken = async (token: string) => {
  const record = await prisma.userodpref.findFirst({
    where: {
      FkeyType: RESET_FKEYTYPE,
      ValueString: { contains: `"token":"${token}"` },
    },
  });
  return record;
};

export const setReset = async (userNum: bigint, token: string, expiresAt: Date) => {
  const payload = buildJson({ token, expiresAt: expiresAt.toISOString() });
  return upsertUserOdPref(
    { userNum, fkeyType: RESET_FKEYTYPE },
    payload
  );
};

export const clearReset = async (prefNum: bigint) => {
  await prisma.userodpref.delete({ where: { UserOdPrefNum: prefNum } });
};

export const parsePrefJson = <T>(value?: string | null): T => parseJson<T>(value);
