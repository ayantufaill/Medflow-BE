# Postman Collection Setup Guide

## Import Collection

1. Open Postman
2. Click **Import** button (top left)
3. Select `MedFlow_API.postman_collection.json`
4. Select `MedFlow_API.postman_environment.json` (optional but recommended)

## Environment Setup

### Create/Select Environment

1. Click the **Environments** icon in the left sidebar
2. Create a new environment or select "MedFlow - Development"
3. Set the following variables:

| Variable | Initial Value | Description |
|----------|---------------|-------------|
| `baseUrl` | `http://localhost:5000` | API base URL |
| `accessToken` | (auto-set) | JWT access token |
| `refreshToken` | (auto-set) | JWT refresh token |
| `userId` | (auto-set) | Current user ID |
| `roleId` | (manual) | Role ID for role operations |

### Auto-Set Variables

The collection automatically sets these variables after successful requests:
- `accessToken` - Set after Register/Login/Refresh Token
- `refreshToken` - Set after Register/Login/Refresh Token
- `userId` - Set after Register/Login

## Using the Collection

### Quick Start

1. **Start the server**: `npm run dev`
2. **Seed roles** (first time only): `npm run seed:roles`
3. **Register a new user**:
   - Use the "Register" request in Authentication folder
   - Update email/password in the request body
   - Tokens will be auto-saved to environment

4. **Login**:
   - Use the "Login" request
   - Tokens will be auto-saved

5. **Access protected endpoints**:
   - All User Management endpoints require authentication
   - Bearer token is automatically included from environment

### Authentication Flow

1. **Register** → Get tokens (auto-saved)
2. **Login** → Get tokens (auto-saved)
3. **Get Profile** → Uses saved access token
4. **Refresh Token** → Get new tokens when access token expires
5. **Logout** → Invalidate tokens (blacklist access and refresh tokens)

### User Management

- **Get All Users**: Admin only, supports pagination and search
- **Get User by ID**: Users can view own profile, admins can view any
- **Update User**: Users can update themselves, admins can update any
- **Update Own Profile**: Update current user's profile
- **Change Password**: Change current user's password
- **Assign Role**: Admin only, requires roleId
- **Remove Role**: Admin only
- **Delete User**: Admin only

### RBAC & Permissions

- **Get User Permissions**: Get all permissions for a user (from all their roles). Users can view their own permissions, admins can view any user's permissions.
- **Get User Roles**: Get all roles assigned to a user. Users can view their own roles, admins can view any user's roles.
- **Check Permission**: Check if a user has a specific permission. Returns boolean. If userId is not provided, checks the authenticated user.
- **Get All Roles**: Admin only, get all active roles in the system with their permissions. Useful for viewing available roles before assigning them.
- **Get Role by ID**: Admin only, get a specific role by ID with its full permission set.
- **Create Role**: Admin only, create a new role with custom permissions. Requires `roles.create` permission.
- **Update Role**: Admin only, update an existing role. Requires `roles.update` permission. Cannot update name of system roles.
- **Delete Role**: Admin only, delete a role. Requires `roles.delete` permission. System roles cannot be deleted. Soft-deletes if role is assigned to users.
- **Get Users with Role**: Admin only, get all users assigned to a specific role with pagination.

## Example Requests

### Register Request Body
```json
{
    "email": "john.doe@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "preferredLanguage": "en",
    "roleId": "role-uuid-here"
}
```

**Note**: `roleId` is optional. If not provided, the user will be assigned the default "Patient" role.

### Login Request Body
```json
{
    "email": "john.doe@example.com",
    "password": "SecurePass123!"
}
```

### Update User Request Body
```json
{
    "firstName": "John Updated",
    "lastName": "Doe Updated",
    "phone": "+1234567891",
    "preferredLanguage": "en",
    "isActive": true
}
```

### Change Password Request Body
```json
{
    "currentPassword": "SecurePass123!",
    "newPassword": "NewSecurePass123!"
}
```

**Note**: When password is changed, all existing tokens are automatically invalidated. User must login again.

### Logout Request Body
```json
{
    "refreshToken": "refresh-token-here"
}
```

**Note**: `refreshToken` is optional. If provided, both access and refresh tokens will be blacklisted. If not provided, only the access token from the Authorization header will be blacklisted.

### Assign Role Request Body
```json
{
    "roleId": "role-uuid-here"
}
```

### Check Permission Request Body
```json
{
    "permission": "patients.read",
    "userId": "user-uuid-here"
}
```

**Note**: If `userId` is not provided, the endpoint checks the authenticated user's permissions.

## Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*(),.?":{}|<>)

## Role Names

Default roles (after seeding):
- `Admin` - Full system access
- `Doctor` - Medical care access
- `Receptionist` - Scheduling access
- `Billing Staff` - Financial access
- `Patient` - Self-service access
- `Lab Tech` - Laboratory access

## Permissions

Permissions follow the format: `resource.action`

### Common Permissions

**User Management:**
- `users.create` - Create new users
- `users.read` - Read user information
- `users.update` - Update user information
- `users.delete` - Delete users
- `users.manage` - Full user management

**Role Management:**
- `roles.create` - Create new roles
- `roles.read` - Read role information
- `roles.update` - Update roles
- `roles.delete` - Delete roles
- `roles.manage` - Full role management

**Patient Management:**
- `patients.create` - Create new patients
- `patients.read` - Read patient information
- `patients.update` - Update patient information
- `patients.delete` - Delete patients
- `patients.view_all` - View all patients

**Appointment Management:**
- `appointments.create` - Create appointments
- `appointments.read` - Read appointments
- `appointments.update` - Update appointments
- `appointments.schedule` - Schedule appointments
- `appointments.cancel` - Cancel appointments

**Clinical Operations:**
- `clinical-notes.create` - Create clinical notes
- `clinical-notes.read` - Read clinical notes
- `clinical-notes.update` - Update clinical notes
- `prescriptions.create` - Create prescriptions
- `prescriptions.read` - Read prescriptions

**Billing & Financial:**
- `invoices.create` - Create invoices
- `invoices.read` - Read invoices
- `invoices.update` - Update invoices
- `invoices.process` - Process invoices
- `payments.create` - Create payments
- `payments.read` - Read payments
- `payments.process` - Process payments
- `reports.financial` - View financial reports

**System:**
- `system.settings` - Access system settings
- `system.configure` - Configure system

For a complete list of permissions, see `backend/src/constants/permissions.ts` or the RBAC documentation.

## Error Responses

All errors follow this format:
```json
{
    "success": false,
    "error": {
        "message": "Error message here"
    }
}
```

## Success Responses

All success responses follow this format:
```json
{
    "success": true,
    "data": {
        // Response data
    }
}
```

## Tips

1. **Token Expiration**: Access tokens expire in 15 minutes. Use "Refresh Token" to get new tokens.
2. **Rate Limiting**: Auth endpoints are rate-limited (5 requests per 15 minutes per IP).
3. **Admin Access**: To test admin endpoints, first create a user, then assign the "Admin" role using the role ID from the database.
4. **Environment Variables**: The collection automatically saves tokens after Register/Login/Refresh Token requests.
5. **Bearer Token**: All authenticated requests use Bearer token authentication from the `accessToken` environment variable.
6. **RBAC Testing**: 
   - Use "Get All Roles" to see available roles and their IDs
   - Use "Get User Permissions" to verify a user's permissions
   - Use "Check Permission" to test if a user has a specific permission
   - Remember to seed roles first: `npm run seed:roles`
7. **Permission Format**: Permissions use `resource.action` format (e.g., `patients.read`, `appointments.create`)
8. **Role-Based vs Permission-Based**: Some endpoints check roles, others check permissions. See RBAC documentation for details.

