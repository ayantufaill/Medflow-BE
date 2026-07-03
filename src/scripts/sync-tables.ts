import { PrismaClient } from '@prisma/client';

// Read connection strings from environment variables
const LOCAL_URL = process.env.LOCAL_DATABASE_URL;
const RAILWAY_URL = process.env.RAILWAY_DATABASE_URL;

if (!LOCAL_URL || !RAILWAY_URL) {
  console.error("❌ Error: Both LOCAL_DATABASE_URL and RAILWAY_DATABASE_URL must be set.");
  process.exit(1);
}

// Initialize two separate Prisma Clients
const localPrisma = new PrismaClient({
  datasources: { db: { url: LOCAL_URL } },
});

const railwayPrisma = new PrismaClient({
  datasources: { db: { url: RAILWAY_URL } },
});

async function syncTable(
  tableName: 'definition' | 'clinic' | 'provider' | 'procedurecode' | 'operatory',
  pkField: string
) {
  console.log(`\n--- Syncing ${tableName} ---`);
  
  try {
    // 1. Verify target table is empty
    // @ts-ignore - dynamic model access
    const railwayCount = await railwayPrisma[tableName].count();
    if (railwayCount > 0) {
      console.error(`❌ Aborting: ${tableName} on Railway is not empty (contains ${railwayCount} rows).`);
      return;
    }
    
    // 2. Fetch all local rows
    // @ts-ignore
    const localRows = await localPrisma[tableName].findMany();
    console.log(`Fetched ${localRows.length} rows from local ${tableName}.`);
    
    if (localRows.length === 0) {
      console.log(`No rows to sync for ${tableName}.`);
      return;
    }

    // 3. Insert rows one by one to handle errors gracefully
    let successCount = 0;
    let failCount = 0;

    for (const row of localRows) {
      try {
        // @ts-ignore
        await railwayPrisma[tableName].create({
          data: row
        });
        successCount++;
      } catch (err: any) {
        failCount++;
        // The pk value helps identify which row failed
        const pkValue = (row as any)[pkField];
        console.error(`Failed to insert row (${pkField}=${pkValue}):`, err.message || err);
      }
    }

    console.log(`✅ Finished ${tableName}: ${successCount} inserted, ${failCount} failed.`);
  } catch (err) {
    console.error(`Fatal error syncing ${tableName}:`, err);
  }
}

async function main() {
  console.log("Starting DB Sync...");
  
  // Sync dependencies first to satisfy foreign key constraints
  await syncTable('definition', 'DefNum');
  await syncTable('clinic', 'ClinicNum');
  await syncTable('provider', 'ProvNum');

  // Sync procedurecode and operatory
  await syncTable('procedurecode', 'ProcCode');
  await syncTable('operatory', 'OperatoryNum');
  
  console.log("\nSync process completed.");
}

main()
  .catch((e) => {
    console.error('Unhandled script error:', e);
  })
  .finally(async () => {
    console.log("Disconnecting Prisma clients...");
    await localPrisma.$disconnect();
    await railwayPrisma.$disconnect();
  });
