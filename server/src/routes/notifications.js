import { Router } from 'express';
import { one, q } from '../utils/db.js';
import { toId } from '../utils/http.js';

const r = Router();

r.get('/', async (req, res) => {
  const items = await q('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [req.user.id]);
  const unread = await one('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND NOT is_read', [req.user.id]);
  res.json({ items, unread: unread.n });
});

r.patch('/read-all', async (req, res) => {
  await q('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user.id]);
  res.json({ message: 'ok' });
});

r.patch('/:id/read', async (req, res) => {
  await q('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [toId(req.params.id), req.user.id]);
  res.json({ message: 'ok' });
});

export default r;
