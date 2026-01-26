import dotenv from 'dotenv';
import connectDB from '../config/db';
import { UserModel } from '../models/user.model';
import { UserRoleModel } from '../models/user-role.model';
import { RoleModel } from '../models/role.model';
import { hashPassword } from '../utils/password.util';

dotenv.config();

interface UserSeedData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roleName: string;
}

const defaultUsers: UserSeedData[] = [
  {
    email: 'admin@medflow.com',
    password: 'Admin123!',
    firstName: 'System',
    lastName: 'Administrator',
    phone: '+1234567890',
    roleName: 'Admin',
  },
];

const seedUsers = async () => {
  try {
    await connectDB();

    for (const userData of defaultUsers) {
      // Check if user already exists
      const existingUser = await UserModel.findOne({ email: userData.email.toLowerCase() });

      if (existingUser) {
        console.log(`User "${userData.email}" already exists, skipping...`);
        continue;
      }

      // Find the role by name
      const role = await RoleModel.findOne({ name: userData.roleName, isActive: true });

      if (!role) {
        console.error(`❌ Role "${userData.roleName}" not found. Please seed roles first using: npm run seed:roles`);
        continue;
      }

      // Hash password
      const passwordHash = await hashPassword(userData.password);

      // Create user
      const user = await UserModel.create({
        email: userData.email.toLowerCase(),
        passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        preferredLanguage: 'en',
        failedLoginAttempts: 0,
        isActive: true,
      });

      console.log(`✓ Created user: ${userData.email}`);

      // Check if user-role relationship already exists
      const existingUserRole = await UserRoleModel.findOne({
        userId: user._id,
        roleId: role._id,
      });

      if (!existingUserRole) {
        // Create user-role relationship
        await UserRoleModel.create({
          userId: user._id,
          roleId: role._id,
          assignedBy: 'system',
        });
        console.log(`  ✓ Assigned role "${userData.roleName}" to ${userData.email}`);
      } else {
        console.log(`  ⚠ User-role relationship already exists for ${userData.email}`);
      }
    }

    console.log('\n✅ Users seeded successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    defaultUsers.forEach((user) => {
      console.log(`  ${user.roleName.padEnd(15)} | ${user.email.padEnd(25)} | ${user.password}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: Change these passwords after first login!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    process.exit(1);
  }
};

seedUsers();

