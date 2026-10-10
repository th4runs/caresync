import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { requireAuth, requireRole } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import patientRoutes from './routes/patient.js';
import doctorRoutes from './routes/doctor.js';
import adminRoutes from './routes/admin.js';
import notificationRoutes from './routes/notifications.js';
import uploadRoutes, { UPLOAD_DIR } from './routes/uploads.js';
import { initRealtime } from './services/realtime.js';
import { startJobs } from './services/jobs.js';
import { providers } from './services/messaging.js';
import { razorpayEnabled } from './services/payments.js';

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Copy .env.example to .env and fill it in.');
  process.exit(1);
}
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
const corsOrigin = process.env.CLIENT_URL?.split(',') || true;
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api/patient', requireAuth, requireRole('PATIENT'), patientRoutes);
app.use('/api/doctor', requireAuth, requireRole('DOCTOR'), doctorRoutes);
app.use('/api/admin', requireAuth, requireRole('ADMIN'), adminRoutes);
app.use('/api/notifications', requireAuth, notificationRoutes);
app.use('/api/uploads', requireAuth, requireRole('ADMIN', 'DOCTOR'), uploadRoutes);
app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint not found' }));

// In production, serve the built React app from ../client/dist
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|uploads|socket\.io).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 400 : 500);
  if (status >= 500) console.error(err);
  const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be under 2 MB' : status >= 500 ? 'Something went wrong. Please try again.' : err.message;
  res.status(status).json({ message, ...(err.count ? { count: err.count } : {}) });
});

const port = process.env.PORT || 5000;
const server = http.createServer(app);
initRealtime(server, corsOrigin);
server.listen(port, () => {
  const p = providers();
  console.log(`CareSync API running on http://localhost:${port}`);
  console.log(`  Email: ${p.email ? 'SMTP' : 'log only'} · SMS: ${p.sms ? 'Twilio' : 'log only'} · Payments: ${razorpayEnabled() ? 'Razorpay' : 'demo gateway'}`);
  startJobs();
});
