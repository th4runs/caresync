import { Router } from 'express';
import { one, q } from '../utils/db.js';
import { DOCTOR_SELECT } from '../utils/queries.js';
import { getSlots } from '../utils/slots.js';
import { displayBoard } from '../services/queue.js';
import { razorpayEnabled } from '../services/payments.js';
import { addDays, isValidDate, todayIST } from '../utils/time.js';
import { bad, notFound, toId } from '../utils/http.js';

const r = Router();

r.get('/config', (req, res) => res.json({ payments: razorpayEnabled() ? 'RAZORPAY' : 'DEMO' }));

r.get('/specializations', async (req, res) => {
  res.json(
    await q(`SELECT s.id, s.name, s.description,
                    COUNT(d.id) FILTER (WHERE u.is_active)::int AS doctor_count
               FROM specializations s
               LEFT JOIN doctors d ON d.specialization_id = s.id
               LEFT JOIN users u ON u.id = d.user_id
              GROUP BY s.id ORDER BY s.name`),
  );
});

r.get('/stats', async (req, res) => {
  res.json(
    await one(`SELECT
      (SELECT COUNT(*) FROM doctors d JOIN users u ON u.id = d.user_id WHERE u.is_active)::int AS doctors,
      (SELECT COUNT(*) FROM specializations)::int AS specializations,
      (SELECT COUNT(*) FROM patients)::int AS patients,
      (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE NOT is_hidden)::float AS rating,
      (SELECT COUNT(*) FROM reviews WHERE NOT is_hidden)::int AS reviews`),
  );
});

r.get('/doctors', async (req, res) => {
  const { search = '', specializationId, sort, video } = req.query;
  const params = [`%${search.trim()}%`];
  let where = 'WHERE u.is_active AND (u.name ILIKE $1 OR s.name ILIKE $1)';
  if (specializationId) {
    params.push(toId(specializationId));
    where += ` AND d.specialization_id = $${params.length}`;
  }
  if (video === '1') where += ' AND d.video_enabled';
  const order = {
    fee_low: 'd.fee ASC',
    fee_high: 'd.fee DESC',
    experience: 'd.experience DESC',
    rating: 'rating DESC, review_count DESC',
  }[sort] || 'u.name ASC';
  res.json(await q(`${DOCTOR_SELECT} ${where} ORDER BY ${order}`, params));
});

r.get('/doctors/:id', async (req, res) => {
  const id = toId(req.params.id);
  const doctor = await one(`${DOCTOR_SELECT} WHERE d.id = $1 AND u.is_active`, [id]);
  if (!doctor) throw notFound('Doctor not found');
  doctor.availability = await q(
    'SELECT day_of_week, start_time, end_time FROM availability WHERE doctor_id = $1 ORDER BY day_of_week, start_time',
    [id],
  );
  const stats = await one(
    `SELECT COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS consultations,
            COUNT(DISTINCT patient_id) FILTER (WHERE status = 'COMPLETED')::int AS patients
       FROM appointments WHERE doctor_id = $1`,
    [id],
  );
  res.json({ ...doctor, ...stats });
});

r.get('/doctors/:id/reviews', async (req, res) => {
  const id = toId(req.params.id);
  const reviews = await q(
    `SELECT r.id, r.rating, r.comment, r.created_at, split_part(pu.name, ' ', 1) AS patient_first,
            LEFT(split_part(pu.name, ' ', 2), 1) AS patient_initial
       FROM reviews r JOIN patients p ON p.id = r.patient_id JOIN users pu ON pu.id = p.user_id
      WHERE r.doctor_id = $1 AND NOT r.is_hidden ORDER BY r.created_at DESC LIMIT 50`,
    [id],
  );
  const breakdown = await q(
    `SELECT rating, COUNT(*)::int AS count FROM reviews WHERE doctor_id = $1 AND NOT is_hidden GROUP BY rating`,
    [id],
  );
  res.json({ reviews, breakdown });
});

r.get('/doctors/:id/slots', async (req, res) => {
  const id = toId(req.params.id);
  const { date } = req.query;
  if (!isValidDate(date)) throw bad('Invalid date');
  if (date > addDays(todayIST(), 60)) throw bad('Appointments can be booked up to 60 days ahead');
  res.json(await getSlots(id, date));
});

r.get('/doctors/:id/next-available', async (req, res) => {
  const id = toId(req.params.id);
  const today = todayIST();
  for (let i = 0; i <= 30; i++) {
    const date = addDays(today, i);
    const { slots } = await getSlots(id, date);
    const open = slots.filter((s) => s.available);
    if (open.length) return res.json({ date, slots: open });
  }
  res.json({ date: null, slots: [] });
});

// Waiting-room TV screen (tokens only, no patient names)
r.get('/queue/display', async (req, res) => res.json({ today: todayIST(), boards: await displayBoard() }));

export default r;
