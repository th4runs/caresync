import { Router } from 'express';
import { one, q, tx } from '../utils/db.js';
import { APPOINTMENT_SELECT } from '../utils/queries.js';
import { getSlots } from '../utils/slots.js';
import { notify } from '../utils/notify.js';
import { createPayment, razorpayEnabled, refundAppointment, verifyRazorpaySignature } from '../services/payments.js';
import { markWaitlistBooked, onSlotFreed } from '../services/waitlist.js';
import { checkIn, patientQueue } from '../services/queue.js';
import { emitQueue } from '../services/realtime.js';
import { addDays, formatDateLabel, formatTimeLabel, isValidDate, isValidTime, nowMinutesIST, todayIST, toMinutes } from '../utils/time.js';
import { bad, forbidden, notFound, toId } from '../utils/http.js';

const r = Router();
const REFUND_CUTOFF_MIN = 120; // full refund if the patient cancels at least 2 hours before

const minutesUntil = (a) => {
  const today = todayIST();
  if (a.date < today) return -1e6;
  const days = Math.round((new Date(a.date) - new Date(today)) / 86400000);
  return days * 1440 + toMinutes(a.time) - nowMinutesIST();
};
const isUpcoming = (a) => ['SCHEDULED', 'IN_PROGRESS'].includes(a.status) && minutesUntil(a) >= -60;

async function ownAppointment(req, id = req.params.id) {
  const appt = await one(`${APPOINTMENT_SELECT} WHERE a.id = $1`, [toId(id)]);
  if (!appt) throw notFound('Appointment not found');
  if (appt.patientId !== req.user.patientId) throw forbidden();
  return appt;
}

async function assertSlotFree(doctorId, date, time) {
  if (!isValidDate(date) || !isValidTime(time)) throw bad('Please pick a valid date and time');
  if (date > addDays(todayIST(), 60)) throw bad('Appointments can be booked up to 60 days ahead');
  const { slots, reason } = await getSlots(doctorId, date);
  const slot = slots.find((s) => s.time === time);
  if (!slot) throw bad(reason || "This time is not one of the doctor's slots");
  if (!slot.available) throw bad('Sorry, this slot was just taken. Please choose another time.');
}

async function sendConfirmation(appt, user) {
  const when = `${formatDateLabel(appt.date)} at ${formatTimeLabel(appt.time)}`;
  const kind = appt.mode === 'VIDEO' ? 'video consultation' : 'appointment';
  await notify(
    user.id,
    `Your ${kind} with ${appt.doctorName} is confirmed for ${when}. Booking ID CS-${String(appt.id).padStart(5, '0')}.`,
    `/patient/appointments/${appt.id}`,
    { email: 'Appointment confirmed', sms: true },
  );
  const doc = await one('SELECT user_id FROM doctors WHERE id = $1', [appt.doctorId]);
  await notify(doc.userId, `New ${kind}: ${user.name} on ${when}.`, '/doctor/appointments');
}

/* ---------------- Dashboard & profile ---------------- */
r.get('/dashboard', async (req, res) => {
  const pid = req.user.patientId;
  const all = await q(`${APPOINTMENT_SELECT} WHERE a.patient_id = $1 ORDER BY a.date, a.time`, [pid]);
  const upcoming = all.filter(isUpcoming);
  res.json({
    stats: {
      total: all.length,
      upcoming: upcoming.length,
      completed: all.filter((a) => a.status === 'COMPLETED').length,
      cancelled: all.filter((a) => a.status === 'CANCELLED').length,
    },
    upcoming: upcoming.slice(0, 3),
    actionNeeded: all.filter((a) => a.needsRebook),
    toReview: all.filter((a) => a.status === 'COMPLETED' && !a.myRating && a.date >= addDays(todayIST(), -30)).slice(-1),
    recentVisits: all.filter((a) => a.status === 'COMPLETED').reverse().slice(0, 3),
  });
});

r.get('/profile', async (req, res) => {
  res.json(
    await one(
      `SELECT u.id, u.name, u.email, u.phone, u.created_at, p.age, p.gender, p.blood_group, p.address
         FROM users u JOIN patients p ON p.user_id = u.id WHERE u.id = $1`,
      [req.user.id],
    ),
  );
});

r.put('/profile', async (req, res) => {
  const { name, phone, age, gender, bloodGroup, address } = req.body;
  if (!name?.trim()) throw bad('Name is required');
  if (phone && !/^[6-9]\d{9}$/.test(phone)) throw bad('Enter a valid 10-digit mobile number');
  if (age && (age < 0 || age > 120)) throw bad('Enter a valid age');
  await tx(async (c) => {
    await c.query('UPDATE users SET name = $1, phone = $2 WHERE id = $3', [name.trim(), phone || null, req.user.id]);
    await c.query('UPDATE patients SET age = $1, gender = $2, blood_group = $3, address = $4 WHERE user_id = $5', [
      age || null, gender || null, bloodGroup || null, address || null, req.user.id,
    ]);
  });
  res.json({ message: 'Profile updated' });
});

/* ---------------- Appointments ---------------- */
r.get('/appointments', async (req, res) => {
  const all = await q(`${APPOINTMENT_SELECT} WHERE a.patient_id = $1 ORDER BY a.date DESC, a.time DESC`, [req.user.patientId]);
  const upcoming = all.filter(isUpcoming).reverse();
  const cancelled = all.filter((a) => a.status === 'CANCELLED');
  const past = all.filter((a) => a.status !== 'CANCELLED' && !isUpcoming(a));
  const waitlist = await q(
    `SELECT w.id, w.date, w.status, w.doctor_id, du.name AS doctor_name, s.name AS specialization, d.photo_url AS doctor_photo
       FROM waitlist w JOIN doctors d ON d.id = w.doctor_id JOIN users du ON du.id = d.user_id JOIN specializations s ON s.id = d.specialization_id
      WHERE w.patient_id = $1 AND w.status IN ('WAITING', 'NOTIFIED') AND w.date >= $2 ORDER BY w.date`,
    [req.user.patientId, todayIST()],
  );
  res.json({ upcoming, past, cancelled, actionNeeded: all.filter((a) => a.needsRebook), waitlist });
});

r.get('/appointments/:id', async (req, res) => {
  const appt = await ownAppointment(req);
  appt.note = await one('SELECT * FROM consultation_notes WHERE appointment_id = $1', [appt.id]);
  appt.doctor = await one(
    `SELECT d.qualification, d.experience, u.phone FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = $1`,
    [appt.doctorId],
  );
  appt.payments = await q('SELECT id, amount, provider, order_id, payment_id, refund_id, status, created_at, updated_at FROM payments WHERE appointment_id = $1 ORDER BY id', [appt.id]);
  appt.review = await one('SELECT rating, comment, created_at FROM reviews WHERE appointment_id = $1', [appt.id]);
  const mins = minutesUntil(appt);
  appt.minutesUntil = mins;
  appt.canChange = isUpcoming(appt) && appt.status === 'SCHEDULED' && mins > 0;
  appt.refundIfCancelled = appt.paymentStatus === 'PAID' && mins >= REFUND_CUTOFF_MIN;
  appt.canCheckIn = appt.mode === 'CLINIC' && appt.status === 'SCHEDULED' && appt.date === todayIST() && !appt.tokenNo && mins <= 60 && mins >= -45 && appt.paymentStatus !== 'PENDING';
  appt.canJoinVideo = appt.mode === 'VIDEO' && ['SCHEDULED', 'IN_PROGRESS'].includes(appt.status) && appt.date === todayIST() && mins <= 15 && appt.paymentStatus !== 'PENDING';
  appt.canReview = appt.status === 'COMPLETED' && !appt.review;
  if (appt.tokenNo && appt.date === todayIST()) appt.queue = await patientQueue(appt);
  res.json(appt);
});

r.get('/appointments/:id/queue', async (req, res) => {
  const appt = await ownAppointment(req);
  if (!appt.tokenNo) return res.json(null);
  res.json(await patientQueue(appt));
});

r.get('/history', async (req, res) => {
  res.json(
    await q(
      `SELECT a.id, a.date, a.time, a.mode, du.name AS doctor_name, s.name AS specialization,
              cn.symptoms, cn.diagnosis, cn.prescription, cn.notes, cn.follow_up_date
         FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id JOIN users du ON du.id = d.user_id
         JOIN specializations s ON s.id = d.specialization_id
         LEFT JOIN consultation_notes cn ON cn.appointment_id = a.id
        WHERE a.patient_id = $1 AND a.status = 'COMPLETED'
        ORDER BY a.date DESC, a.time DESC`,
      [req.user.patientId],
    ),
  );
});

r.get('/payments', async (req, res) => {
  res.json(
    await q(
      `SELECT pay.id, pay.amount, pay.provider, pay.payment_id, pay.status, pay.created_at, pay.updated_at,
              a.id AS appointment_id, a.date, a.time, du.name AS doctor_name
         FROM payments pay JOIN appointments a ON a.id = pay.appointment_id
         JOIN doctors d ON d.id = a.doctor_id JOIN users du ON du.id = d.user_id
        WHERE a.patient_id = $1 AND pay.status <> 'CREATED' ORDER BY pay.created_at DESC`,
      [req.user.patientId],
    ),
  );
});

r.post('/appointments', async (req, res) => {
  const { doctorId, date, time, reason, rebookOf } = req.body;
  const mode = req.body.mode === 'VIDEO' ? 'VIDEO' : 'CLINIC';
  const payOnline = mode === 'VIDEO' || !!req.body.payOnline;
  const did = toId(doctorId);
  const doctor = await one('SELECT id, fee, video_enabled FROM doctors WHERE id = $1', [did]);
  if (!doctor) throw notFound('Doctor not found');
  if (mode === 'VIDEO' && !doctor.videoEnabled) throw bad('This doctor does not offer video consultations');
  await assertSlotFree(did, date, time);

  let old = null;
  if (rebookOf) {
    old = await ownAppointment(req, rebookOf);
    if (!old.needsRebook) throw bad('This appointment does not need rebooking');
  }
  const clash = await one(
    `SELECT id FROM appointments WHERE patient_id = $1 AND date = $2 AND time = $3 AND status <> 'CANCELLED'`,
    [req.user.patientId, date, time],
  );
  if (clash) throw bad('You already have another appointment at this time');

  let appt;
  try {
    appt = await one(
      `INSERT INTO appointments (patient_id, doctor_id, date, time, reason, mode, fee, payment_status, rebooked_from)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [req.user.patientId, did, date, time, reason?.trim() || old?.reason || null, mode, doctor.fee, payOnline ? 'PENDING' : 'PAY_AT_CLINIC', old?.id || null],
    );
  } catch (e) {
    if (e.code === '23505') throw bad('Sorry, this slot was just taken. Please choose another time.');
    throw e;
  }
  if (old) await one('UPDATE appointments SET needs_rebook = FALSE WHERE id = $1', [old.id]);
  await markWaitlistBooked(req.user.patientId, did, date);

  const full = await one(`${APPOINTMENT_SELECT} WHERE a.id = $1`, [appt.id]);
  if (!payOnline) {
    await sendConfirmation(full, req.user);
    return res.status(201).json({ appointment: full });
  }
  const payment = await createPayment(full);
  res.status(201).json({ appointment: full, payment });
});

/* ---------------- Payments ---------------- */
async function markPaid(appt, paymentRowId, gatewayPaymentId, user) {
  const updated = await one(
    `UPDATE payments SET status = 'PAID', payment_id = $1, updated_at = NOW() WHERE id = $2 AND status = 'CREATED' RETURNING id`,
    [gatewayPaymentId, paymentRowId],
  );
  if (!updated) return;
  // If the hold expired while paying, refund straight away
  if (appt.status === 'CANCELLED') {
    await refundAppointment(appt.id);
    throw bad('Your booking hold expired before payment completed. The amount has been refunded. Please book again.');
  }
  await one(`UPDATE appointments SET payment_status = 'PAID' WHERE id = $1`, [appt.id]);
  await sendConfirmation(appt, user);
}

r.post('/appointments/:id/pay', async (req, res) => {
  const appt = await ownAppointment(req);
  if (appt.paymentStatus !== 'PENDING' || appt.status !== 'SCHEDULED') throw bad('Nothing to pay for this appointment');
  res.json(await createPayment(appt));
});

r.post('/payments/:paymentId/verify', async (req, res) => {
  const pay = await one('SELECT * FROM payments WHERE id = $1', [toId(req.params.paymentId)]);
  if (!pay || pay.provider !== 'RAZORPAY') throw notFound('Payment not found');
  const appt = await ownAppointment(req, pay.appointmentId);
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  if (!razorpayEnabled() || orderId !== pay.orderId || !verifyRazorpaySignature(orderId, paymentId, signature)) {
    await one(`UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE id = $1 AND status = 'CREATED'`, [pay.id]);
    throw bad('Payment could not be verified. If money was deducted, it will be refunded automatically.');
  }
  await markPaid(appt, pay.id, paymentId, req.user);
  res.json({ message: 'Payment successful' });
});

// Built-in test gateway, used only when Razorpay keys are not configured
r.post('/payments/:paymentId/demo', async (req, res) => {
  if (razorpayEnabled()) throw bad('Demo payments are disabled');
  const pay = await one('SELECT * FROM payments WHERE id = $1', [toId(req.params.paymentId)]);
  if (!pay || pay.provider !== 'DEMO') throw notFound('Payment not found');
  const appt = await ownAppointment(req, pay.appointmentId);
  if (req.body.outcome !== 'success') {
    await one(`UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE id = $1 AND status = 'CREATED'`, [pay.id]);
    throw bad('Payment failed. No money was deducted. You can try again.');
  }
  await markPaid(appt, pay.id, `demo_pay_${Date.now().toString(36)}`, req.user);
  res.json({ message: 'Payment successful' });
});

/* ---------------- Changes ---------------- */
r.patch('/appointments/:id/cancel', async (req, res) => {
  const appt = await ownAppointment(req);
  if (appt.status !== 'SCHEDULED' || !isUpcoming(appt)) throw bad('This appointment can no longer be cancelled');
  await one(`UPDATE appointments SET status = 'CANCELLED', cancelled_by = 'PATIENT', cancel_reason = 'Cancelled by patient' WHERE id = $1`, [appt.id]);
  let refunded = false;
  if (appt.paymentStatus === 'PAID' && minutesUntil(appt) >= REFUND_CUTOFF_MIN) refunded = await refundAppointment(appt.id);
  if (appt.paymentStatus !== 'PENDING') {
    const doc = await one('SELECT user_id FROM doctors WHERE id = $1', [appt.doctorId]);
    await notify(doc.userId, `${appt.patientName} cancelled the appointment on ${formatDateLabel(appt.date)} at ${formatTimeLabel(appt.time)}.`, '/doctor/appointments');
    await notify(
      req.user.id,
      `Your appointment with ${appt.doctorName} on ${formatDateLabel(appt.date)} has been cancelled.${refunded ? ` ₹${appt.fee} will be refunded to your account in 5–7 working days.` : ''}`,
      `/patient/appointments/${appt.id}`,
      { email: 'Appointment cancelled' },
    );
  }
  emitQueue(appt.doctorId, appt.date);
  await onSlotFreed(appt.doctorId, appt.date);
  res.json({ message: refunded ? `Appointment cancelled. ₹${appt.fee} will be refunded.` : 'Appointment cancelled', refunded });
});

r.patch('/appointments/:id/reschedule', async (req, res) => {
  const appt = await ownAppointment(req);
  if (appt.status !== 'SCHEDULED' || !isUpcoming(appt)) throw bad('This appointment can no longer be rescheduled');
  if (appt.paymentStatus === 'PENDING') throw bad('Please complete the payment before rescheduling');
  const { date, time } = req.body;
  if (date === appt.date && time === appt.time) throw bad('Please pick a different time');
  await assertSlotFree(appt.doctorId, date, time);
  try {
    await one('UPDATE appointments SET date = $1, time = $2, reminder_sent = FALSE, token_no = NULL, checked_in_at = NULL WHERE id = $3', [date, time, appt.id]);
  } catch (e) {
    if (e.code === '23505') throw bad('Sorry, this slot was just taken. Please choose another time.');
    throw e;
  }
  const when = `${formatDateLabel(date)} at ${formatTimeLabel(time)}`;
  const doc = await one('SELECT user_id FROM doctors WHERE id = $1', [appt.doctorId]);
  await notify(req.user.id, `Your appointment with ${appt.doctorName} was moved to ${when}.`, `/patient/appointments/${appt.id}`, {
    email: 'Appointment rescheduled',
    sms: true,
  });
  await notify(doc.userId, `${appt.patientName} rescheduled to ${when}.`, '/doctor/appointments');
  await onSlotFreed(appt.doctorId, appt.date);
  res.json({ message: 'Appointment rescheduled' });
});

r.patch('/appointments/:id/dismiss-rebook', async (req, res) => {
  const appt = await ownAppointment(req);
  await one('UPDATE appointments SET needs_rebook = FALSE WHERE id = $1', [appt.id]);
  res.json({ message: 'ok' });
});

r.post('/appointments/:id/check-in', async (req, res) => {
  const appt = await ownAppointment(req);
  const token = await checkIn(appt.id, { by: 'PATIENT' });
  res.json({ token, message: `Checked in. Your token number is ${token}.` });
});

/* ---------------- Reviews ---------------- */
r.post('/appointments/:id/review', async (req, res) => {
  const appt = await ownAppointment(req);
  if (appt.status !== 'COMPLETED') throw bad('You can review only after the consultation is completed');
  const rating = Number(req.body.rating);
  if (!(rating >= 1 && rating <= 5 && Number.isInteger(rating))) throw bad('Choose a rating from 1 to 5 stars');
  const comment = req.body.comment?.trim().slice(0, 600) || null;
  try {
    await one('INSERT INTO reviews (appointment_id, patient_id, doctor_id, rating, comment) VALUES ($1, $2, $3, $4, $5)', [
      appt.id, req.user.patientId, appt.doctorId, rating, comment,
    ]);
  } catch (e) {
    if (e.code === '23505') throw bad('You have already reviewed this visit');
    throw e;
  }
  res.status(201).json({ message: 'Thank you for your feedback' });
});

/* ---------------- Waitlist ---------------- */
r.post('/waitlist', async (req, res) => {
  const did = toId(req.body.doctorId);
  const { date } = req.body;
  if (!isValidDate(date) || date < todayIST() || date > addDays(todayIST(), 60)) throw bad('Choose a valid date');
  const { slots } = await getSlots(did, date);
  if (!slots.length) throw bad('The doctor is not available on this day');
  if (slots.some((s) => s.available)) throw bad('There are still free slots on this day. Please book one directly.');
  await one(
    `INSERT INTO waitlist (patient_id, doctor_id, date) VALUES ($1, $2, $3)
     ON CONFLICT (patient_id, doctor_id, date) DO UPDATE SET status = 'WAITING', created_at = NOW()`,
    [req.user.patientId, did, date],
  );
  res.status(201).json({ message: "You're on the waitlist. We'll notify you if a slot opens." });
});

r.delete('/waitlist/:id', async (req, res) => {
  await q(`UPDATE waitlist SET status = 'LEFT' WHERE id = $1 AND patient_id = $2`, [toId(req.params.id), req.user.patientId]);
  res.json({ message: 'Removed from waitlist' });
});

export default r;
