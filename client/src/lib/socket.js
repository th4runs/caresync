import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getToken } from './api';

let socket = null;
let socketToken = undefined;

/** One shared Socket.IO connection, re-created when the login changes. */
export function getSocket() {
  const token = getToken();
  if (socket && socketToken === token) return socket;
  socket?.disconnect();
  socketToken = token;
  socket = io({ path: '/socket.io', auth: token ? { token } : {}, transports: ['websocket', 'polling'] });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  socketToken = undefined;
}

/** Subscribe to a socket event for the lifetime of the component. */
export function useSocketEvent(event, handler, deps = []) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = getSocket();
    const fn = (data) => ref.current(data);
    s.on(event, fn);
    return () => s.off(event, fn);
  }, [event, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Live queue updates for one doctor (or 'display' for every doctor). */
export function useQueueWatch(doctorId, onUpdate) {
  useEffect(() => {
    if (!doctorId) return;
    const s = getSocket();
    const join = () => s.emit('queue:watch', { doctorId });
    join();
    s.on('connect', join);
    return () => s.off('connect', join);
  }, [doctorId]);
  useSocketEvent('queue:update', (d) => {
    if (doctorId === 'display' || d.doctorId === doctorId) onUpdate();
  }, [doctorId]);
}
