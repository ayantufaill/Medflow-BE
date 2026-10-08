#!/usr/bin/env node
/**
 * Late Fee Scheduler Job
 * 
 * This script runs the daily late fee evaluation and application job.
 * It should be scheduled via cron (e.g., 0 2 * * * for 2 AM daily).
 * 
 * Usage: node dist/scripts/run-late-fee-job.js
 */

import connectDB from '../config/db';
import { lateFeeScheduler } from '../services/late-fee-scheduler.service';

async function main() {
  console.log('🕐 Starting late fee scheduler job...');
  const startTime = Date.now();

  try {
    await connectDB();
    
    const runDate = new Date();
    console.log(`📅 Running for date: ${runDate.toISOString().split('T')[0]}`);

    const result = await lateFeeScheduler.runDailyJob(runDate);

    console.log('\n✅ Late fee job completed successfully');
    console.log('┌────────────────────────────────────────────────────────────┐');
    console.log(`│ Clinics processed: ${String(result.clinicsProcessed).padStart(3)}                                    │`);
    console.log(`│ Total fees applied: ${String(result.totalFeesApplied).padStart(3)}                                    │`);
    console.log(`│ Total fees skipped: ${String(result.totalFeesSkipped).padStart(3)}                                    │`);
    console.log(`│ Duration: ${String(Date.now() - startTime).padStart(4)}ms                                           │`);
    console.log('└────────────────────────────────────────────────────────────┘');

    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      result.errors.forEach(err => console.log(`   - ${err}`));
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Late fee job failed:', error);
    process.exit(1);
  }
}

main();