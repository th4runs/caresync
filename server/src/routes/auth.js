import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { one, tx } from '../utils/db.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { bad } from '../utils/http.js';

const r = Router();
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');

r.post('/register', async (req, res) => {
  const { name, email, password, phone, age, gender } = req.body;
  if (!name?.trim()) throw bad('Please enter your full name');
  if (!emailOk(email)) throw bad('Please enter a valid email address');
  if (!password || password.length < 6) throw bad('Password must be at least 6 characters');
  if (phone && !/^[6-9]\d{9}$/.test(phone)) throw bad('Enter a valid 10-digit mobile number');

  const exists = await one('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (exists) throw bad('An account with this email already exists');

  const hash = await bcrypt.hash(password, 10);
  const user = await tx(async (c) => {
    const u = await one(
      `INSERT INTO users (name, email, password, phone, role) VALUES ($1, $2, $3, $4, 'PATIENT')
       RETURNING id, name, email, role`,
      [name.trim(), email.toLowerCase(), hash, phone || null], c,
    );
    await c.query('INSERT INTO patients (user_id, age, gender) VALUES ($1, $2, $3)', [u.id, age || null, gender || null]);
    return u;
  });
  res.status(201).json({ token: signToken(user), user });
});

r.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await one('SELECT id, name, email, role, password, is_active FROM users WHERE email = $1', [
    (email || '').toLowerCase(),
  ]);
  if (!user || !(await bcrypt.compare(password || '', user.password))) throw bad('Incorrect email or password');
  if (!user.isActive) throw bad('This account has been deactivated. Please contact the clinic.');
  delete user.password;
  delete user.isActive;
  res.json({ token: signToken(user), user });
});

r.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

r.put('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) throw bad('New password must be at least 6 characters');
  const u = await one('SELECT password FROM users WHERE id = $1', [req.user.id]);
  if (!(await bcrypt.compare(currentPassword || '', u.password))) throw bad('Current password is incorrect');
  await one('UPDATE users SET password = $1 WHERE id = $2', [await bcrypt.hash(newPassword, 10), req.user.id]);
  res.json({ message: 'Password updated' });
});

export default r;
