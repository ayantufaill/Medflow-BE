import cron from 'node-cron';
import { recareService } from '../services/recare.service';

/**
 * Runs once daily and sends recare reminder emails to patients whose last
 * completed visit plus the configured interval (clinicalrecareconfig) has
 * passed. runDueRecareSweep() is idempotent (skips patients reminded within
 * the last 30 days, tracked on their recall row), so overlapping/missed runs
 * are safe. No-ops entirely when the practice's autoReminder toggle is off.
 */
export const startRecareScheduler = () => {
  cron.schedule('0 6 * * *', async () => {
    try {
      const result = await recareService.runDueRecareSweep();
      if (result.remindersSent > 0) {
        console.log(
          `Recare scheduler: sent ${result.remindersSent}/${result.duePatients} recare reminder(s) ` +
            `(${result.skipped} skipped, ${result.patientsChecked} patients checked)`
        );
      }
    } catch (error) {
      console.error('Recare scheduler run failed:', error);
    }
  });
  console.log('🦷 Recare scheduler started (runs daily at 6am)');
};
