import { prisma } from '../config/db.js';

async function patchClaimsToWaiting() {
  try {
    console.log('Patching claims from S to W...');
    const result = await prisma.claim.updateMany({
      where: {
        ClaimStatus: 'S',
      },
      data: {
        ClaimStatus: 'W',
      },
    });
    console.log(`Successfully patched ${result.count} claim(s) from ClaimStatus 'S' to 'W'.`);
  } catch (error) {
    console.error('Patch error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

patchClaimsToWaiting();
