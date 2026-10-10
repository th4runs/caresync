import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { one, q, tx } from '../utils/db.js';
import { APPOINTMENT_SELECT, DOCTOR_SELECT } from '../utils/queries.js';
import { notify } from '../utils/notify.js';
import { addUnavailability, getSchedule, previewUnavailability, removeUnavailability, saveSchedule, setDelay } from '../utils/schedule.js';
import { checkIn } from '../services/queue.js';
import { onSlotFreed } from '../services/waitlist.js';
import { emitQueue } from '../services/realtime.js';
import { providers } from '../services/messaging.js';
import { razorpayEnabled, refundAppointment } from '../services/payments.js';
import { addDays, formatDateLabel, formatTimeLabel, isValidDate, todayIST } from '../utils/time.js';
import { bad, notFound, toId } from '../utils/http.js';

const r = Router();

/* ---------- Statistics ---------- */
r.get('/stats', async (req, res) => {
  const today = todayIST();
  const from7 = addDays(today, -6);
  const from30 = addDays(today, -29);
  const totals = await one(
    `SELECT
       (SELECT COUNT(*) FROM patients)::int AS patients,
       (SELECT COUNT(*) FROM doctors d JOIN users u ON u.id = d.user_id WHERE u.is_active)::int AS doctors,
       (SELECT COUNT(*) FROM specializations)::int AS specializations,
       (SELECT COUNT(*) FROM appointments WHERE date = $1 AND status <> 'CANCELLED')::int AS today,
       (SELECT COUNT(*) FROM appointments WHERE date = $1 AND status = 'COMPLETED')::int AS today_completed,
       (SELECT COUNT(*) FROM appointments WHERE date >= $2 AND date <= $1)::int AS last30,
       (SELECT COUNT(*) FROM appointments WHERE date >= $2 AND date <= $1 AND status = 'CANCELLED')::int AS last30_cancelled,
       (SELECT COUNT(*) FROM appointments WHERE date > $1 AND status = 'SCHEDULED')::int AS upcoming,
       (SELECT COALESCE(SUM(a.fee), 0) FROM appointments a
         WHERE a.status = 'COMPLETED' AND a.date >= $2 AND a.date <= $1)::int AS revenue30,
       (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'PAID' AND created_at >= NOW() - INTERVAL '30 days')::int AS online30,
       (SELECT COUNT(*) FROM appointments WHERE needs_rebook AND date >= $2)::int AS needs_rebook,
       (SELECT COUNT(*) FROM appointments WHERE mode = 'VIDEO' AND date >= $2 AND date <= $1 AND status <> 'CANCELLED')::int AS video30,
       (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE NOT is_hidden)::float AS avg_rating,
       (SELECT COUNT(*) FROM waitlist WHERE status = 'WAITING' AND date >= $1)::int AS waitlisted,
       (SELECT COUNT(*) FROM patients p JOIN users u ON u.id = p.user_id WHERE u.created_at >= NOW() - INTERVAL '30 days')::int AS new_patients30`,
    [today, from30],
  );
  const daily = await q(
    `SELECT date, COUNT(*) FILTER (WHERE status <> 'CANCELLED')::int AS count
       FROM appointments WHERE date >= $1 AND date <= $2 GROUP BY date`,
    [from7, today],
  );
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(from7, i);
    days.push({ date: d, count: daily.find((x) => x.date === d)?.count || 0 });
  }
  const bySpecialization = await q(
    `SELECT s.name, COUNT(a.id)::int AS count
       FROM specializations s
       LEFT JOIN doctors d ON d.specialization_id = s.id
       LEFT JOIN appointments a ON a.doctor_id = d.id AND a.date >= $1 AND a.date <= $2 AND a.status <> 'CANCELLED'
      GROUP BY s.id ORDER BY count DESC, s.name`,
    [from30, today],
  );
  const byStatus = await q(
    `SELECT status, COUNT(*)::int AS count FROM appointments WHERE date >= $1 AND date <= $2 GROUP BY status`,
    [from30, today],
  );
  const topDoctors = await q(
    `SELECT du.name, s.name AS specialization, COUNT(a.id)::int AS count,
            (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews r WHERE r.doctor_id = d.id AND NOT r.is_hidden)::float AS rating
       FROM doctors d JOIN users du ON du.id = d.user_id JOIN specializations s ON s.id = d.specialization_id
       LEFT JOIN appointments a ON a.doctor_id = d.id AND a.status = 'COMPLETED' AND a.date >= $1
      GROUP BY d.id, du.name, s.name ORDER BY count DESC LIMIT 5`,
    [from30],
  );
  const todays = await q(`${APPOINTMENT_SELECT} WHERE a.date = $1 ORDER BY a.time LIMIT 8`, [today]);
  const disruptions = await q(
    `SELECT u.date, u.start_time, u.end_time, u.kind, u.reason, du.name AS doctor_name
       FROM unavailability u JOIN doctors d ON d.id = u.doctor_id JOIN users du ON du.id = d.user_id
      WHERE u.date >= $1 AND u.kind <> 'LEAVE' ORDER BY u.date, u.start_time LIMIT 5`,
    [today],
  );
  const delays = await q(
    `SELECT du.name AS doctor_name, d.delay_minutes FROM doctors d JOIN users du ON du.id = d.user_id WHERE d.delay_date = $1 AND d.delay_minutes > 0`,
    [today],
  );
  res.json({ today, totals, days, bySpecialization, byStatus, topDoctors, todays, disruptions, delays, providers: { ...providers(), payments: razorpayEnabled() ? 'RAZORPAY' : 'DEMO' } });
});

/* ---------- Doctors ---------- */
r.get('/doctors', async (req, res) => {
  const { search = '', specializationId, status } = req.query;
  const params = [`%${search.trim()}%`];
  const where = ['(u.name ILIKE $1 OR u.email ILIKE $1)'];
  if (specializationId) {
    params.push(toId(specializationId));
    where.push(`d.specialization_id = $${params.length}`);
  }
  if (status === 'active') where.push('u.is_active');
  if (status === 'inactive') where.push('NOT u.is_active');
  res.json(
    await q(
      `SELECT x.*, (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = x.id AND a.date >= $${params.length + 1} AND a.status = 'SCHEDULED')::int AS upcoming_count
         FROM (${DOCTOR_SELECT} WHERE ${where.join(' AND ')}) x ORDER BY x.name`,
      [...params, todayIST()],
    ),
  );
});

r.get('/doctors/:id', async (req, res) => {
  const doc = await one(`${DOCTOR_SELECT} WHERE d.id = $1`, [toId(req.params.id)]);
  if (!doc) throw notFound('Doctor not found');
  res.json({ ...doc, schedule: await getSchedule(doc.id) });
});

function validateDoctor(b, isNew) {
  if (!b.name?.trim()) throw bad('Name is required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || '')) throw bad('Enter a valid email');
  if (!b.specializationId) throw bad('Choose a specialization');
  if (!b.qualification?.trim()) throw bad('Qualification is required');
  if (!(Number(b.experience) >= 0 && Number(b.experience) <= 60)) throw bad('Enter valid years of experience');
  if (!(Number(b.fee) >= 0 && Number(b.fee) <= 100000)) throw bad('Enter a valid consultation fee');
  if (b.phone && !/^[6-9]\d{9}$/.test(b.phone)) throw bad('Enter a valid 10-digit mobile number');
  if (isNew && (!b.password || b.password.length < 6)) throw bad('Set a password of at least 6 characters');
  if (!isNew && b.password && b.password.length < 6) throw bad('New password must be at least 6 characters');
}

r.post('/doctors', async (req, res) => {
  const b = req.body;
  validateDoctor(b, true);
  const email = b.email.toLowerCase();
  if (await one('SELECT id FROM users WHERE email = $1', [email])) throw bad('This email is already in use');
  const hash = await bcrypt.hash(b.password, 10);
  const doc = await tx(async (c) => {
    const u = await one(
      `INSERT INTO users (name, email, password, phone, role) VALUES ($1, $2, $3, $4, 'DOCTOR') RETURNING id`,
      [b.name.trim(), email, hash, b.phone || null], c,
    );
    const d = await one(
      `INSERT INTO doctors (user_id, specialization_id, qualification, experience, fee, bio, languages, photo_url, slot_duration, video_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 30, $9) RETURNING id`,
      [u.id, toId(b.specializationId), b.qualification.trim(), Number(b.experience), Number(b.fee), b.bio || null,
        b.languages || null, b.photoUrl || null, b.videoEnabled !== false], c,
    );
    // Default hours: Mon–Sat, 10:00–13:00 and 17:00–20:00
    for (let day = 1; day <= 6; day++) {
      await c.query(`INSERT INTO availability (doctor_id, day_of_week, start_time, end_time) VALUES ($1, $2, '10:00', '13:00'), ($1, $2, '17:00', '20:00')`, [d.id, day]);
    }
    return d;
  });
  res.status(201).json(await one(`${DOCTOR_SELECT} WHERE d.id = $1`, [doc.id]));
});

r.put('/doctors/:id', async (req, res) => {
  const id = toId(req.params.id);
  const b = req.body;
  validateDoctor(b, false);
  const doc = await one('SELECT user_id FROM doctors WHERE id = $1', [id]);
  if (!doc) throw notFound('Doctor not found');
  const email = b.email.toLowerCase();
  if (await one('SELECT id FROM users WHERE email = $1 AND id <> $2', [email, doc.userId])) throw bad('This email is already in use');
  await tx(async (c) => {
    await c.query('UPDATE users SET name = $1, email = $2, phone = $3 WHERE id = $4', [b.name.trim(), email, b.phone || null, doc.userId]);
    if (b.password) await c.query('UPDATE users SET password = $1 WHERE id = $2', [await bcrypt.hash(b.password, 10), doc.userId]);
    await c.query(
      `UPDATE doctors SET specialization_id = $1, qualification = $2, experience = $3, fee = $4, bio = $5, languages = $6, photo_url = $7, video_enabled = $8 WHERE id = $9`,
      [toId(b.specializationId), b.qualification.trim(), Number(b.experience), Number(b.fee), b.bio || null, b.languages || null, b.photoUrl || null, b.videoEnabled !== false, id],
    );
  });
  res.json(await one(`${DOCTOR_SELECT} WHERE d.id = $1`, [id]));
});

r.patch('/doctors/:id/status', async (req, res) => {
  const doc = await one('SELECT user_id FROM doctors WHERE id = $1', [toId(req.params.id)]);
  if (!doc) throw notFound('Doctor not found');
  await one('UPDATE users SET is_active = $1 WHERE id = $2', [!!req.body.isActive, doc.userId]);
  res.json({ message: req.body.isActive ? 'Doctor activated' : 'Doctor deactivated' });
});

r.delete('/doctors/:id', async (req, res) => {
  const id = toId(req.params.id);
  const doc = await one('SELECT user_id FROM doctors WHERE id = $1', [id]);
  if (!doc) throw notFound('Doctor not found');
  const used = await one('SELECT COUNT(*)::int AS n FROM appointments WHERE doctor_id = $1', [id]);
  if (used.n) throw bad(`This doctor has ${used.n} appointment records. Deactivate the doctor instead so patient history is kept.`);
  await one('DELETE FROM users WHERE id = $1', [doc.userId]);
  res.json({ message: 'Doctor deleted' });
});

r.get('/doctors/:id/schedule', async (req, res) => res.json(await getSchedule(toId(req.params.id))));
r.put('/doctors/:id/schedule', async (req, res) => res.json(await saveSchedule(toId(req.params.id), req.body)));
r.post('/doctors/:id/unavailability/preview', async (req, res) => res.json(await previewUnavailability(toId(req.params.id), req.body)));
r.post('/doctors/:id/unavailability', async (req, res) => res.json(await addUnavailability(toId(req.params.id), req.body, 'ADMIN')));
r.delete('/doctors/:id/unavailability/:blockId', async (req, res) =>
  res.json(await removeUnavailability(toId(req.params.id), toId(req.params.blockId))),
);
r.put('/doctors/:id/delay', async (req, res) => res.json(await setDelay(toId(req.params.id), req.body.minutes)));

/* ---------- Patients ---------- */
r.get('/patients', async (req, res) => {
  const { search = '', status } = req.query;
  const where = ['(u.name ILIKE $1 OR u.email ILIKE $1 OR u.phone ILIKE $1)'];
  if (status === 'active') where.push('u.is_active');
  if (status === 'inactive') where.push('NOT u.is_active');
  res.json(
    await q(
      `SELECT p.id, u.id AS user_id, u.name, u.email, u.phone, u.is_active, u.created_at, p.age, p.gender, p.blood_group,
              COUNT(a.id)::int AS appointment_count, MAX(a.date) FILTER (WHERE a.status = 'COMPLETED') AS last_visit
         FROM patients p JOIN users u ON u.id = p.user_id
         LEFT JOIN appointments a ON a.patient_id = p.id
        WHERE ${where.join(' AND ')}
        GROUP BY p.id, u.id ORDER BY u.created_at DESC`,
      [`%${search.trim()}%`],
    ),
  );
});

r.get('/patients/:id', async (req, res) => {
  const id = toId(req.params.id);
  const p = await one(
    `SELECT p.id, u.name, u.email, u.phone, u.is_active, u.created_at, p.age, p.gender, p.blood_group, p.address
       FROM patients p JOIN users u ON u.id = p.user_id WHERE p.id = $1`,
    [id],
  );
  if (!p) throw notFound('Patient not found');
  p.appointments = await q(`${APPOINTMENT_SELECT} WHERE a.patient_id = $1 ORDER BY a.date DESC, a.time DESC`, [id]);
  res.json(p);
});

r.patch('/patients/:id/status', async (req, res) => {
  const p = await one('SELECT user_id FROM patients WHERE id = $1', [toId(req.params.id)]);
  if (!p) throw notFound('Patient not found');
  await one('UPDATE users SET is_active = $1 WHERE id = $2', [!!req.body.isActive, p.userId]);
  res.json({ message: req.body.isActive ? 'Patient activated' : 'Patient deactivated' });
});

r.delete('/patients/:id', async (req, res) => {
  const p = await one('SELECT user_id FROM patients WHERE id = $1', [toId(req.params.id)]);
  if (!p) throw notFound('Patient not found');
  await one('DELETE FROM users WHERE id = $1', [p.userId]);
  res.json({ message: 'Patient deleted' });
});

/* ---------- Appointments ---------- */
r.get('/appointments', async (req, res) => {
  const { search, doctorId, status, date, from, to, needsRebook, mode, payment } = req.query;
  const params = [];
  const where = ['TRUE'];
  const add = (sql, v) => {
    params.push(v);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (search?.trim()) add('(pu.name ILIKE ? OR du.name ILIKE ?)'.replace('?', `$${params.length + 1}`), `%${search.trim()}%`);
  if (doctorId) add('a.doctor_id = ?', toId(doctorId));
  if (status) add('a.status = ?', status);
  if (date && isValidDate(date)) add('a.date = ?', date);
  if (from && isValidDate(from)) add('a.date >= ?', from);
  if (to && isValidDate(to)) add('a.date <= ?', to);
  if (needsRebook === '1') where.push('a.needs_rebook');
  if (mode === 'VIDEO' || mode === 'CLINIC') add('a.mode = ?', mode);
  if (['PAID', 'PENDING', 'REFUNDED', 'PAY_AT_CLINIC'].includes(payment)) add('a.payment_status = ?', payment);
  res.json(await q(`${APPOINTMENT_SELECT} WHERE ${where.join(' AND ')} ORDER BY a.date DESC, a.time DESC LIMIT 500`, params));
});

r.patch('/appointments/:id/status', async (req, res) => {
  const appt = await one(`${APPOINTMENT_SELECT} WHERE a.id = $1`, [toId(req.params.id)]);
  if (!appt) throw notFound('Appointment not found');
  const { status } = req.body;
  const allowed = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
  if (!allowed.includes(status)) throw bad('Invalid status');
  if (appt.status === 'CANCELLED' && status !== 'CANCELLED') {
    const clash = await one(
      `SELECT id FROM appointments WHERE doctor_id = $1 AND date = $2 AND time = $3 AND status <> 'CANCELLED' AND id <> $4`,
      [appt.doctorId, appt.date, appt.time, appt.id],
    );
    if (clash) throw bad('This slot has been booked by someone else, so it cannot be restored');
  }
  const cancelling = status === 'CANCELLED' && appt.status !== 'CANCELLED';
  await one('UPDATE appointments SET status = $1, cancelled_by = $2, cancel_reason = $3, needs_rebook = $4 WHERE id = $5', [
    status, status === 'CANCELLED' ? 'ADMIN' : null, status === 'CANCELLED' ? 'Cancelled by the clinic' : null, cancelling ? true : status === 'CANCELLED' && appt.needsRebook, appt.id,
  ]);
  if (cancelling) {
    const refunded = appt.paymentStatus === 'PAID' ? await refundAppointment(appt.id) : false;
    const p = await one('SELECT user_id FROM patients WHERE id = $1', [appt.patientId]);
    await notify(
      p.userId,
      `Your appointment with ${appt.doctorName} on ${formatDateLabel(appt.date)} at ${formatTimeLabel(appt.time)} was cancelled by the clinic.${refunded ? ` ₹${appt.fee} has been refunded.` : ''} Please pick a new time.`,
      `/patient/appointments?rebook=${appt.id}`,
      { email: 'Your appointment was cancelled', sms: true },
    );
    await onSlotFreed(appt.doctorId, appt.date);
  }
  emitQueue(appt.doctorId, appt.date);
  res.json({ message: 'Status updated' });
});

r.post('/appointments/:id/check-in', async (req, res) => {
  const token = await checkIn(toId(req.params.id), { by: 'ADMIN' });
  res.json({ token, message: `Checked in with token ${token}` });
});

/* ---------- Reviews ---------- */
r.get('/reviews', async (req, res) => {
  const { rating, doctorId } = req.query;
  const params = [];
  const where = ['TRUE'];
  if (rating) { params.push(Number(rating)); where.push(`r.rating = $${params.length}`); }
  if (doctorId) { params.push(toId(doctorId)); where.push(`r.doctor_id = $${params.length}`); }
  res.json(
    await q(
      `SELECT r.id, r.rating, r.comment, r.is_hidden, r.created_at, pu.name AS patient_name, du.name AS doctor_name, a.date
         FROM reviews r JOIN appointments a ON a.id = r.appointment_id JOIN patients p ON p.id = r.patient_id
         JOIN users pu ON pu.id = p.user_id JOIN doctors d ON d.id = r.doctor_id JOIN users du ON du.id = d.user_id
        WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC LIMIT 300`,
      params,
    ),
  );
});
r.patch('/reviews/:id', async (req, res) => {
  await one('UPDATE reviews SET is_hidden = $1 WHERE id = $2', [!!req.body.isHidden, toId(req.params.id)]);
  res.json({ message: req.body.isHidden ? 'Review hidden' : 'Review visible' });
});

/* ---------- Email / SMS log ---------- */
r.get('/messages', async (req, res) => {
  const { channel, search = '' } = req.query;
  const params = [`%${search.trim()}%`];
  let where = '(m.recipient ILIKE $1 OR m.body ILIKE $1 OR u.name ILIKE $1)';
  if (channel === 'EMAIL' || channel === 'SMS') { params.push(channel); where += ` AND m.channel = $2`; }
  res.json({
    providers: providers(),
    items: await q(
      `SELECT m.id, m.channel, m.recipient, m.subject, m.body, m.status, m.error, m.created_at, u.name AS user_name
         FROM message_log m LEFT JOIN users u ON u.id = m.user_id WHERE ${where} ORDER BY m.created_at DESC LIMIT 200`,
      params,
    ),
  });
});

/* ---------- Specializations ---------- */
r.post('/specializations', async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) throw bad('Name is required');
  if (await one('SELECT id FROM specializations WHERE LOWER(name) = LOWER($1)', [name.trim()])) throw bad('This specialization already exists');
  res.status(201).json(await one('INSERT INTO specializations (name, description) VALUES ($1, $2) RETURNING *', [name.trim(), description || null]));
});

r.put('/specializations/:id', async (req, res) => {
  const { name, description } = req.body;
  const id = toId(req.params.id);
  if (!name?.trim()) throw bad('Name is required');
  if (await one('SELECT id FROM specializations WHERE LOWER(name) = LOWER($1) AND id <> $2', [name.trim(), id])) throw bad('This specialization already exists');
  const s = await one('UPDATE specializations SET name = $1, description = $2 WHERE id = $3 RETURNING *', [name.trim(), description || null, id]);
  if (!s) throw notFound('Specialization not found');
  res.json(s);
});

r.delete('/specializations/:id', async (req, res) => {
  const id = toId(req.params.id);
  const used = await one('SELECT COUNT(*)::int AS n FROM doctors WHERE specialization_id = $1', [id]);
  if (used.n) throw bad(`${used.n} doctor${used.n > 1 ? 's are' : ' is'} in this specialization. Move them first.`);
  await one('DELETE FROM specializations WHERE id = $1', [id]);
  res.json({ message: 'Specialization deleted' });
});

export default r;
