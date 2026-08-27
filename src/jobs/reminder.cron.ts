import cron from 'node-cron';
import { appointmentService } from '../services/appointment.service';

/**
 * Runs daily at 8:00 AM and sends SMS reminders for appointments exactly 2 days away.
 */
export const startDailySmsReminderScheduler = () => {
  cron.schedule('0 8 * * *', async () => {
    try {
      const result = await appointmentService.sendDailySmsReminders();
      if (result.sent > 0 || result.checked > 0) {
        console.log(`Daily SMS Reminder scheduler: sent ${result.sent}/${result.checked} reminder(s) (${result.skipped} skipped)`);
      }
    } catch (error) {
      console.error('Daily SMS Reminder scheduler run failed:', error);
    }
  });
  console.log('⏰ Daily SMS Reminder scheduler started (runs daily at 8:00 AM)');
};
