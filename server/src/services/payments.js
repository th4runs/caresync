// Razorpay (India) when keys are set; otherwise a built-in DEMO gateway so the flow can be tested.
import crypto from 'node:crypto';
import { one, pool } from '../utils/db.js';

export const razorpayEnabled = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

async function rzp(path, body) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error?.description || 'Payment gateway error'), { status: 502 });
  return data;
}

/** Creates a payment for an appointment and returns what the browser needs to open checkout. */
export async function createPayment(appt) {
  if (razorpayEnabled()) {
    const order = await rzp('/orders', { amount: appt.fee * 100, currency: 'INR', receipt: `CS-${appt.id}` });
    const p = await one(
      `INSERT INTO payments (appointment_id, amount, provider, order_id) VALUES ($1, $2, 'RAZORPAY', $3) RETURNING id`,
      [appt.id, appt.fee, order.id],
    );
    return { paymentId: p.id, provider: 'RAZORPAY', orderId: order.id, amount: appt.fee, keyId: process.env.RAZORPAY_KEY_ID };
  }
  const orderId = `demo_order_${crypto.randomBytes(6).toString('hex')}`;
  const p = await one(`INSERT INTO payments (appointment_id, amount, provider, order_id) VALUES ($1, $2, 'DEMO', $3) RETURNING id`, [
    appt.id, appt.fee, orderId,
  ]);
  return { paymentId: p.id, provider: 'DEMO', orderId, amount: appt.fee };
}

export function verifyRazorpaySignature(orderId, paymentId, signature) {
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  const given = Buffer.from(String(signature || ''));
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), given);
}

/** Refunds the paid payment of an appointment (if any). Returns true when a refund was made. */
export async function refundAppointment(appointmentId) {
  const pay = await one(`SELECT * FROM payments WHERE appointment_id = $1 AND status = 'PAID' ORDER BY id DESC LIMIT 1`, [appointmentId]);
  if (!pay) return false;
  let refundId = `demo_rfnd_${crypto.randomBytes(5).toString('hex')}`;
  if (pay.provider === 'RAZORPAY') {
    try {
      refundId = (await rzp(`/payments/${pay.paymentId}/refund`, { amount: pay.amount * 100 })).id;
    } catch (e) {
      console.error('Refund failed for payment', pay.id, e.message);
      return false;
    }
  }
  await pool.query(`UPDATE payments SET status = 'REFUNDED', refund_id = $1, updated_at = NOW() WHERE id = $2`, [refundId, pay.id]);
  await pool.query(`UPDATE appointments SET payment_status = 'REFUNDED' WHERE id = $1`, [appointmentId]);
  return true;
}
