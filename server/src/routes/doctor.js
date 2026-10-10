import { Router } from 'express';
import { one, q, tx } from '../utils/db.js';
import { APPOINTMENT_SELECT, DOCTOR_SELECT } from '../utils/queries.js';
import { notify } from '../utils/notify.js';
import { addUnavailability, getSchedule, previewUnavailability, removeUnavailability, saveSchedule, setDelay } from '../utils/schedule.js';
import { callNext, checkIn, doctorQueue } from '../services/queue.js';
import { refundAppointment } from '../services/payments.js';
import { emitQueue } from '../services/realtime.js';
import { addDays, formatDateLabel, formatTimeLabel, isValidDate, todayIST } from '../utils/time.js';
import { bad, forbidden, notFound, toId } from '../utils/http.js';

const r = Router();

async function ownAppointment(req) {
  const appt = await one(`${APPOINTMENT_SELECT} WHERE a.id = $1`, [toId(req.params.id)]);
  if (!appt) throw notFound('Appointment not found');
  if (appt.doctorId !== req.user.doctorId) throw forbidden();
  return appt;
}

r.get('/dashboard', async (req, res) => {
  const did = req.user.doctorId;
  const today = todayIST();
  const todays = await q(`${APPOINTMENT_SELECT} WHERE a.doctor_id = $1 AND a.date = $2 AND a.status <> 'CANCELLED' ORDER BY a.time`, [did, today]);
  const counts = await one(
    `SELECT COUNT(*) FILTER (WHERE date > $2 AND date <= $3 AND status = 'SCHEDULED')::int AS this_week,
            COUNT(DISTINCT patient_id) FILTER (WHERE status = 'COMPLETED')::int AS total_patients
       FROM appointments WHERE doctor_id = $1`,
    [did, today, addDays(today, 7)],
  );
  const next = await q(
    `${APPOINTMENT_SELECT} WHERE a.doctor_id = $1 AND a.date > $2 AND a.status = 'SCHEDULED' ORDER BY a.date, a.time LIMIT 5`,
    [did, today],
  );
  const sched = await one('SELECT delay_minutes, delay_date FROM doctors WHERE id = $1', [did]);
  res.json({
    today,
    delayMinutes: sched.delayDate === today ? sched.delayMinutes : 0,
    queue: await doctorQueue(did),
    stats: {
      today: todays.length,
      completed: todays.filter((a) => a.status === 'COMPLETED').length,
      pending: todays.filter((a) => ['SCHEDULED', 'IN_PROGRESS'].includes(a.status) && a.paymentStatus !== 'PENDING').length,
      thisWeek: counts.thisWeek,
      totalPatients: counts.totalPatients,
    },
    todays,
    next,
  });
});

r.get('/appointments', async (req, res) => {
  const { date, status, search, range } = req.query;
  const params = [req.user.doctorId];
  const where = ['a.doctor_id = $1'];
  if (date) {
    if (!isValidDate(date)) throw bad('Invalid date');
    params.push(date);
    where.push(`a.date = $${params.length}`);
  } else if (range === 'upcoming') {
    params.push(todayIST());
    where.push(`a.date >= $${params.length}`);
  } else if (range === 'past') {
    params.push(todayIST());
    where.push(`a.date < $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`a.status = $${params.length}`);
  }
  if (search?.trim()) {
    params.push(`%${search.trim()}%`);
    where.push(`pu.name ILIKE $${params.length}`);
  }
  const order = range === 'past' ? 'a.date DESC, a.time DESC' : 'a.date ASC, a.time ASC';
  res.json(await q(`${APPOINTMENT_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 300`, params));
});

r.get('/appointments/:id', async (req, res) => {
  const appt = await ownAppointment(req);
  appt.note = await one('SELECT * FROM consultation_notes WHERE appointment_id = $1', [appt.id]);
  appt.patient = await one(
    `SELECT u.name, u.email, u.phone, p.age, p.gender, p.blood_group, p.address
       FROM patients p JOIN users u ON u.id = p.user_id WHERE p.id = $1`,
    [appt.patientId],
  );
  appt.previousVisits = await q(
    `SELECT a.id, a.date, a.time, du.name AS doctor_name, s.name AS specialization, cn.diagnosis, cn.prescription
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id JOIN users du ON du.id = d.user_id
       JOIN specializations s ON s.id = d.specialization_id
       LEFT JOIN consultation_notes cn ON cn.appointment_id = a.id
      WHERE a.patient_id = $1 AND a.id <> $2 AND a.status = 'COMPLETED'
      ORDER BY a.date DESC LIMIT 6`,
    [appt.patientId, appt.id],
  );
  res.json(appt);
});

const STATUS_FLOW = {
  SCHEDULED: ['IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'SCHEDULED'],
  NO_SHOW: ['SCHEDULED'],
  COMPLETED: ['IN_PROGRESS'],
  CANCELLED: [],
};

r.patch('/appointments/:id/status', async (req, res) => {
  const appt = await ownAppointment(req);
  const { status } = req.body;
  if (!STATUS_FLOW[appt.status]?.includes(status)) throw bad(`Cannot change status from ${appt.status} to ${status}`);
  await one('UPDATE appointments SET status = $1, cancelled_by = $2, cancel_reason = $3, needs_rebook = $4 WHERE id = $5', [
    status, status === 'CANCELLED' ? 'DOCTOR' : null, status === 'CANCELLED' ? 'Cancelled by doctor' : null, status === 'CANCELLED', appt.id,
  ]);
  const p = await one('SELECT user_id FROM patients WHERE id = $1', [appt.patientId]);
  const when = `${formatDateLabel(appt.date)} at ${formatTimeLabel(appt.time)}`;
  if (status === 'CANCELLED') {
    const refunded = appt.paymentStatus === 'PAID' ? await refundAppointment(appt.id) : false;
    await notify(
      p.userId,
      `${appt.doctorName} had to cancel your appointment on ${when}.${refunded ? ` Your ₹${appt.fee} payment has been refunded.` : ''} Please pick a new time.`,
      `/patient/appointments?rebook=${appt.id}`,
      { email: 'Please choose a new appointment time', sms: true },
    );
  }
  emitQueue(appt.doctorId, appt.date);
  if (status === 'COMPLETED')
    await notify(p.userId, `Your consultation with ${appt.doctorName} on ${formatDateLabel(appt.date)} is complete.`, `/patient/appointments/${appt.id}`);
  res.json({ message: 'Status updated' });
});

r.put('/appointments/:id/notes', async (req, res) => {
  const appt = await ownAppointment(req);
  if (appt.status === 'CANCELLED') throw bad('Cannot add notes to a cancelled appointment');
  const { symptoms, diagnosis, notes, prescription, followUpDate, markCompleted } = req.body;
  if (followUpDate && (!isValidDate(followUpDate) || followUpDate <= appt.date)) throw bad('Follow-up date must be after the visit');
  if (![symptoms, diagnosis, notes, prescription].some((v) => v?.trim())) throw bad('Please write at least one field');
  await tx(async (c) => {
    await c.query(
      `INSERT INTO consultation_notes (appointment_id, symptoms, diagnosis, notes, prescription, follow_up_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (appointment_id) DO UPDATE SET symptoms = $2, diagnosis = $3, notes = $4, prescription = $5,
         follow_up_date = $6, updated_at = NOW()`,
      [appt.id, symptoms || null, diagnosis || null, notes || null, prescription || null, followUpDate || null],
    );
    if (markCompleted && appt.status !== 'COMPLETED')
      await c.query(`UPDATE appointments SET status = 'COMPLETED' WHERE id = $1`, [appt.id]);
  });
  if (markCompleted && appt.status !== 'COMPLETED') {
    emitQueue(appt.doctorId, appt.date);
    const p = await one('SELECT user_id FROM patients WHERE id = $1', [appt.patientId]);
    await notify(p.userId, `${appt.doctorName} added your prescription for the visit on ${formatDateLabel(appt.date)}.`, `/patient/appointments/${appt.id}`);
  }
  res.json({ message: 'Notes saved' });
});

r.get('/profile', async (req, res) => {
  res.json(await one(`${DOCTOR_SELECT} WHERE d.id = $1`, [req.user.doctorId]));
});

r.put('/profile', async (req, res) => {
  const { phone, bio, qualification, languages, videoEnabled } = req.body;
  if (!qualification?.trim()) throw bad('Qualification is required');
  if (phone && !/^[6-9]\d{9}$/.test(phone)) throw bad('Enter a valid 10-digit mobile number');
  await tx(async (c) => {
    await c.query('UPDATE users SET phone = $1 WHERE id = $2', [phone || null, req.user.id]);
    await c.query('UPDATE doctors SET bio = $1, qualification = $2, languages = $3, video_enabled = $4 WHERE id = $5', [
      bio || null, qualification.trim(), languages || null, videoEnabled !== false, req.user.doctorId,
    ]);
  });
  res.json({ message: 'Profile updated' });
});

r.get('/schedule', async (req, res) => res.json(await getSchedule(req.user.doctorId)));
r.put('/schedule', async (req, res) => res.json(await saveSchedule(req.user.doctorId, req.body)));
r.post('/unavailability/preview', async (req, res) => res.json(await previewUnavailability(req.user.doctorId, req.body)));
r.post('/unavailability', async (req, res) => res.json(await addUnavailability(req.user.doctorId, req.body, 'DOCTOR')));
r.delete('/unavailability/:blockId', async (req, res) => res.json(await removeUnavailability(req.user.doctorId, toId(req.params.blockId))));
r.put('/delay', async (req, res) => res.json(await setDelay(req.user.doctorId, req.body.minutes)));

/* ---------- Queue ---------- */
r.get('/queue', async (req, res) => res.json(await doctorQueue(req.user.doctorId)));
r.post('/queue/next', async (req, res) => {
  const next = await callNext(req.user.doctorId);
  res.json({ called: next?.tokenNo || null, queue: await doctorQueue(req.user.doctorId) });
});
r.post('/appointments/:id/check-in', async (req, res) => {
  await ownAppointment(req);
  const token = await checkIn(toId(req.params.id), { by: 'DOCTOR' });
  res.json({ token });
});

/* ---------- Reviews ---------- */
r.get('/reviews', async (req, res) => {
  res.json(
    await q(
      `SELECT r.id, r.rating, r.comment, r.created_at, pu.name AS patient_name, a.date
         FROM reviews r JOIN appointments a ON a.id = r.appointment_id JOIN patients p ON p.id = r.patient_id JOIN users pu ON pu.id = p.user_id
        WHERE r.doctor_id = $1 AND NOT r.is_hidden ORDER BY r.created_at DESC LIMIT 100`,
      [req.user.doctorId],
    ),
  );
});

export default r;
