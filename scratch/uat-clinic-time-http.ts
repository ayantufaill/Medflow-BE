const API = process.env.API_BASE || 'http://localhost:5001/api';
const PASSWORD = process.env.UAT_PASSWORD || 'MedFlow@Test1!';

const BRANCHES = {
  A: { clinicNum: '245', name: 'Sunrise Downtown', tz: 'America/New_York', patientId: '1907934300951087', providerId: '1907934300951073', roomId: '1791494273290002' },
  B: { clinicNum: '246', name: 'Sunrise Uptown', tz: 'America/Los_Angeles', patientId: '1907934300951088', providerId: '1907934300951075', roomId: '1791494273290003' },
  CS: { clinicNum: '247', name: 'City Smiles Main', tz: 'America/Chicago', patientId: '1907934300951089', providerId: '1907934300951076', roomId: '1791494273290004' },
} as const;
type BranchKey = keyof typeof BRANCHES;

const USERS: { email: string; role: string; branches: BranchKey[] }[] = [
  { email: 'sarah.admin@sunrisedental.test', role: 'group_admin', branches: ['A', 'B'] },
  { email: 'james.downtown@sunrisedental.test', role: 'branch_admin', branches: ['A'] },
  { email: 'dr.ahmed@sunrisedental.test', role: 'dentist', branches: ['A'] },
  { email: 'lisa.hygiene@sunrisedental.test', role: 'hygienist', branches: ['A'] },
  { email: 'mike.assist@sunrisedental.test', role: 'dental_assistant', branches: ['A'] },
  { email: 'nadia.fd@sunrisedental.test', role: 'front_desk', branches: ['A'] },
  { email: 'omar.billing@sunrisedental.test', role: 'billing', branches: ['A'] },
  { email: 'emma.uptown@sunrisedental.test', role: 'branch_admin', branches: ['B'] },
  { email: 'dr.chen@sunrisedental.test', role: 'dentist', branches: ['B'] },
  { email: 'owner@citysmiles.test', role: 'group_admin', branches: ['CS'] },
  { email: 'dr.nguyen@citysmiles.test', role: 'dentist', branches: ['CS'] },
  { email: 'ali.tariq@patient.test', role: 'Patient', branches: ['A'] },
  { email: 'lab@crownlab.test', role: 'Lab', branches: ['A'] },
];

let passes = 0;
let failures = 0;
const created: { id: string; token: string }[] = [];
const fail = (label: string, msg: string) => {
  failures += 1;
  console.log(`FAIL  ${label}\n      ${msg}`);
};
const pass = (label: string) => {
  passes += 1;
  console.log(`PASS  ${label}`);
};
const assert = (cond: unknown, label: string, msg: string) => {
  if (!cond) throw new Error(msg);
  return true;
};

async function login(email: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`login ${email} -> ${res.status} ${JSON.stringify(body)}`);
  const tokens = body.data.tokens as { accessToken: string };
  const profileRes = await fetch(`${API}/auth/profile`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  const profile: any = await profileRes.json().catch(() => ({}));
  if (!profileRes.ok) throw new Error(`profile ${email} -> ${profileRes.status} ${JSON.stringify(profile)}`);
  return { user: profile.data.user, tokens };
}

const authHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

async function practiceInfo(token: string, branchId: string) {
  const res = await fetch(`${API}/practice-info/current?branchId=${branchId}`, { headers: authHeaders(token) });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`practice-info ${branchId} -> ${res.status} ${JSON.stringify(body)}`);
  return body.data.practiceInfo;
}

async function createAppointment(
  token: string,
  b: (typeof BRANCHES)[BranchKey],
  dateOnly: string,
  startTime: string,
  endTime: string
) {
  const res = await fetch(`${API}/appointments`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      patientId: b.patientId,
      providerId: b.providerId,
      branchId: b.clinicNum,
      roomId: b.roomId,
      appointmentDate: `${dateOnly}T00:00:00.000Z`,
      startTime,
      endTime,
      durationMinutes: 30,
      status: 'scheduled',
    }),
  });
  const body: any = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

const partsIn = (instant: number, tz: string) => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(new Date(instant))) if (part.type !== 'literal') p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` };
};

async function main() {
  console.log(`API: ${API}\n`);
  const sessions = new Map<string, { token: string; user: any }>();

  for (const u of USERS) {
    const label = `login ${u.email}`;
    try {
      const { user, tokens } = await login(u.email);
      sessions.set(u.email, { token: tokens.accessToken, user });
      const roleNames = (user.roles ?? []).map((r: any) => String(r.name ?? r));
      assert(String(user.email).toLowerCase() === u.email, label, `email mismatch: ${user.email}`);
      assert(roleNames.includes(u.role), label, `roles ${JSON.stringify(roleNames)} missing ${u.role}`);
      const isPortal = u.role === 'Patient' || u.role === 'Lab';
      const branchIds = (user.branchIds ?? []).map(String).sort();
      const expected = u.branches.map((b) => BRANCHES[b].clinicNum).sort();
      if (!isPortal) {
        assert(JSON.stringify(branchIds) === JSON.stringify(expected), label, `branchIds ${JSON.stringify(branchIds)} != ${JSON.stringify(expected)}`);
      }
      pass(`${label} [${roleNames.join(',')}]`);
    } catch (error: any) {
      fail(label, error.message);
    }
  }

  for (const u of USERS) {
    if (u.role === 'Patient' || u.role === 'Lab') continue;
    const session = sessions.get(u.email);
    if (!session) continue;
    for (const b of u.branches) {
      const label = `practice-info ${u.email} @ ${BRANCHES[b].name}`;
      try {
        const info = await practiceInfo(session.token, BRANCHES[b].clinicNum);
        assert(info.effectiveTimezone === BRANCHES[b].tz, label, `effectiveTimezone ${info.effectiveTimezone} != ${BRANCHES[b].tz}`);
        assert(info.timezone === BRANCHES[b].tz, label, `timezone ${info.timezone} != ${BRANCHES[b].tz}`);
        pass(`${label} -> ${info.effectiveTimezone}`);
      } catch (error: any) {
        fail(label, error.message);
      }
    }
  }

  // Deterministic cross-zone math for one wall clock.
  try {
    const wall = '2026-12-15T03:15';
    const instantOf = (value: string, tz: string) => {
      const [date, time] = value.split('T');
      const [y, m, d] = date.split('-').map(Number);
      const [hh, mm] = time.split(':').map(Number);
      const guess = Date.UTC(y, m - 1, d, hh, mm);
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      const p: Record<string, string> = {};
      for (const part of fmt.formatToParts(new Date(guess))) if (part.type !== 'literal') p[part.type] = part.value;
      const asUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour === '24' ? '00' : p.hour), Number(p.minute));
      return guess - (asUTC - guess);
    };
    const expected: Record<string, string> = {
      'America/New_York': '2026-12-15T08:15:00.000Z',
      'America/Los_Angeles': '2026-12-15T11:15:00.000Z',
      'America/Chicago': '2026-12-15T09:15:00.000Z',
    };
    for (const [tz, iso] of Object.entries(expected)) {
      const actual = new Date(instantOf(wall, tz)).toISOString();
      assert(actual === iso, `wall-clock math ${tz}`, `${actual} != ${iso}`);
      pass(`wall-clock math ${wall} ${tz} -> ${actual}`);
    }
  } catch (error: any) {
    fail('wall-clock math', error.message);
  }

  const creatorFor: Record<BranchKey, string> = {
    A: 'james.downtown@sunrisedental.test',
    B: 'emma.uptown@sunrisedental.test',
    CS: 'owner@citysmiles.test',
  };

  for (const b of Object.keys(BRANCHES) as BranchKey[]) {
    const email = creatorFor[b];
    const session = sessions.get(email);
    if (!session) continue;
    const label = `${email} create past slot @ ${BRANCHES[b].name}`;
    try {
      const { status, body } = await createAppointment(session.token, BRANCHES[b], '2020-01-02', '10:00', '10:30');
      assert(status === 400, label, `expected 400, got ${status}: ${JSON.stringify(body)}`);
      assert(/past/i.test(JSON.stringify(body)), label, `unexpected message ${JSON.stringify(body)}`);
      pass(label);
    } catch (error: any) {
      fail(label, error.message);
    }

    const futureLabel = `${email} create future slot @ ${BRANCHES[b].name}`;
    try {
      const { status, body } = await createAppointment(session.token, BRANCHES[b], '2026-12-15', '03:15', '03:45');
      assert(status === 201, futureLabel, `expected 201, got ${status}: ${JSON.stringify(body)}`);
      const id = String(body?.data?.appointment?._id ?? '');
      assert(id, futureLabel, 'response has no appointment id');
      created.push({ id, token: session.token });
      pass(`${futureLabel} -> AptNum ${id}`);
    } catch (error: any) {
      fail(futureLabel, error.message);
    }
  }

  // Same wall clock, different branch zones: future in Los Angeles, past in
  // New York and Chicago. Proves the guard resolves the branch's own zone.
  try {
    const candidateInstant = Date.now() + 45 * 60 * 1000;
    const la = partsIn(candidateInstant, BRANCHES.B.tz);
    const end = partsIn(candidateInstant + 30 * 60 * 1000, BRANCHES.B.tz);
    const nyNow = partsIn(Date.now(), BRANCHES.A.tz);
    const laNow = partsIn(Date.now(), BRANCHES.B.tz);
    assert(`${la.date}T${la.time}` > `${laNow.date}T${laNow.time}`, 'divergence setup', 'candidate is not in LA future');
    assert(`${la.date}T${la.time}` < `${nyNow.date}T${nyNow.time}`, 'divergence setup', 'candidate is not in NY past');
    console.log(`\nDivergence payload: ${la.date} ${la.time} (future in LA, past in NY/Chicago)`);

    const createWith = async (email: string, b: (typeof BRANCHES)[BranchKey]) => {
      const s = sessions.get(email)!;
      return createAppointment(s.token, b, la.date, la.time, end.time);
    };

    const bRes = await createWith('emma.uptown@sunrisedental.test', BRANCHES.B);
    assert(bRes.status === 201, 'divergence B (LA) future allowed', `expected 201, got ${bRes.status}: ${JSON.stringify(bRes.body)}`);
    const bId = String(bRes.body?.data?.appointment?._id ?? '');
    if (bId) created.push({ id: bId, token: sessions.get('emma.uptown@sunrisedental.test')!.token });
    pass(`divergence: ${la.date} ${la.time} allowed in Los Angeles (AptNum ${bId})`);

    const aRes = await createWith('james.downtown@sunrisedental.test', BRANCHES.A);
    assert(aRes.status === 400 && /past/i.test(JSON.stringify(aRes.body)), 'divergence A (NY) past rejected', `expected 400 past, got ${aRes.status}: ${JSON.stringify(aRes.body)}`);
    pass(`divergence: same wall clock rejected in New York`);

    const csRes = await createWith('owner@citysmiles.test', BRANCHES.CS);
    assert(csRes.status === 400 && /past/i.test(JSON.stringify(csRes.body)), 'divergence CS (Chicago) past rejected', `expected 400 past, got ${csRes.status}: ${JSON.stringify(csRes.body)}`);
    pass(`divergence: same wall clock rejected in Chicago`);
  } catch (error: any) {
    fail('divergence test', error.message);
  }

  for (const item of created) {
    const res = await fetch(`${API}/appointments/${item.id}`, {
      method: 'DELETE',
      headers: authHeaders(item.token),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      fail(`cleanup appointment ${item.id}`, `${res.status} ${JSON.stringify(body)}`);
    }
  }
  if (created.length) pass(`cleanup deleted ${created.length} test appointments`);

  console.log(`\nCreated appointment ids: ${created.map((c) => c.id).join(', ') || '(none)'}`);
  process.stdout.write(`\n${passes} passed, ${failures} failed\n`);
  process.exitCode = failures > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
