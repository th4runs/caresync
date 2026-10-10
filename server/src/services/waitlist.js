import { q, pool } from '../utils/db.js';
import { notify } from '../utils/notify.js';
import { getSlots } from '../utils/slots.js';
import { formatDateLabel, todayIST } from '../utils/time.js';

/** Called whenever a slot may have opened up for a doctor on a date. */
export async function onSlotFreed(doctorId, date) {
  if (date < todayIST()) return;
  const { slots } = await getSlots(doctorId, date);
  if (!slots.some((s) => s.available)) return;
  const waiting = await q(
    `SELECT w.id, p.user_id, du.name AS doctor_name
       FROM waitlist w JOIN patients p ON p.id = w.patient_id
       JOIN doctors d ON d.id = w.doctor_id JOIN users du ON du.id = d.user_id
      WHERE w.doctor_id = $1 AND w.date = $2 AND w.status = 'WAITING' ORDER BY w.created_at`,
    [doctorId, date],
  );
  for (const w of waiting) {
    await pool.query(`UPDATE waitlist SET status = 'NOTIFIED', notified_at = NOW() WHERE id = $1`, [w.id]);
    await notify(
      w.userId,
      `Good news! A slot just opened with ${w.doctorName} on ${formatDateLabel(date)}. Book quickly before it's taken.`,
      `/patient/doctors/${doctorId}/book?date=${date}`,
      { email: 'A slot opened up for you', sms: true },
    );
  }
}

export async function markWaitlistBooked(patientId, doctorId, date) {
  await pool.query(`UPDATE waitlist SET status = 'BOOKED' WHERE patient_id = $1 AND doctor_id = $2 AND date = $3`, [patientId, doctorId, date]);
}
