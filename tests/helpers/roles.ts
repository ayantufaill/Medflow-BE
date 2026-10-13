import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/db';
import { hashPassword } from '../../src/utils/password.util';
import { setRoleMeta, setUserMeta } from '../../src/utils/opendental-auth.util';
import { getNextId } from '../../src/utils/opendental-ids.util';
import { DEFAULT_TEST_CLINIC_NUM } from './fixtures';
import { uniqueToken } from './unique';

/**
 * Logs in as a throwaway user whose only role holds exactly `permissions`.
 *
 * Permission-gating tests need a probe that provably lacks the key under
 * test. Seeded roles drift (the screen access matrix gives every staff role
 * at least read on Insurance, for instance), so a test that borrows one ends
 * up asserting whatever that role happens to hold today.
 */
export async function authHeaderWithPermissions(
  permissions: Record<string, boolean>,
  prefix = 'perm-probe'
): Promise<{ Authorization: string }> {
  const token = uniqueToken(prefix);

  const roleNum = await getNextId('usergroup', 'UserGroupNum');
  await prisma.usergroup.create({ data: { UserGroupNum: roleNum, Description: `test_${token}` } });
  await setRoleMeta(roleNum, { description: 'Test probe role', permissions, isSystemRole: false, isActive: true });

  const email = `${token}@example.com`.toLowerCase();
  const password = 'TestPass123!';
  const passwordHash = await hashPassword(password);
  const userNum = await getNextId('userod', 'UserNum');
  await prisma.userod.create({
    data: { UserNum: userNum, UserName: email, Password: passwordHash, IsHidden: 0, ClinicNum: DEFAULT_TEST_CLINIC_NUM },
  });
  await setUserMeta(userNum, { email, passwordHash, firstName: 'Perm', lastName: 'Probe', isActive: true, tokenVersion: 0 });

  const attachNum = await getNextId('usergroupattach', 'UserGroupAttachNum');
  await prisma.usergroupattach.create({ data: { UserGroupAttachNum: attachNum, UserNum: userNum, UserGroupNum: roleNum } });
  const clinicLink = await getNextId('userclinic', 'UserClinicNum');
  await prisma.userclinic.create({ data: { UserClinicNum: clinicLink, UserNum: userNum, ClinicNum: DEFAULT_TEST_CLINIC_NUM } });

  const res = await request(app).post('/api/auth/login').send({ email, password });
  const accessToken = res.body?.data?.tokens?.accessToken;
  if (!accessToken) throw new Error(`Probe login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { Authorization: `Bearer ${accessToken}` };
}
