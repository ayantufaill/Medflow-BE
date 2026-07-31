import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { ConflictError, NotFoundError, ValidationError } from '../utils/error.util';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateGroupInput {
  name: string;
  config?: Record<string, unknown>;
}

export interface CreateBranchInput {
  groupId: number;
  name: string;
  subdomain: string;
  config?: Record<string, unknown>;
}

export interface GroupWithBranches {
  id: number;
  name: string;
  config: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  branches: BranchRecord[];
}

export interface BranchRecord {
  id: number;
  groupId: number;
  name: string;
  schemaName: string;
  subdomain: string;
  config: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Converts a user-provided subdomain into a safe Postgres schema name.
 * e.g. "riverside-dental" → "branch_riverside_dental"
 * Only lowercase alphanumeric + underscores allowed; max 63 chars (Postgres limit).
 */
function toSchemaName(subdomain: string): string {
  const sanitized = subdomain
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (!sanitized) {
    throw new ValidationError('Subdomain produces an invalid schema name after sanitization.');
  }

  const schemaName = `branch_${sanitized}`.slice(0, 63);
  return schemaName;
}

/**
 * Validates that a subdomain string is safe (alphanumeric + hyphens only).
 */
function validateSubdomain(subdomain: string): void {
  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    throw new ValidationError(
      'Subdomain must contain only lowercase letters, numbers, and hyphens.'
    );
  }
  if (subdomain.length < 2 || subdomain.length > 63) {
    throw new ValidationError('Subdomain must be between 2 and 63 characters.');
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class TenantProvisioningService {
  // ── Group Operations ────────────────────────────────────────────────────────

  /**
   * Creates a new Group (top-level organization).
   * Only a Super Admin should call this.
   */
  async createGroup(input: CreateGroupInput): Promise<GroupWithBranches> {
    const existing = await prisma.groups.findFirst({
      where: { name: input.name, isActive: true },
    });
    if (existing) {
      throw new ConflictError(`A group named "${input.name}" already exists.`);
    }

    const group = await prisma.groups.create({
      data: {
        name: input.name,
        config: (input.config ?? {}) as Prisma.InputJsonValue,
        isActive: true,
      },
      include: { branches: true },
    });

    return this.mapGroup(group);
  }

  /**
   * Returns all active groups with their branches.
   */
  async getAllGroups(): Promise<GroupWithBranches[]> {
    const groups = await prisma.groups.findMany({
      where: { isActive: true },
      include: { branches: { where: { isActive: true } } },
      orderBy: { name: 'asc' },
    });
    return groups.map(this.mapGroup);
  }

  /**
   * Returns a single group by ID with its branches.
   */
  async getGroupById(groupId: number): Promise<GroupWithBranches> {
    const group = await prisma.groups.findFirst({
      where: { id: groupId, isActive: true },
      include: { branches: { where: { isActive: true } } },
    });
    if (!group) {
      throw new NotFoundError(`Group ${groupId} not found.`);
    }
    return this.mapGroup(group);
  }

  // ── Branch Operations ───────────────────────────────────────────────────────

  /**
   * Creates a new Branch under an existing Group.
   * This method:
   *  1. Validates the group exists.
   *  2. Generates a safe Postgres schema name from the subdomain.
   *  3. Creates the schema in Postgres (DDL executed directly).
   *  4. Saves the branch record to the shared `branches` table.
   *
   * The actual table creation inside the new schema (cloning the OpenDental
   * schema structure) should be handled by a separate migration script or
   * the Schema Clone utility — this service only creates the schema container.
   */
  async createBranch(input: CreateBranchInput): Promise<BranchRecord> {
    // 1. Validate subdomain format
    validateSubdomain(input.subdomain);

    // 2. Confirm group exists
    const group = await prisma.groups.findFirst({
      where: { id: input.groupId, isActive: true },
    });
    if (!group) {
      throw new NotFoundError(`Group ${input.groupId} not found.`);
    }

    // 3. Check for subdomain uniqueness
    const existingSubdomain = await prisma.branches.findFirst({
      where: { subdomain: input.subdomain },
    });
    if (existingSubdomain) {
      throw new ConflictError(`Subdomain "${input.subdomain}" is already taken.`);
    }

    // 4. Derive schema name and check uniqueness
    const schemaName = toSchemaName(input.subdomain);
    const existingSchema = await prisma.branches.findFirst({
      where: { schemaName },
    });
    if (existingSchema) {
      throw new ConflictError(`Schema name "${schemaName}" already exists.`);
    }

    // 5. Create the Postgres schema directly via raw SQL.
    //    We use $executeRawUnsafe here because $executeRaw does not support
    //    parameterized DDL statements (CREATE SCHEMA). The schema name is
    //    sanitized above via toSchemaName(), making it safe.
    await (prisma as any).$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    console.log(`✅ Postgres schema created: "${schemaName}"`);

    // 6. Persist the branch record in the shared schema
    const branch = await prisma.branches.create({
      data: {
        groupId: input.groupId,
        name: input.name,
        schemaName,
        subdomain: input.subdomain,
        config: (input.config ?? {}) as Prisma.InputJsonValue,
        isActive: true,
      },
    });

    return this.mapBranch(branch);
  }

  /**
   * Returns all active branches for a given group.
   */
  async getBranchesByGroup(groupId: number): Promise<BranchRecord[]> {
    const branches = await prisma.branches.findMany({
      where: { groupId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return branches.map(this.mapBranch);
  }

  /**
   * Looks up a branch by its subdomain (used by Tenant Resolver Middleware).
   * Returns null if not found — caller decides how to handle missing tenant.
   */
  async getBranchBySubdomain(subdomain: string): Promise<BranchRecord | null> {
    const branch = await prisma.branches.findFirst({
      where: { subdomain, isActive: true },
    });
    return branch ? this.mapBranch(branch) : null;
  }

  /**
   * Soft-deletes a branch (sets isActive = false).
   * Does NOT drop the Postgres schema to prevent accidental data loss.
   * A Super Admin must manually drop the schema after verifying data migration.
   */
  async deactivateBranch(branchId: number): Promise<void> {
    const branch = await prisma.branches.findFirst({ where: { id: branchId } });
    if (!branch) {
      throw new NotFoundError(`Branch ${branchId} not found.`);
    }
    await prisma.branches.update({
      where: { id: branchId },
      data: { isActive: false },
    });
  }

  // ── Shared Patient Identity ─────────────────────────────────────────────────

  /**
   * Finds or creates a master patient record for cross-branch identity.
   * Used when registering a new patient at any branch within a group.
   */
  async findOrCreateMasterPatient(data: {
    groupId: number;
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    email?: string;
    phone?: string;
  }): Promise<{ id: number; isNew: boolean }> {
    // Attempt to match on name + DOB within the same group
    const existing = await prisma.patients_master.findFirst({
      where: {
        groupId: data.groupId,
        firstName: { equals: data.firstName, mode: 'insensitive' },
        lastName: { equals: data.lastName, mode: 'insensitive' },
        dateOfBirth: data.dateOfBirth,
      },
    });

    if (existing) {
      return { id: existing.id, isNew: false };
    }

    const created = await prisma.patients_master.create({
      data: {
        groupId: data.groupId,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        email: data.email,
        phone: data.phone,
      },
    });

    return { id: created.id, isNew: true };
  }

  // ── Private Mappers ─────────────────────────────────────────────────────────

  private mapGroup(raw: any): GroupWithBranches {
    return {
      id: raw.id,
      name: raw.name,
      config: raw.config as Record<string, unknown> | null,
      isActive: raw.isActive,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      branches: (raw.branches ?? []).map((b: any) => this.mapBranch(b)),
    };
  }

  private mapBranch(raw: any): BranchRecord {
    return {
      id: raw.id,
      groupId: raw.groupId,
      name: raw.name,
      schemaName: raw.schemaName,
      subdomain: raw.subdomain,
      config: raw.config as Record<string, unknown> | null,
      isActive: raw.isActive,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}

export const tenantProvisioningService = new TenantProvisioningService();
