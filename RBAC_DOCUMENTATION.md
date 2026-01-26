# Role-Based Access Control (RBAC) System Documentation

## Overview

The MedFlow system implements a comprehensive Role-Based Access Control (RBAC) system that manages user permissions through roles and granular permissions. This system ensures secure access to features based on user roles and specific permissions.

## Architecture

```
USERS → USER_ROLES (Junction Table) → ROLES → PERMISSIONS
```

### Components

1. **Users**: System users with authentication credentials
2. **Roles**: Predefined roles with specific permission sets
3. **User-Roles**: Many-to-many relationship between users and roles
4. **Permissions**: Granular access controls for specific features

## Roles

The system includes the following predefined roles:

### 1. Admin
**Description**: System administrator with full access to all features

**Permissions**:
- Full access to all user management operations
- Complete role management capabilities
- All patient management operations
- Complete appointment management
- All clinical operations (notes, prescriptions)
- Full billing and financial access
- System configuration and settings
- All reports and analytics
- Document management
- Lab operations
- Referrals and authorizations
- Provider and service management
- Insurance management

### 2. Doctor
**Description**: Medical doctor with patient care and clinical access

**Permissions**:
- View all patients
- Edit patient information
- Schedule and manage appointments
- Create and manage clinical notes
- Create and manage prescriptions
- Partial billing access (view and update)
- View financial reports
- View clinical reports
- Access documents
- Create referrals and authorizations
- Create lab orders
- View lab results

### 3. Receptionist
**Description**: Front desk staff with scheduling and patient management access

**Permissions**:
- Create, read, and update patients
- View all patients
- Schedule and manage appointments
- Upload and read documents

### 4. Billing Staff
**Description**: Billing department with financial and patient viewing access

**Permissions**:
- View all patients (read-only)
- Create, read, and update invoices
- Process billing
- Create, read, and update payments
- Process payments
- View financial reports
- Read and update insurance information
- Read and update authorizations

### 5. Patient
**Description**: Patient with limited self-service access to own profile and appointments

**Permissions**:
- Read and update own profile
- Read and create own appointments
- Read own documents
- Read own prescriptions
- Read own lab results
- Read own invoices
- Read own payments

### 6. Lab Tech
**Description**: Laboratory technician with lab orders and results access

**Permissions**:
- Read and update lab orders
- Create, read, and update lab results
- Read patient information (for lab context)

## Permission Matrix

| Feature | Admin | Doctor | Receptionist | Billing Staff | Patient | Lab Tech |
|---------|-------|--------|--------------|---------------|--------|----------|
| View All Patients | ✅ | ✅ | ✅ | ✅ | ❌ (self only) | ❌ |
| Edit Patient Info | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Schedule Appointments | ✅ | ✅ | ✅ | ❌ | ✅ (self) | ❌ |
| Write Clinical Notes | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Process Billing | ✅ | ✅ (partial) | ❌ | ✅ | ❌ | ❌ |
| View Financial Reports | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| System Settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Lab Operations | ✅ | ✅ (read) | ❌ | ❌ | ❌ | ✅ |

## Permission Structure

Permissions follow a hierarchical naming convention: `resource.action`

### Examples:
- `patients.read` - Read patient information
- `patients.create` - Create new patients
- `patients.update` - Update patient information
- `appointments.schedule` - Schedule appointments
- `invoices.process` - Process invoices
- `system.settings` - Access system settings

### Permission Categories

1. **User Management**: `users.*`
2. **Role Management**: `roles.*`
3. **Patient Management**: `patients.*`
4. **Appointment Management**: `appointments.*`
5. **Clinical Operations**: `clinical-notes.*`, `prescriptions.*`
6. **Billing & Financial**: `invoices.*`, `payments.*`
7. **Laboratory**: `lab-orders.*`, `lab-results.*`
8. **Documents**: `documents.*`
9. **Reports**: `reports.*`
10. **System Administration**: `system.*`

## Usage

### Permission Service

The `PermissionService` provides methods to check user permissions:

```typescript
import { PermissionService } from '../services/permission.service';

// Check if user has a specific permission
const canViewPatients = await PermissionService.hasPermission(userId, 'patients.read');

// Check if user has any of the specified permissions
const canManage = await PermissionService.hasAnyPermission(userId, [
  'patients.create',
  'patients.update'
]);

// Check if user has all specified permissions
const canFullAccess = await PermissionService.hasAllPermissions(userId, [
  'patients.read',
  'patients.update',
  'patients.delete'
]);

// Get all user roles
const roles = await PermissionService.getUserRoles(userId);

// Get all user permissions
const permissions = await PermissionService.getUserPermissions(userId);
```

### Permission Middleware

Use permission middleware to protect routes:

```typescript
import { requirePermission, requireAnyPermission } from '../middleware/permission.middleware';

// Require a specific permission
router.get('/patients', 
  authenticate, 
  requirePermission('patients.read'),
  getPatientsController
);

// Require any of the specified permissions
router.post('/appointments',
  authenticate,
  requireAnyPermission('appointments.create', 'appointments.schedule'),
  createAppointmentController
);
```

### Role Middleware

Use role middleware for role-based access:

```typescript
import { requireRoles } from '../middleware/auth.middleware';

// Require specific role(s)
router.get('/admin/users',
  authenticate,
  requireRoles('Admin'),
  getUsersController
);

// Require any of the specified roles
router.get('/patients',
  authenticate,
  requireRoles('Admin', 'Doctor', 'Receptionist'),
  getPatientsController
);
```

## Seeding Roles

To seed the database with default roles and permissions:

```bash
npm run seed:roles
```

This will create all predefined roles with their associated permissions.

## Adding New Permissions

1. Add the permission constant to `backend/src/constants/permissions.ts`
2. Update the role definitions in `backend/src/scripts/seedRoles.ts`
3. Use the permission in your middleware or service checks

## Best Practices

1. **Use Permissions for Granular Control**: Use permissions for fine-grained access control rather than just roles
2. **Combine Role and Permission Checks**: Use both role and permission checks for maximum security
3. **Resource-Level Permissions**: Implement resource-level permission checks (e.g., users can only edit their own profile)
4. **Audit Permission Changes**: Log all permission and role assignments for audit purposes
5. **Regular Permission Reviews**: Periodically review and update permissions based on business needs

## Security Considerations

1. **Principle of Least Privilege**: Users should only have the minimum permissions necessary
2. **Separation of Duties**: Critical operations should require multiple permissions or roles
3. **Permission Inheritance**: Permissions are additive - users get permissions from all their roles
4. **Active Status**: Only active roles and permissions are considered in access checks

## API Endpoints

### Get User Permissions
```http
GET /api/users/:userId/permissions
Authorization: Bearer <token>
```

### Get User Roles
```http
GET /api/users/:userId/roles
Authorization: Bearer <token>
```

### Check Permission
```http
POST /api/permissions/check
Authorization: Bearer <token>
Body: { "permission": "patients.read" }
```

## Examples

### Example 1: Patient Self-Service
```typescript
// Patient can only view their own appointments
if (userRole === 'Patient') {
  if (appointment.patientId !== user.patientId) {
    throw new AuthorizationError('Access denied');
  }
}
```

### Example 2: Doctor Clinical Access
```typescript
// Doctor can create clinical notes
router.post('/clinical-notes',
  authenticate,
  requirePermission('clinical-notes.create'),
  requireRoles('Doctor', 'Admin'),
  createClinicalNoteController
);
```

### Example 3: Billing Staff Financial Access
```typescript
// Billing staff can process invoices
router.post('/invoices/:id/process',
  authenticate,
  requirePermission('invoices.process'),
  requireRoles('Billing Staff', 'Admin'),
  processInvoiceController
);
```

## Troubleshooting

### User doesn't have expected permissions
1. Check if the user has the correct role assigned
2. Verify the role has the required permissions
3. Ensure the role is active
4. Check if permissions are correctly defined in the seed script

### Permission check fails
1. Verify the permission string matches exactly
2. Check if the user's roles are active
3. Ensure the permission is included in the role's permission map
4. Check database for role-permission associations

## Future Enhancements

- [ ] Permission groups for easier management
- [ ] Time-based permissions (temporary access)
- [ ] Location-based permissions
- [ ] Permission templates for common role combinations
- [ ] Permission audit logging
- [ ] Dynamic permission assignment based on context

