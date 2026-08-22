import cron from 'node-cron';
import { appointmentService } from '../services/appointment.service';

/**
 * Runs every 15 minutes and sends reminder emails for appointments within
 * the next 24 hours. sendDueReminders() is idempotent (tracks reminderSent
 * per appointment), so overlapping/missed runs are safe.
 */
export const startReminderScheduler = () => {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await appointmentService.sendDueReminders();
      if (result.sent > 0) {
        console.log(`Reminder scheduler: sent ${result.sent}/${result.checked} reminder(s) (${result.skipped} skipped)`);
      }
    } catch (error) {
      console.error('Reminder scheduler run failed:', error);
    }
  });
  console.log('⏰ Reminder scheduler started (runs every 15 minutes)');
};
