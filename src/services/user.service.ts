import { UserModel } from '../models/user.model';
import { UserRoleModel } from '../models/user-role.model';
import { RoleModel } from '../models/role.model';
import { ProviderModel } from '../models/provider.model';
import { AuditLogModel } from '../models/audit-log.model';
import { SecurityEventModel } from '../models/security-event.model';
import { EmailVerificationModel } from '../models/email-verification.model';
import { hashPassword } from '../utils/password.util';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity, logSecurityEvent } from '../utils/activity-logger.util';
import { emailService } from './email.service';
import crypto from 'crypto';
import type { UserWithRoles } from '../types/auth.types';

export class UserService {
  async getAllUsers(page = 1, limit = 10, search?: string, roleId?: string, status?: string) {
    const skip = (page - 1) * limit;
    const query: any = {};

    // Search filter - includes phone number and full name combination
    if (search) {
      // Split search term to handle "firstName lastName" searches
      const searchTerms = search.trim().split(/\s+/).filter(term => term.length > 0);

      if (searchTerms.length > 1) {
        // Multiple words - try both orders: "John Doe" and "Doe John"
        const firstNameSearch = searchTerms[0];
        const lastNameSearch = searchTerms.slice(1).join(' ');
        const reverseFirstNameSearch = searchTerms[searchTerms.length - 1];
        const reverseLastNameSearch = searchTerms.slice(0, -1).join(' ');

        query.$or = [
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          // Match full name combination: "John Doe" -> firstName="John", lastName="Doe"
          {
            $and: [
              { firstName: { $regex: firstNameSearch, $options: 'i' } },
              { lastName: { $regex: lastNameSearch, $options: 'i' } },
            ],
          },
          // Match reverse order: "Doe John" -> firstName="John", lastName="Doe"
          {
            $and: [
              { firstName: { $regex: reverseFirstNameSearch, $options: 'i' } },
              { lastName: { $regex: reverseLastNameSearch, $options: 'i' } },
            ],
          },
          // Also match individual fields for partial searches
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
        ];
      } else {
        // Single word - search in all fields
        query.$or = [
          { email: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
        ];
      }
    }

    // Status filter (isActive)
    if (status !== undefined && status !== '') {
      if (status === 'active') {
        query.isActive = true;
      } else if (status === 'inactive') {
        query.isActive = false;
      }
    }

    // If role filter is applied, first get user IDs with that role
    let userIdsWithRole: string[] = [];
    if (roleId) {
      const userRoles = await UserRoleModel.find({ roleId }).select('userId');
      userIdsWithRole = userRoles.map((ur) => ur.userId.toString());

      // If no users have this role, return empty result
      if (userIdsWithRole.length === 0) {
        return {
          users: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0,
          },
        };
      }

      // Add role filter to query
      query._id = { $in: userIdsWithRole };
    }

    // Get users matching all filters
    const [users, total] = await Promise.all([
      UserModel.find(query)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(query),
    ]);

    // Get roles for all users
    const userIds = users.map((user) => user._id);
    const userRoles = await UserRoleModel.find({ userId: { $in: userIds } });
    const roleIds = [...new Set(userRoles.map((ur) => ur.roleId))];
    const roles = await RoleModel.find({ _id: { $in: roleIds }, isActive: true });

    // Map roles to users
    const usersWithRoles = users.map((user) => {
      const userRoleIds = userRoles
        .filter((ur) => ur.userId.toString() === user._id.toString())
        .map((ur) => ur.roleId.toString());

      const userRolesData = roles.filter((role) =>
        userRoleIds.includes(role._id.toString())
      );

      return {
        ...user,
        roles: userRolesData,
      };
    });

    return {
      users: usersWithRoles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(userId: string): Promise<UserWithRoles> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const userRoles = await UserRoleModel.find({ userId });
    const roleIds = userRoles.map((ur) => ur.roleId);
    const roles = await RoleModel.find({ _id: { $in: roleIds }, isActive: true });

    return {
      ...this.sanitizeUser(user),
      roles: roles as any,
    } as UserWithRoles;
  }

  async updateUser(userId: string, updates: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    preferredLanguage?: string;
    isActive?: boolean;
  }, requestInfo?: { ipAddress?: string; userAgent?: string }) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const oldValues = {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      preferredLanguage: user.preferredLanguage,
      isActive: user.isActive,
    };

    Object.assign(user, updates);
    await user.save();

    // Log user update activity
    await logActivity(
      userId,
      'updated',
      'users',
      userId,
      oldValues,
      updates,
      requestInfo?.ipAddress,
      requestInfo?.userAgent,
      updates.isActive !== undefined ? 'medium' : 'low'
    );

    return this.sanitizeUser(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await UserModel.findById(userId).select('+passwordHash');
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const { comparePassword } = await import('../utils/password.util.js');
    const isPasswordValid = await comparePassword(currentPassword, (user as any).passwordHash);

    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Update password and increment token version to invalidate all existing tokens
    (user as any).passwordHash = await hashPassword(newPassword);
    (user as any).tokenVersion = ((user as any).tokenVersion || 0) + 1;
    await user.save();

    // Log password change
    await logSecurityEvent(
      userId,
      'password_change',
      `Password changed for user ${userId}`,
      undefined,
      'medium'
    );

    return { message: 'Password changed successfully. All existing sessions have been invalidated.' };
  }

  async assignRole(userId: string, roleId: string, assignedBy: string) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const role = await RoleModel.findById(roleId);
    if (!role) {
      throw new NotFoundError('Role not found');
    }

    const existingUserRole = await UserRoleModel.findOne({ userId, roleId });
    if (existingUserRole) {
      throw new ConflictError('User already has this role');
    }

    await UserRoleModel.create({
      userId,
      roleId,
      assignedBy,
    });

    // Log role assignment activity
    await logActivity(
      assignedBy,
      'created',
      'user_roles',
      `${userId}-${roleId}`,
      undefined,
      { userId, roleId, assignedBy },
      undefined,
      undefined,
      'low'
    );

    return this.getUserById(userId);
  }

  async removeRole(userId: string, roleId: string, removedBy?: string) {
    const result = await UserRoleModel.findOneAndDelete({ userId, roleId });
    if (!result) {
      throw new NotFoundError('User role not found');
    }

    // Log role removal activity
    if (removedBy) {
      await logActivity(
        removedBy,
        'deleted',
        'user_roles',
        `${userId}-${roleId}`,
        { userId, roleId },
        undefined,
        undefined,
        undefined,
        'low'
      );
    }

    return { message: 'Role removed successfully' };
  }

  async deleteUser(userId: string, deletedBy?: string) {
    const user = await UserModel.findByIdAndDelete(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Also remove all user roles
    await UserRoleModel.deleteMany({ userId });

    // Log user deletion activity
    if (deletedBy) {
      await logActivity(
        deletedBy,
        'deleted',
        'users',
        userId,
        { email: user.email, firstName: user.firstName, lastName: user.lastName },
        undefined,
        undefined,
        undefined,
        'high'
      );
    }

    return { message: 'User deleted successfully' };
  }

  /**
   * Activate a user account
   */
  async activateUser(userId: string) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if ((user as any).isActive) {
      return { message: 'User is already active', user: this.sanitizeUser(user) };
    }

    (user as any).isActive = true;
    await user.save();

    // Log user activation activity
    await logActivity(
      String(user._id),
      'updated',
      'users',
      userId,
      { isActive: false },
      { isActive: true },
      undefined,
      undefined,
      'low'
    );

    return {
      message: 'User activated successfully',
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Deactivate a user account
   */
  async deactivateUser(userId: string) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!(user as any).isActive) {
      return { message: 'User is already deactivated', user: this.sanitizeUser(user) };
    }

    (user as any).isActive = false;
    // Increment token version to invalidate all existing tokens
    (user as any).tokenVersion = ((user as any).tokenVersion || 0) + 1;
    await user.save();

    // Log user deactivation activity
    await logActivity(
      String(user._id),
      'updated',
      'users',
      userId,
      { isActive: true },
      { isActive: false },
      undefined,
      undefined,
      'medium'
    );

    // Log session end event
    await logSecurityEvent(
      String(user._id),
      'session_end',
      `User account deactivated: ${user.email}. All sessions invalidated.`,
      undefined,
      'medium'
    );

    return {
      message: 'User deactivated successfully. All existing sessions have been invalidated.',
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Get user activity logs (audit logs)
   */
  async getUserActivity(
    userId: string,
    page = 1,
    limit = 20,
    search?: string,
    startDate?: string,
    endDate?: string
  ) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const skip = (page - 1) * limit;

    // Build query filter
    const filter: any = { userId };

    // Add date filters
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Set end date to end of day (23:59:59.999)
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Add search filter
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      filter.$or = [
        { action: searchRegex },
        { tableName: searchRegex },
        { ipAddress: searchRegex },
        { userAgent: searchRegex },
      ];
    }

    const [activities, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLogModel.countDocuments(filter),
    ]);

    return {
      activities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user login history (security events)
   */
  async getUserLoginHistory(
    userId: string,
    page = 1,
    limit = 20,
    search?: string,
    startDate?: string,
    endDate?: string
  ) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const skip = (page - 1) * limit;

    // Build query filter
    const filter: any = {
      userId,
      eventType: { $in: ['login_success', 'login_failure', 'session_end'] },
    };

    // Add date filters (using occurredAt for security events)
    if (startDate || endDate) {
      filter.occurredAt = {};
      if (startDate) {
        filter.occurredAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Set end date to end of day (23:59:59.999)
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.occurredAt.$lte = end;
      }
    }

    // Add search filter
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      filter.$or = [
        { eventType: searchRegex },
        { description: searchRegex },
        { ipAddress: searchRegex },
      ];
    }

    const [loginHistory, total] = await Promise.all([
      SecurityEventModel.find(filter)
        .sort({ occurredAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SecurityEventModel.countDocuments(filter),
    ]);

    return {
      loginHistory,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create user by admin (inactive, no password) and send verification link
   */
  async createUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    preferredLanguage?: string;
    roleIds?: string[];
  }, createdBy?: string): Promise<{ user: any; message: string }> {
    // Check if user already exists
    const existingUser = await UserModel.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Generate a temporary password hash (will be replaced when user sets password)
    const tempPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await hashPassword(tempPassword);

    // Create inactive user
    const user = await UserModel.create({
      email: data.email.toLowerCase(),
      passwordHash, // Temporary, will be updated when user sets password
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      preferredLanguage: data.preferredLanguage || 'en',
      isActive: false, // User is inactive until they set password
    });

    // Assign roles if provided
    if (data.roleIds && data.roleIds.length > 0) {
      // Validate all roles exist and are active
      const roles = await RoleModel.find({ _id: { $in: data.roleIds }, isActive: true });
      if (roles.length !== data.roleIds.length) {
        // Rollback user creation
        await UserModel.deleteOne({ _id: user._id });
        throw new NotFoundError('One or more roles not found or inactive');
      }

      // Create user roles
      const userRoles = data.roleIds.map(roleId => ({
        userId: user._id,
        roleId,
        assignedBy: createdBy || 'system',
      }));

      await UserRoleModel.insertMany(userRoles);

      // Log role assignment activities
      for (const roleId of data.roleIds) {
        await logActivity(
          createdBy || 'system',
          'created',
          'user_roles',
          `${user._id}-${roleId}`,
          undefined,
          { userId: user._id, roleId, assignedBy: createdBy || 'system' },
          undefined,
          undefined,
          'low'
        );
      }
    } else {
      // Assign default Patient role if no roles provided
      const patientRole = await RoleModel.findOne({ name: 'Patient' });
      if (patientRole) {
        await UserRoleModel.create({
          userId: user._id,
          roleId: patientRole._id,
          assignedBy: createdBy || 'system',
        });
      }
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create or update verification record
    const existingVerification = await EmailVerificationModel.findOne({
      email: data.email.toLowerCase(),
      verified: false,
    });

    if (existingVerification) {
      (existingVerification as any).token = token;
      (existingVerification as any).expiresAt = expiresAt;
      (existingVerification as any).registrationData = { userId: user._id };
      await existingVerification.save();
    } else {
      await EmailVerificationModel.create({
        email: data.email.toLowerCase(),
        token,
        registrationData: { userId: user._id },
        expiresAt,
      });
    }

    // Send verification email with link
    await emailService.sendVerificationLink(data.email, token, data.firstName);

    // Log user creation activity
    if (createdBy) {
      await logActivity(
        createdBy,
        'created',
        'users',
        String(user._id),
        undefined,
        { email: user.email, firstName: user.firstName, lastName: user.lastName },
        undefined,
        undefined,
        'low'
      );
    }

    return {
      user: this.sanitizeUser(user),
      message: 'User created successfully. Verification email sent.',
    };
  }

  /**
   * Verify token and set password (activate account)
   */
  async verifyTokenAndSetPassword(token: string, password: string): Promise<{ message: string; user: any }> {
    // Find verification record
    const verification = await EmailVerificationModel.findOne({
      token,
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!verification) {
      throw new NotFoundError('Invalid or expired verification link');
    }

    const registrationData = verification.registrationData as { userId: string };
    const userId = registrationData.userId;

    // Get user
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if user is already active
    if (user.isActive) {
      // Mark verification as used
      (verification as any).verified = true;
      await verification.save();
      throw new ConflictError('Account is already activated. Please login.');
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update user: set password and activate
    (user as any).passwordHash = passwordHash;
    (user as any).isActive = true;
    await user.save();

    // Mark verification as used
    (verification as any).verified = true;
    await verification.save();

    // Clean up verification record
    await EmailVerificationModel.deleteOne({ _id: verification._id });

    // Log security event
    await logSecurityEvent(
      String(user._id),
      'login_success',
      `Account activated and password set: ${user.email}`,
      undefined,
      'low'
    );

    return {
      message: 'Password set successfully. Your account is now active.',
      user: this.sanitizeUser(user),
    };
  }

  private sanitizeUser(user: any): Omit<any, 'passwordHash'> {
    const { passwordHash, ...sanitized } = user.toObject();
    return sanitized;
  }

  /**
   * Get users by role name
   */
  async getUsersByRoleName(roleName: string, page = 1, limit = 100, status?: string, excludeWithProvider?: boolean) {
    const role = await RoleModel.findOne({ name: roleName, isActive: true }).lean();

    if (!role) {
      return {
        users: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
        },
      };
    }

    const skip = (page - 1) * limit;
    const query: any = {};

    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    const userRoles = await UserRoleModel.find({ roleId: role._id }).select('userId');
    const userIdsWithRole = userRoles.map((ur) => ur.userId.toString());

    if (userIdsWithRole.length === 0) {
      return {
        users: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
        },
      };
    }

    let filteredUserIds = userIdsWithRole;

    if (excludeWithProvider) {
      const providers = await ProviderModel.find({ userId: { $in: userIdsWithRole } }).select('userId').lean();
      const userIdsWithProvider = new Set(providers.map((p) => p.userId.toString()));
      filteredUserIds = userIdsWithRole.filter((id) => !userIdsWithProvider.has(id));

      if (filteredUserIds.length === 0) {
        return {
          users: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0,
          },
        };
      }
    }

    query._id = { $in: filteredUserIds };

    const [users, total] = await Promise.all([
      UserModel.find(query)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(query),
    ]);

    const userIds = users.map((user) => user._id);
    const userRolesData = await UserRoleModel.find({ userId: { $in: userIds } });
    const roleIds = [...new Set(userRolesData.map((ur) => ur.roleId))];
    const roles = await RoleModel.find({ _id: { $in: roleIds }, isActive: true });

    const usersWithRoles = users.map((user) => {
      const userRoleIds = userRolesData
        .filter((ur) => ur.userId.toString() === user._id.toString())
        .map((ur) => ur.roleId.toString());

      const userRolesResult = roles.filter((r) =>
        userRoleIds.includes(r._id.toString())
      );

      return {
        ...user,
        roles: userRolesResult,
      };
    });

    return {
      users: usersWithRoles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

export const userService = new UserService();

