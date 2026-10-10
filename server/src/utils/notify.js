import { one } from './db.js';
import { emitToUser } from '../services/realtime.js';
import { sendEmail, sendSms } from '../services/messaging.js';

/**
 * In-app notification (pushed live), plus optional email and SMS.
 * opts.email: subject line → also email the user. opts.sms: true → also SMS the user.
 */
export async function notify(userId, message, link = null, opts = {}) {
  try {
    const n = await one('INSERT INTO notifications (user_id, message, link) VALUES ($1, $2, $3) RETURNING *', [userId, message, link]);
    emitToUser(userId, 'notification', n);
    if (opts.email || opts.sms) {
      const u = await one('SELECT email, phone FROM users WHERE id = $1', [userId]);
      if (opts.email) await sendEmail({ userId, to: u?.email, subject: opts.email, text: message, link });
      if (opts.sms) await sendSms({ userId, to: u?.phone, text: message });
    }
  } catch (e) {
    console.error('Notification failed:', e.message);
  }
}

