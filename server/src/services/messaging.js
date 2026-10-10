// Email (Nodemailer/SMTP) and SMS (Twilio REST). If a provider isn't configured,
// the message is still written to message_log with status LOGGED so you can see it in Admin → Messages.
import nodemailer from 'nodemailer';
import { pool } from '../utils/db.js';

let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const smsEnabled = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
export const providers = () => ({ email: !!transporter, sms: smsEnabled() });

async function log(row) {
  try {
    await pool.query(
      'INSERT INTO message_log (user_id, channel, recipient, subject, body, status, error) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [row.userId || null, row.channel, row.recipient, row.subject || null, row.body, row.status, row.error || null],
    );
  } catch (e) {
    console.error('message_log insert failed:', e.message);
  }
}

const appUrl = () => (process.env.APP_URL || process.env.CLIENT_URL?.split(',')[0] || 'http://localhost:5173').replace(/\/$/, '');

function emailHtml(heading, text, link) {
  const button = link
    ? `<p style="margin:28px 0 8px"><a href="${appUrl()}${link}" style="background:#1669d6;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">Open CareSync</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f5f7fa;font-family:Segoe UI,Roboto,Arial,sans-serif;color:#12223f">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #e4e9f0;border-radius:12px">
  <tr><td style="padding:22px 28px;border-bottom:1px solid #e4e9f0;font-size:20px;font-weight:700"><span style="color:#12223f">Care</span><span style="color:#1669d6">Sync</span></td></tr>
  <tr><td style="padding:28px">
    <h1 style="font-size:18px;margin:0 0 12px">${heading}</h1>
    <p style="font-size:15px;line-height:1.6;margin:0;color:#47546b">${text}</p>${button}
  </td></tr>
  <tr><td style="padding:18px 28px;border-top:1px solid #e4e9f0;font-size:12px;color:#6b768a">CareSync Clinic · 24, Anna Salai, Puducherry · +91 413 222 4455</td></tr>
  </table></td></tr></table></body></html>`;
}

export async function sendEmail({ userId, to, subject, text, link }) {
  if (!to) return;
  if (!transporter) return log({ userId, channel: 'EMAIL', recipient: to, subject, body: text, status: 'LOGGED' });
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || `CareSync <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: link ? `${text}\n\n${appUrl()}${link}` : text,
      html: emailHtml(subject, text, link),
    });
    await log({ userId, channel: 'EMAIL', recipient: to, subject, body: text, status: 'SENT' });
  } catch (e) {
    console.error('Email failed:', e.message);
    await log({ userId, channel: 'EMAIL', recipient: to, subject, body: text, status: 'FAILED', error: e.message });
  }
}

export async function sendSms({ userId, to, text }) {
  if (!to) return;
  const number = to.startsWith('+') ? to : `+91${to}`;
  const body = `CareSync: ${text}`;
  if (!smsEnabled()) return log({ userId, channel: 'SMS', recipient: number, body, status: 'LOGGED' });
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: number, From: process.env.TWILIO_FROM, Body: body }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `HTTP ${res.status}`);
    await log({ userId, channel: 'SMS', recipient: number, body, status: 'SENT' });
  } catch (e) {
    console.error('SMS failed:', e.message);
    await log({ userId, channel: 'SMS', recipient: number, body, status: 'FAILED', error: e.message });
  }
}
