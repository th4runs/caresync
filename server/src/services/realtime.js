// Socket.IO: live notifications, queue updates and video-call signalling.
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { one } from '../utils/db.js';
import { nowMinutesIST, todayIST, toMinutes } from '../utils/time.js';

let io = null;

export const emitToUser = (userId, event, data) => io?.to(`user:${userId}`).emit(event, data);
export const emitQueue = (doctorId, date) => {
  if (!io || date !== todayIST()) return;
  io.to(`queue:${doctorId}`).emit('queue:update', { doctorId });
  io.to('queue:display').emit('queue:update', { doctorId });
};

async function canJoinVideo(user, appointmentId) {
  const a = await one(
    `SELECT a.id, a.date, a.time, a.mode, a.status, a.payment_status, p.user_id AS patient_user_id, d.user_id AS doctor_user_id
       FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN doctors d ON d.id = a.doctor_id WHERE a.id = $1`,
    [appointmentId],
  );
  if (!a) return { error: 'Appointment not found' };
  const isDoctor = a.doctorUserId === user.id;
  if (!isDoctor && a.patientUserId !== user.id) return { error: 'You are not part of this consultation' };
  if (a.mode !== 'VIDEO') return { error: 'This is an in-clinic appointment' };
  if (['CANCELLED', 'NO_SHOW'].includes(a.status)) return { error: 'This appointment was cancelled' };
  if (a.paymentStatus === 'PENDING') return { error: 'Please complete the payment first' };
  if (a.date !== todayIST()) return { error: 'The video room opens on the day of your appointment' };
  const diff = toMinutes(a.time) - nowMinutesIST();
  if (!isDoctor && diff > 15) return { error: `The room opens 15 minutes before your slot (in ${diff - 15} min)` };
  return { appt: a, isDoctor };
}

export function initRealtime(httpServer, corsOrigin) {
  io = new Server(httpServer, { cors: { origin: corsOrigin }, path: '/socket.io' });

  io.use(async (socket, next) => {
    // The public waiting-room display connects without a token
    const token = socket.handshake.auth?.token;
    if (!token) {
      socket.data.user = null;
      return next();
    }
    try {
      const { id } = jwt.verify(token, process.env.JWT_SECRET);
      const user = await one('SELECT id, name, role, is_active FROM users WHERE id = $1', [id]);
      if (!user?.isActive) return next(new Error('unauthorized'));
      socket.data.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (user) socket.join(`user:${user.id}`);

    socket.on('queue:watch', ({ doctorId } = {}) => {
      if (doctorId === 'display') socket.join('queue:display');
      else if (Number.isInteger(doctorId)) socket.join(`queue:${doctorId}`);
    });

    /* ---- Video call signalling (1:1, peer-to-peer WebRTC) ---- */
    socket.on('video:join', async ({ appointmentId } = {}, ack) => {
      if (!user) return ack?.({ error: 'Please log in' });
      const { error, appt, isDoctor } = await canJoinVideo(user, Number(appointmentId));
      if (error) return ack?.({ error });
      const room = `video:${appt.id}`;
      const others = (await io.in(room).fetchSockets()).filter((s) => s.data.user?.id !== user.id);
      socket.join(room);
      socket.data.videoRoom = room;
      socket.data.isDoctor = isDoctor;
      if (isDoctor && appt.status === 'SCHEDULED') {
        await one(`UPDATE appointments SET status = 'IN_PROGRESS' WHERE id = $1`, [appt.id]);
      }
      // The person already in the room starts the WebRTC offer
      socket.to(room).emit('video:peer-joined', { name: user.name, role: user.role });
      ack?.({ ok: true, peerPresent: others.length > 0, peerName: others[0]?.data.user?.name || null });
    });

    socket.on('video:signal', (data) => {
      if (socket.data.videoRoom) socket.to(socket.data.videoRoom).emit('video:signal', data);
    });

    socket.on('video:chat', (text) => {
      if (!socket.data.videoRoom || typeof text !== 'string' || !text.trim()) return;
      io.to(socket.data.videoRoom).emit('video:chat', { from: user.name, fromId: user.id, text: text.slice(0, 1000), at: Date.now() });
    });

    const leave = () => {
      if (!socket.data.videoRoom) return;
      socket.to(socket.data.videoRoom).emit('video:peer-left', { name: user?.name });
      socket.leave(socket.data.videoRoom);
      socket.data.videoRoom = null;
    };
    socket.on('video:leave', leave);
    socket.on('disconnect', leave);
  });
  return io;
}
