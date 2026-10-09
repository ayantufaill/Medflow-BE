import { prisma } from '../config/db';
import { getUsersMeta } from './opendental-auth.util';

/**
 * Resolves userod UserNums to display names ("First Last").
 *
 * Staff names live in the user-meta JSON on userodpref; older/imported users
 * may only have the UserName login, which is used as the fallback. Returns a
 * map keyed by the UserNum string — ids that resolve to nothing are simply
 * absent from the map.
 */
export const resolveUserDisplayNames = async (
  userNums: Array<string | bigint | null | undefined>
): Promise<Record<string, string>> => {
  const ids = Array.from(
    new Set(
      userNums
        .map((num) => (num === null || num === undefined ? '' : num.toString()))
        .filter((num) => /^\d+$/.test(num))
    )
  );
  if (!ids.length) return {};

  const [users, metaMap] = await Promise.all([
    prisma.userod.findMany({
      where: { UserNum: { in: ids.map((id) => BigInt(id)) } },
      select: { UserNum: true, UserName: true },
    }),
    getUsersMeta(ids.map((id) => BigInt(id))),
  ]);

  const names: Record<string, string> = {};
  for (const user of users) {
    const key = user.UserNum.toString();
    const meta = metaMap[key] ?? {};
    const fullName = [meta.firstName, meta.lastName].filter(Boolean).join(' ').trim();
    names[key] = fullName || user.UserName || '';
  }
  return names;
};
