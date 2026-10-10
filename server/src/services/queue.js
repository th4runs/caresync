// Clinic queue tokens. A patient gets a token when they check in at the clinic.
import { one, q, tx } from '../utils/db.js';
import { emitQueue } from './realtime.js';
import { notify } from '../utils/notify.js';
import { bad } from '../utils/http.js';
import { nowMinutesIST, todayIST, toMinutes } from '../utils/time.js';

export async function checkIn(appointmentId, { by }) {
  const a = await one(`SELECT id, doctor_id, date, time, mode, status, token_no, payment_status FROM appointments WHERE id = $1`, [appointmentId]);
  if (!a) throw bad('Appointment not found');
  if (a.mode !== 'CLINIC') throw bad('Video consultations do not need a token');
  if (a.date !== todayIST()) throw bad('Check-in is only possible on the day of the appointment');
  if (a.status !== 'SCHEDULED') throw bad('This appointment cannot be checked in');
  if (a.paymentStatus === 'PENDING') throw bad('Please complete the payment first');
  if (a.tokenNo) return a.tokenNo;
  if (by === 'PATIENT') {
    const diff = toMinutes(a.time) - nowMinutesIST();
    if (diff > 60) throw bad('You can check in from 1 hour before your slot');
    if (diff < -45) throw bad('Your slot time has passed. Please speak to the reception.');
  }
  const token = await tx(async (c) => {
    await c.query('SELECT id FROM doctors WHERE id = $1 FOR UPDATE', [a.doctorId]); // serialise token numbers per doctor
    const r = await one(`SELECT COALESCE(MAX(token_no), 0) + 1 AS next FROM appointments WHERE doctor_id = $1 AND date = $2`, [a.doctorId, a.date], c);
    await c.query('UPDATE appointments SET token_no = $1, checked_in_at = NOW() WHERE id = $2', [r.next, a.id]);
    return r.next;
  });
  emitQueue(a.doctorId, a.date);
  return token;
}

/** Current queue for one doctor today. */
export async function doctorQueue(doctorId) {
  const today = todayIST();
  const doc = await one(
    `SELECT d.id, u.name, d.slot_duration, CASE WHEN d.delay_date = $2 THEN d.delay_minutes ELSE 0 END AS delay_minutes
       FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = $1`,
    [doctorId, today],
  );
  const rows = await q(
    `SELECT a.id, a.token_no, a.time, a.status, pu.name AS patient_name
       FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN users pu ON pu.id = p.user_id
      WHERE a.doctor_id = $1 AND a.date = $2 AND a.token_no IS NOT NULL ORDER BY a.token_no`,
    [doctorId, today],
  );
  const serving = rows.find((r) => r.status === 'IN_PROGRESS');
  const waiting = rows.filter((r) => r.status === 'SCHEDULED');
  return {
    doctorId,
    doctorName: doc?.name,
    slotDuration: doc?.slotDuration || 30,
    delayMinutes: doc?.delayMinutes || 0,
    nowServing: serving?.tokenNo || null,
    servingPatient: serving?.patientName || null,
    lastCompleted: Math.max(0, ...rows.filter((r) => r.status === 'COMPLETED').map((r) => r.tokenNo)),
    waiting: waiting.map((w) => ({ id: w.id, token: w.tokenNo, time: w.time, patientName: w.patientName })),
  };
}

/** Where a patient stands in the queue. */
export async function patientQueue(appt) {
  const qd = await doctorQueue(appt.doctorId);
  const ahead = qd.waiting.filter((w) => w.token < appt.tokenNo).length + (qd.nowServing ? 1 : 0);
  return {
    myToken: appt.tokenNo,
    nowServing: qd.nowServing,
    ahead,
    estimatedWait: ahead * qd.slotDuration + qd.delayMinutes,
    delayMinutes: qd.delayMinutes,
    isMyTurn: qd.nowServing === appt.tokenNo,
  };
}

/** Doctor finishes the current patient (if any) and calls the next checked-in one. */
export async function callNext(doctorId) {
  const today = todayIST();
  await q(`UPDATE appointments SET status = 'COMPLETED' WHERE doctor_id = $1 AND date = $2 AND status = 'IN_PROGRESS' AND mode = 'CLINIC'`, [doctorId, today]);
  const next = await one(
    `SELECT a.id, a.token_no, p.user_id FROM appointments a JOIN patients p ON p.id = a.patient_id
      WHERE a.doctor_id = $1 AND a.date = $2 AND a.status = 'SCHEDULED' AND a.token_no IS NOT NULL ORDER BY a.token_no LIMIT 1`,
    [doctorId, today],
  );
  if (next) {
    await q(`UPDATE appointments SET status = 'IN_PROGRESS' WHERE id = $1`, [next.id]);
    await notify(next.userId, `It's your turn! Token ${next.tokenNo}, please go to the consultation room.`, `/patient/appointments/${next.id}`, { sms: true });
    const after = await one(
      `SELECT a.token_no, p.user_id FROM appointments a JOIN patients p ON p.id = a.patient_id
        WHERE a.doctor_id = $1 AND a.date = $2 AND a.status = 'SCHEDULED' AND a.token_no IS NOT NULL ORDER BY a.token_no LIMIT 1`,
      [doctorId, today],
    );
    if (after) await notify(after.userId, `You're next in line (token ${after.tokenNo}). Please be ready.`, null);
  }
  emitQueue(doctorId, today);
  return next;
}

/** Public waiting-room screen: tokens only, no patient names. */
export async function displayBoard() {
  const today = todayIST();
  const docs = await q(
    `SELECT DISTINCT d.id FROM doctors d JOIN users u ON u.id = d.user_id JOIN appointments a ON a.doctor_id = d.id
      WHERE u.is_active AND a.date = $1 AND a.token_no IS NOT NULL`,
    [today],
  );
  const boards = [];
  for (const d of docs) {
    const qd = await doctorQueue(d.id);
    const meta = await one(`SELECT s.name AS specialization FROM doctors d JOIN specializations s ON s.id = d.specialization_id WHERE d.id = $1`, [d.id]);
    boards.push({
      doctorId: d.id,
      doctorName: qd.doctorName,
      specialization: meta.specialization,
      nowServing: qd.nowServing,
      next: qd.waiting.slice(0, 4).map((w) => w.token),
      waitingCount: qd.waiting.length,
      delayMinutes: qd.delayMinutes,
    });
  }
  return boards.filter((b) => b.nowServing || b.waitingCount).sort((a, b) => a.doctorName.localeCompare(b.doctorName));
}
