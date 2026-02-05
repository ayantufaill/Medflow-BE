import { prisma } from '../config/db';
import type { AppUser, AppRole } from '../types/auth.types';

// OpenDental userodpref.FkeyType is tinyint (0-255). Keep custom values in range.
const ROLE_META_FKEYTYPE = 200;
const USER_META_FKEYTYPE = 201;
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

export const getUserMeta = async (userNum: bigint) => {
  const pref = await prisma.userodpref.findFirst({
    where: { UserNum: userNum, FkeyType: USER_META_FKEYTYPE },
  });
  return parseJson<Record<string, any>>(pref?.ValueString);
};

export const setUserMeta = async (userNum: bigint, meta: Record<string, any>) => {
  const existing = await prisma.userodpref.findFirst({
    where: { UserNum: userNum, FkeyType: USER_META_FKEYTYPE },
  });
  if (existing) {
    await prisma.userodpref.update({
      where: { UserOdPrefNum: existing.UserOdPrefNum },
      data: { ValueString: buildJson(meta) },
    });
    return existing.UserOdPrefNum;
  }
  const nextId = await prisma.$queryRawUnsafe<[{ nextId: bigint }]>(
    'SELECT COALESCE(MAX(UserOdPrefNum), 0) + 1 as nextId FROM userodpref'
  );
  const id = nextId[0]?.nextId ?? BigInt(1);
  await prisma.userodpref.create({
    data: {
      UserOdPrefNum: id,
      UserNum: userNum,
      FkeyType: USER_META_FKEYTYPE,
      ValueString: buildJson(meta),
    },
  });
  return id;
};

export const getRoleMeta = async (userGroupNum: bigint) => {
  const pref = await prisma.userodpref.findFirst({
    where: { Fkey: userGroupNum, FkeyType: ROLE_META_FKEYTYPE },
  });
  return parseJson<Record<string, any>>(pref?.ValueString);
};

export const setRoleMeta = async (userGroupNum: bigint, meta: Record<string, any>) => {
  const existing = await prisma.userodpref.findFirst({
    where: { Fkey: userGroupNum, FkeyType: ROLE_META_FKEYTYPE },
  });
  if (existing) {
    await prisma.userodpref.update({
      where: { UserOdPrefNum: existing.UserOdPrefNum },
      data: { ValueString: buildJson(meta) },
    });
    return existing.UserOdPrefNum;
  }
  const nextId = await prisma.$queryRawUnsafe<[{ nextId: bigint }]>(
    'SELECT COALESCE(MAX(UserOdPrefNum), 0) + 1 as nextId FROM userodpref'
  );
  const id = nextId[0]?.nextId ?? BigInt(1);
  await prisma.userodpref.create({
    data: {
      UserOdPrefNum: id,
      Fkey: userGroupNum,
      FkeyType: ROLE_META_FKEYTYPE,
      ValueString: buildJson(meta),
    },
  });
  return id;
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
  const existing = await prisma.userodpref.findFirst({
    where: { UserNum: userNum, FkeyType: VERIFICATION_FKEYTYPE },
  });
  if (existing) {
    await prisma.userodpref.update({
      where: { UserOdPrefNum: existing.UserOdPrefNum },
      data: { ValueString: payload },
    });
    return existing.UserOdPrefNum;
  }
  const nextId = await prisma.$queryRawUnsafe<[{ nextId: bigint }]>(
    'SELECT COALESCE(MAX(UserOdPrefNum), 0) + 1 as nextId FROM userodpref'
  );
  const id = nextId[0]?.nextId ?? BigInt(1);
  await prisma.userodpref.create({
    data: {
      UserOdPrefNum: id,
      UserNum: userNum,
      FkeyType: VERIFICATION_FKEYTYPE,
      ValueString: payload,
    },
  });
  return id;
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
  const existing = await prisma.userodpref.findFirst({
    where: { UserNum: userNum, FkeyType: RESET_FKEYTYPE },
  });
  if (existing) {
    await prisma.userodpref.update({
      where: { UserOdPrefNum: existing.UserOdPrefNum },
      data: { ValueString: payload },
    });
    return existing.UserOdPrefNum;
  }
  const nextId = await prisma.$queryRawUnsafe<[{ nextId: bigint }]>(
    'SELECT COALESCE(MAX(UserOdPrefNum), 0) + 1 as nextId FROM userodpref'
  );
  const id = nextId[0]?.nextId ?? BigInt(1);
  await prisma.userodpref.create({
    data: {
      UserOdPrefNum: id,
      UserNum: userNum,
      FkeyType: RESET_FKEYTYPE,
      ValueString: payload,
    },
  });
  return id;
};

export const clearReset = async (prefNum: bigint) => {
  await prisma.userodpref.delete({ where: { UserOdPrefNum: prefNum } });
};

export const parsePrefJson = <T>(value?: string | null): T => parseJson<T>(value);
