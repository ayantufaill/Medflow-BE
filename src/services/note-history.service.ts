import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';

const parse = (value: string | null | undefined): any => {
  try { return JSON.parse(value || '{}'); } catch { return {}; }
};

export async function getNoteHistory(noteId: string, kind: 'clinical_notes' | 'progress_notes') {
  const note = await prisma.commlog.findUnique({
    where: { CommlogNum: BigInt(noteId) },
    select: { PatNum: true, Note: true },
  });
  const meta = parse(note?.Note);
  const isRequestedKind = kind === 'progress_notes'
    ? meta.isProgressNote === true
    : meta.isProgressNote !== true && !meta.type && Boolean(meta.noteType || meta.structuredData || meta.content || meta.chiefComplaint);
  if (!note?.PatNum || !isRequestedKind) throw new NotFoundError('Note not found');

  // Check patient visibility through tenant RLS before reading security logs.
  const patient = await prisma.patient.findFirst({ where: { PatNum: note.PatNum }, select: { PatNum: true } });
  if (!patient) throw new NotFoundError('Note not found');

  const rows = await prisma.securitylog.findMany({
    // The JSON payload is escaped inside LogText. A Prisma `contains` filter
    // with backslashes becomes a SQL LIKE pattern and can miss matching rows.
    // Narrow by the ID here, then verify recordId and note type after parsing.
    where: { AND: [
      { LogText: { contains: 'recordId' } },
      { LogText: { contains: noteId } },
    ] },
    select: { SecurityLogNum: true, UserNum: true, LogDateTime: true, LogText: true },
    orderBy: { SecurityLogNum: 'desc' },
  });
  const events = rows.flatMap((row) => {
    const envelope = parse(row.LogText);
    const payload = parse(envelope.text);
    if (payload.type !== 'activity' || payload.tableName !== kind || String(payload.recordId) !== noteId || payload.action === 'viewed') return [];
    return [{
      id: row.SecurityLogNum.toString(),
      action: payload.action,
      occurredAt: row.LogDateTime?.toISOString() || payload.occurredAt || null,
      userId: row.UserNum?.toString() || null,
      oldValues: payload.oldValues || null,
      newValues: payload.newValues || null,
    }];
  });
  const userIds = [...new Set(events.map((event) => event.userId).filter((id): id is string => Boolean(id)))];
  const users = userIds.length ? await prisma.userod.findMany({
    where: { UserNum: { in: userIds.map(BigInt) } },
    select: { UserNum: true, UserName: true },
  }) : [];
  const names = new Map(users.map((user) => [user.UserNum.toString(), user.UserName || 'Unknown user']));
  return events.map(({ userId, ...event }) => ({ ...event, actor: userId ? names.get(userId) || 'Unknown user' : 'System' }));
}
