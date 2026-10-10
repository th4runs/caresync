import { one, q } from './db.js';
import { dayOfWeek, nowMinutesIST, todayIST, toMinutes, toTime } from './time.js';

const KIND_LABEL = { LEAVE: 'on leave', PERSONAL: 'unavailable', EMERGENCY: 'unavailable due to an emergency' };

/** Blocks of unavailable time for a doctor on a date: [{ start, end, kind }] in minutes. */
export async function blocksFor(doctorId, date) {
  const rows = await q('SELECT start_time, end_time, kind FROM unavailability WHERE doctor_id = $1 AND date = $2', [doctorId, date]);
  return rows.map((r) => ({
    start: r.startTime ? toMinutes(r.startTime) : 0,
    end: r.endTime ? toMinutes(r.endTime) : 24 * 60,
    kind: r.kind,
    fullDay: !r.startTime,
  }));
}

/** All slots for a doctor on a date, each marked available or not. */
export async function getSlots(doctorId, date) {
  const doctor = await one(
    `SELECT d.id, d.slot_duration, u.is_active FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = $1`,
    [doctorId],
  );
  if (!doctor || !doctor.isActive) return { slots: [], reason: 'This doctor is not taking appointments right now' };

  const today = todayIST();
  if (date < today) return { slots: [], reason: 'This date has already passed' };

  const blocks = await blocksFor(doctorId, date);
  const fullDay = blocks.find((b) => b.fullDay);
  if (fullDay) return { slots: [], reason: `The doctor is ${KIND_LABEL[fullDay.kind]} on this day` };

  const ranges = await q(
    'SELECT start_time, end_time FROM availability WHERE doctor_id = $1 AND day_of_week = $2 ORDER BY start_time',
    [doctorId, dayOfWeek(date)],
  );
  if (!ranges.length) return { slots: [], reason: 'The doctor does not consult on this day' };

  const booked = await q(
    `SELECT time FROM appointments WHERE doctor_id = $1 AND date = $2 AND status <> 'CANCELLED'`,
    [doctorId, date],
  );
  const bookedSet = new Set(booked.map((b) => b.time));
  const nowMins = date === today ? nowMinutesIST() : -1;
  const dur = doctor.slotDuration;

  const slots = [];
  for (const r of ranges) {
    const end = toMinutes(r.endTime);
    for (let m = toMinutes(r.startTime); m + dur <= end; m += dur) {
      if (blocks.some((b) => m < b.end && m + dur > b.start)) continue; // doctor blocked this time
      const time = toTime(m);
      slots.push({ time, available: !bookedSet.has(time) && m > nowMins });
    }
  }
  return { slots, reason: slots.length ? null : 'The doctor is unavailable for the rest of this day' };
}
