import jwt from 'jsonwebtoken';
import { one } from '../utils/db.js';

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Please log in to continue' });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
  }
  const user = await one(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, p.id AS patient_id, d.id AS doctor_id
       FROM users u
       LEFT JOIN patients p ON p.user_id = u.id
       LEFT JOIN doctors d ON d.user_id = u.id
      WHERE u.id = $1`,
    [payload.id],
  );
  if (!user || !user.isActive) return res.status(401).json({ message: 'This account is inactive. Contact the clinic.' });
  req.user = user;
  next();
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'You do not have access to this' });
  next();
};
