import { prisma } from './src/config/db';
import { getUserMeta, setUserMeta } from './src/utils/opendental-auth.util';
import { hashPassword, comparePassword } from './src/utils/password.util';

async function testLogin() {
  try {
    console.log('Testing login flow...\n');

    // 1. Find admin user
    const user = await prisma.userod.findFirst({
      where: { UserName: 'admin@example.com' },
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:', {
      UserNum: user.UserNum,
      UserName: user.UserName,
      Password: user.Password ? `${user.Password.substring(0, 20)}...` : 'NULL',
    });

    // 2. Get user meta
    const meta = await getUserMeta(user.UserNum);
    console.log('\n✅ User meta retrieved:', {
      ...meta,
      passwordHash: meta.passwordHash ? `${meta.passwordHash.substring(0, 20)}...` : 'NULL',
    });

    // 3. Test password comparison
    const testPassword = 'Admin123!';
    const passwordInDb = user.Password || meta.passwordHash || '';
    
    console.log('\n🔍 Testing password comparison:');
    console.log('  Test password:', testPassword);
    console.log('  Password in DB:', passwordInDb ? `${passwordInDb.substring(0, 20)}...` : 'NULL');

    if (!passwordInDb) {
      console.log('❌ No password found in user or meta!');
      return;
    }

    const isValid = await comparePassword(testPassword, passwordInDb);
    console.log('  Is valid:', isValid);

    if (!isValid) {
      console.log('❌ Password comparison failed!');
      
      // Try to create a new hash and verify it works
      console.log('\n🔧 Creating fresh password hash...');
      const freshHash = await hashPassword(testPassword);
      const freshCompare = await comparePassword(testPassword, freshHash);
      console.log('  Fresh hash valid:', freshCompare);
      
      // Update the user with fresh hash
      if (freshCompare) {
        console.log('\n📝 Updating user with fresh password hash...');
        await prisma.userod.update({
          where: { UserNum: user.UserNum },
          data: { Password: freshHash },
        });
        
        await setUserMeta(user.UserNum, {
          ...meta,
          passwordHash: freshHash,
        });
        
        console.log('✅ User updated with new password hash');
      }
    }

    console.log('\n✅ Test completed successfully');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
