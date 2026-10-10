// Shared by doctor and admin routes: weekly hours, time off / emergencies, and "running late".
import { one, q, tx } from './db.js';
import { notify } from './notify.js';
import { bad } from './http.js';
import { getSlots } from './slots.js';
import { refundAppointment } from '../services/payments.js';
import { emitQueue } from '../services/realtime.js';
import { formatDateLabel, formatTimeLabel, isValidDate, isValidTime, nowMinutesIST, todayIST, toMinutes, toTime } from './time.js';

const KINDS = ['LEAVE', 'PERSONAL', 'EMERGENCY'];
const KIND_TEXT = {
  LEAVE: 'is on leave',
  PERSONAL: 'is unavailable due to unavoidable personal work',
  EMERGENCY: 'had to attend to a medical emergency',
};

export async function getSchedule(doctorId) {
  const today = todayIST();
  const doc = await one('SELECT slot_duration, delay_minutes, delay_date FROM doctors WHERE id = $1', [doctorId]);
  return {
    slotDuration: doc?.slotDuration ?? 30,
    delayMinutes: doc?.delayDate === today ? doc.delayMinutes : 0,
    availability: await q(
      'SELECT id, day_of_week, start_time, end_time FROM availability WHERE doctor_id = $1 ORDER BY day_of_week, start_time',
      [doctorId],
    ),
    timeOff: await q(
      'SELECT id, date, start_time, end_time, kind, reason FROM unavailability WHERE doctor_id = $1 AND date >= $2 ORDER BY date, start_time NULLS FIRST',
      [doctorId, today],
    ),
  };
}

export async function saveSchedule(doctorId, { slotDuration, availability }) {
  const dur = Number(slotDuration);
  if (![10, 15, 20, 30, 45, 60].includes(dur)) throw bad('Choose a valid slot length');
  if (!Array.isArray(availability)) throw bad('Invalid schedule');

  const byDay = {};
  for (const a of availability) {
    const day = Number(a.dayOfWeek);
    if (!(day >= 0 && day <= 6)) throw bad('Invalid day');
    if (!isValidTime(a.startTime) || !isValidTime(a.endTime)) throw bad('Please enter valid times');
    if (toMinutes(a.endTime) - toMinutes(a.startTime) < dur) throw bad('Each session must be longer than one slot');
    (byDay[day] ||= []).push([toMinutes(a.startTime), toMinutes(a.endTime)]);
  }
  for (const ranges of Object.values(byDay)) {
    ranges.sort((x, y) => x[0] - y[0]);
    for (let i = 1; i < ranges.length; i++) if (ranges[i][0] < ranges[i - 1][1]) throw bad('Sessions on the same day overlap');
  }

  await tx(async (c) => {
    await c.query('UPDATE doctors SET slot_duration = $1 WHERE id = $2', [dur, doctorId]);
    await c.query('DELETE FROM availability WHERE doctor_id = $1', [doctorId]);
    for (const a of availability) {
      await c.query('INSERT INTO availability (doctor_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4)', [
        doctorId, Number(a.dayOfWeek), a.startTime, a.endTime,
      ]);
    }
  });
  return getSchedule(doctorId);
}

/* ---------------- Unavailability (leave, personal work, emergency) ---------------- */

function parseBlock(body) {
  const { date, wholeDay } = body;
  const kind = KINDS.includes(body.kind) ? body.kind : 'LEAVE';
  if (!isValidDate(date) || date < todayIST()) throw bad('Pick today or a future date');
  if (wholeDay) return { date, kind, startTime: null, endTime: null, reason: body.reason?.trim() || null };
  let { startTime, endTime } = body;
  if (!isValidTime(startTime) || !isValidTime(endTime)) throw bad('Enter a valid start and end time');
  if (toMinutes(endTime) <= toMinutes(startTime)) throw bad('End time must be after start time');
  if (date === todayIST() && toMinutes(endTime) <= nowMinutesIST()) throw bad('This time has already passed');
  return { date, kind, startTime, endTime, reason: body.reason?.trim() || null };
}

/** Appointments that fall inside the block. */
async function affectedBy(doctorId, block) {
  const rows = await q(
    `SELECT a.id, a.date, a.time, a.mode, a.fee, a.payment_status, a.patient_id, p.user_id AS patient_user_id, pu.name AS patient_name, pu.phone AS patient_phone
       FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN users pu ON pu.id = p.user_id
      WHERE a.doctor_id = $1 AND a.date = $2 AND a.status = 'SCHEDULED' ORDER BY a.time`,
    [doctorId, block.date],
  );
  if (!block.startTime) return rows;
  const s = toMinutes(block.startTime);
  const e = toMinutes(block.endTime);
  return rows.filter((r) => toMinutes(r.time) >= s && toMinutes(r.time) < e);
}

/** Active doctors in the same speciality who are free at each affected time. */
async function colleaguesFor(doctorId, affected, date) {
  const colleagues = await q(
    `SELECT d.id, u.name, d.fee, d.video_enabled FROM doctors d JOIN users u ON u.id = d.user_id
      WHERE u.is_active AND d.id <> $1 AND d.specialization_id = (SELECT specialization_id FROM doctors WHERE id = $1)
      ORDER BY u.name`,
    [doctorId],
  );
  for (const c of colleagues) {
    const { slots } = await getSlots(c.id, date);
    const free = new Set(slots.filter((s) => s.available).map((s) => s.time));
    c.canTake = affected.filter((a) => free.has(a.time) && (a.mode !== 'VIDEO' || c.videoEnabled)).map((a) => a.id);
  }
  return colleagues;
}

export async function previewUnavailability(doctorId, body) {
  const block = parseBlock(body);
  const affected = await affectedBy(doctorId, block);
  const colleagues = affected.length ? await colleaguesFor(doctorId, affected, block.date) : [];
  return { block, affected, colleagues };
}

/**
 * Saves the block and handles booked patients.
 * action: 'TRANSFER' (move to transferDoctorId where free, rest need rebooking) or 'REBOOK' (ask all to rebook).
 */
export async function addUnavailability(doctorId, body, by) {
  const block = parseBlock(body);
  const affected = await affectedBy(doctorId, block);
  const doctor = await one('SELECT u.name FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = $1', [doctorId]);

  let colleague = null;
  let transferable = new Set();
  if (affected.length && body.action === 'TRANSFER') {
    const colleagues = await colleaguesFor(doctorId, affected, block.date);
    colleague = colleagues.find((c) => c.id === Number(body.transferDoctorId));
    if (!colleague) throw bad('Choose a colleague to transfer the appointments to');
    transferable = new Set(colleague.canTake);
  }

  await one(
    'INSERT INTO unavailability (doctor_id, date, start_time, end_time, kind, reason) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [doctorId, block.date, block.startTime, block.endTime, block.kind, block.reason],
  );

  const why = `${doctor.name} ${KIND_TEXT[block.kind]}`;
  let transferred = 0;
  let rebook = 0;
  for (const a of affected) {
    const when = `${formatDateLabel(a.date)} at ${formatTimeLabel(a.time)}`;
    if (transferable.has(a.id)) {
      try {
        await one('UPDATE appointments SET doctor_id = $1, transferred_from_doctor_id = $2 WHERE id = $3', [colleague.id, doctorId, a.id]);
        transferred++;
        await notify(
          a.patientUserId,
          `${why}, so your appointment on ${when} has been moved to ${colleague.name} at the same time. If you prefer, you can reschedule or cancel for free.`,
          `/patient/appointments/${a.id}`,
          { email: 'Your appointment has a new doctor', sms: true },
        );
        const cu = await one('SELECT user_id FROM doctors WHERE id = $1', [colleague.id]);
        await notify(cu.userId, `${a.patientName}'s appointment on ${when} was transferred to you from ${doctor.name}.`, '/doctor/appointments');
        continue;
      } catch {
        /* slot got taken in the meantime → fall through to rebook */
      }
    }
    await one(
      `UPDATE appointments SET status = 'CANCELLED', cancelled_by = $1, cancel_reason = $2, needs_rebook = TRUE WHERE id = $3`,
      [by, block.kind === 'EMERGENCY' ? 'Doctor emergency' : block.kind === 'PERSONAL' ? 'Doctor unavailable' : 'Doctor on leave', a.id],
    );
    const refunded = a.paymentStatus === 'PAID' ? await refundAppointment(a.id) : false;
    rebook++;
    await notify(
      a.patientUserId,
      `We're sorry. ${why}, so your appointment on ${when} can't go ahead.${refunded ? ` Your payment of ₹${a.fee} has been refunded.` : ''} Please pick a new time. It only takes a minute.`,
      `/patient/appointments?rebook=${a.id}`,
      { email: 'Please choose a new appointment time', sms: true },
    );
  }
  emitQueue(doctorId, block.date);
  return { schedule: await getSchedule(doctorId), transferred, rebook };
}

export async function removeUnavailability(doctorId, id) {
  await q('DELETE FROM unavailability WHERE id = $1 AND doctor_id = $2', [id, doctorId]);
  return getSchedule(doctorId);
}

/** "Running late" notice for today. minutes = 0 clears it. */
export async function setDelay(doctorId, minutes) {
  const m = Number(minutes);
  if (![0, 15, 30, 45, 60, 90].includes(m)) throw bad('Choose a valid delay');
  const today = todayIST();
  await one('UPDATE doctors SET delay_minutes = $1, delay_date = $2 WHERE id = $3', [m, today, doctorId]);
  const doctor = await one('SELECT u.name FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = $1', [doctorId]);
  const nowM = nowMinutesIST();
  const upcoming = await q(
    `SELECT a.id, a.time, p.user_id FROM appointments a JOIN patients p ON p.id = a.patient_id
      WHERE a.doctor_id = $1 AND a.date = $2 AND a.status = 'SCHEDULED'`,
    [doctorId, today],
  );
  for (const a of upcoming.filter((x) => toMinutes(x.time) >= nowM - 30)) {
    const msg = m
      ? `${doctor.name} is running about ${m} minutes late today. Your ${formatTimeLabel(a.time)} appointment will likely start around ${formatTimeLabel(toTime(Math.min(toMinutes(a.time) + m, 23 * 60 + 59)))}.`
      : `${doctor.name} is back on schedule. Your appointment is at ${formatTimeLabel(a.time)} as planned.`;
    await notify(a.userId, msg, `/patient/appointments/${a.id}`, { sms: true });
  }
  emitQueue(doctorId, today);
  return { delayMinutes: m, notified: upcoming.length };
}
