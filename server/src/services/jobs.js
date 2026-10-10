// Background jobs: appointment reminders and releasing slots held by unpaid bookings.
import { q, pool } from '../utils/db.js';
import { notify } from '../utils/notify.js';
import { onSlotFreed } from './waitlist.js';
import { addDays, formatDateLabel, formatTimeLabel, nowMinutesIST, todayIST, toMinutes } from '../utils/time.js';

async function sendReminders() {
  const today = todayIST();
  const tomorrow = addDays(today, 1);
  const rows = await q(
    `SELECT a.id, a.date, a.time, a.mode, p.user_id, du.name AS doctor_name
       FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN doctors d ON d.id = a.doctor_id JOIN users du ON du.id = d.user_id
      WHERE a.status = 'SCHEDULED' AND NOT a.reminder_sent AND a.payment_status <> 'PENDING' AND a.date IN ($1, $2)`,
    [today, tomorrow],
  );
  const now = nowMinutesIST();
  for (const a of rows) {
    const minsAway = (a.date === today ? 0 : 1440) + toMinutes(a.time) - now;
    if (minsAway <= 0 || minsAway > 1440) continue; // remind once, within 24 hours before the visit
    await pool.query('UPDATE appointments SET reminder_sent = TRUE WHERE id = $1', [a.id]);
    const where = a.mode === 'VIDEO' ? 'Join the video call from the app 5 minutes early.' : 'Please arrive 10 minutes early and check in at the clinic.';
    await notify(
      a.userId,
      `Reminder: your ${a.mode === 'VIDEO' ? 'video consultation' : 'appointment'} with ${a.doctorName} is on ${formatDateLabel(a.date)} at ${formatTimeLabel(a.time)}. ${where}`,
      `/patient/appointments/${a.id}`,
      { email: 'Appointment reminder', sms: true },
    );
  }
}

async function releaseUnpaid() {
  const rows = await q(
    `UPDATE appointments SET status = 'CANCELLED', cancel_reason = 'Payment not completed in time'
      WHERE payment_status = 'PENDING' AND status = 'SCHEDULED' AND created_at < NOW() - INTERVAL '15 minutes'
      RETURNING id, doctor_id, date`,
  );
  for (const r of rows) await onSlotFreed(r.doctorId, r.date);
}

export function startJobs() {
  const run = async () => {
    try {
      await releaseUnpaid();
      await sendReminders();
    } catch (e) {
      console.error('Background job failed:', e.message);
    }
  };
  setTimeout(run, 3000);
  setInterval(run, 60 * 1000);
}
