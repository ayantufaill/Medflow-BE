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
  const nextId = await prisma.$queryRawUnsafe<[{ nextId: bigint }]>(
    'SELECT COALESCE(MAX(UserOdPrefNum), 0) + 1 as nextId FROM userodpref'
  );
  return nextId[0]?.nextId ?? BigInt(1);
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

export const mapUser = async (row: any): Promise<AppUser> => {
  const meta = await getUserMeta(row.UserNum);
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

export const mapRole = async (row: any): Promise<AppRole> => {
  const meta = await getRoleMeta(row.UserGroupNum);
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
