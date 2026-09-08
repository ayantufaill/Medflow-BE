import cron from 'node-cron';
import { appointmentService } from '../services/appointment.service';

/**
 * Runs every 15 minutes and checks for scheduled appointments that have passed
 * their end time by more than 60 minutes, automatically transitioning them to 'no_show'.
 */
export const startNoShowScheduler = () => {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await appointmentService.autoUpdateNoShowAppointments();
      if (result.updated > 0) {
        console.log(`⏰ No-show scheduler: transitioned ${result.updated} appointment(s) to No Show (${result.checked} checked)`);
      }
    } catch (error) {
      console.error('No-show scheduler run failed:', error);
    }
  });
  console.log('⏰ No-show scheduler started (runs every 15 minutes)');
};
