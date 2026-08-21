import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';
import { RoleService } from './role.service';
import { userService } from './user.service';
import { GROUP_ADMIN_PERMISSIONS } from '../types/auth.types';

const roleService = new RoleService();
const GROUP_ADMIN_ROLE_NAME = 'Group Admin';

export interface BranchSummary {
  id: string;
  name: string;
  city: string | null;
}

export interface PracticeGroupSummary {
  id: number;
  name: string;
  isActive: boolean;
  branches: BranchSummary[];
}

function formatCity(city: string | null | undefined, state: string | null | undefined): string | null {
  if (!city) return null;
  return state ? `${city}, ${state}` : city;
}

function mapBranch(clinic: { ClinicNum: bigint; Description: string | null; City: string | null; State: string | null }): BranchSummary {
  return {
    id: clinic.ClinicNum.toString(),
    name: clinic.Description ?? `Branch ${clinic.ClinicNum}`,
    city: formatCity(clinic.City, clinic.State),
  };
}

export class PracticeGroupService {
  /** Onboards a brand-new, independent practice: the top-level tenant. */
  async createGroup(data: { name: string; config?: Record<string, unknown> }): Promise<PracticeGroupSummary> {
    const existing = await prisma.practicegroup.findFirst({ where: { name: data.name } });
    if (existing) {
      throw new ConflictError(`A practice group named "${data.name}" already exists.`);
    }

    const group = await prisma.practicegroup.create({
      data: { name: data.name, config: (data.config ?? {}) as any },
    });

    return { id: group.id, name: group.name, isActive: group.isActive, branches: [] };
  }

  async getAllGroups(): Promise<PracticeGroupSummary[]> {
    const groups = await prisma.practicegroup.findMany({
      where: { isActive: true },
      include: { clinic: { select: { ClinicNum: true, Description: true, City: true, State: true } } },
      orderBy: { name: 'asc' },
    });
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      isActive: g.isActive,
      branches: g.clinic.map(mapBranch),
    }));
  }

  async getGroupById(groupId: number): Promise<PracticeGroupSummary> {
    const group = await prisma.practicegroup.findUnique({
      where: { id: groupId },
      include: { clinic: { select: { ClinicNum: true, Description: true, City: true, State: true } } },
    });
    if (!group) {
      throw new NotFoundError('Practice group not found.');
    }
    return { id: group.id, name: group.name, isActive: group.isActive, branches: group.clinic.map(mapBranch) };
  }

  /** Provisions a new branch (clinic row) under an existing practice group — no schema cloning. */
  async createBranch(
    groupId: number,
    data: { name: string; address?: string; city?: string; state?: string; zip?: string; phone?: string }
  ): Promise<BranchSummary> {
    const group = await prisma.practicegroup.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundError('Practice group not found.');
    }

    const clinicNum = await getNextId('clinic', 'ClinicNum');
    const clinic = await prisma.clinic.create({
      data: {
        ClinicNum: clinicNum,
        Description: data.name,
        Address: data.address,
        City: data.city,
        State: data.state,
        Zip: data.zip,
        Phone: data.phone,
        GroupNum: groupId,
      },
    });

    return mapBranch(clinic);
  }

  /**
   * Creates the first Group Admin user for a practice group, assigned to one
   * of its branches. Reuses the existing invite flow (userService.createUser
   * — hidden user + email verification link to set a real password) rather
   * than accepting a plaintext password through a provisioning API.
   */
  async createGroupAdmin(
    groupId: number,
    data: { email: string; firstName: string; lastName: string; clinicId: string },
    createdBy: string
  ): Promise<{ message: string }> {
    const group = await prisma.practicegroup.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundError('Practice group not found.');
    }

    const clinicNum = BigInt(data.clinicId);
    const clinic = await prisma.clinic.findUnique({ where: { ClinicNum: clinicNum } });
    if (!clinic || clinic.GroupNum !== groupId) {
      throw new NotFoundError('Branch not found in this practice group.');
    }

    let groupAdminRole = await roleService.getRoleByName(GROUP_ADMIN_ROLE_NAME);
    if (!groupAdminRole) {
      groupAdminRole = await roleService.createRole({
        name: GROUP_ADMIN_ROLE_NAME,
        description: 'Views/manages across all branches within their practice group.',
        permissions: {
          [GROUP_ADMIN_PERMISSIONS.VIEW_ANALYTICS]: true,
          [GROUP_ADMIN_PERMISSIONS.MANAGE_USERS]: true,
          [GROUP_ADMIN_PERMISSIONS.REASSIGN_PROVIDERS]: true,
        },
      });
    }

    const result = await userService.createUser(
      { email: data.email, firstName: data.firstName, lastName: data.lastName, roleIds: [groupAdminRole._id] },
      createdBy
    );

    const newUser = await prisma.userod.findFirst({ where: { UserName: data.email.toLowerCase() } });
    if (!newUser) {
      throw new Error('User creation succeeded but the new user record could not be found.');
    }

    const userClinicNum = await getNextId('userclinic', 'UserClinicNum');
    await prisma.userclinic.create({
      data: { UserClinicNum: userClinicNum, UserNum: newUser.UserNum, ClinicNum: clinicNum },
    });

    return result;
  }
}

export const practiceGroupService = new PracticeGroupService();
