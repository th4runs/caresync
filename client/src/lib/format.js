const IST = 'Asia/Kolkata';

export const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date());

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const fmt = (iso, opts) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { timeZone: 'UTC', ...opts });

export const formatDate = (iso) => (iso ? fmt(iso, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const formatDateLong = (iso) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const formatDay = (iso) => fmt(iso, { weekday: 'short' });
export const formatDayNum = (iso) => fmt(iso, { day: 'numeric' });
export const formatMonth = (iso) => fmt(iso, { month: 'short' });
export const formatDateShort = (iso) => fmt(iso, { day: 'numeric', month: 'short' });

export function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export function relativeDay(iso) {
  const t = todayISO();
  if (iso === t) return 'Today';
  if (iso === addDays(t, 1)) return 'Tomorrow';
  if (iso === addDays(t, -1)) return 'Yesterday';
  return formatDate(iso);
}

export function timeAgo(ts) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const STATUS = {
  SCHEDULED: { label: 'Upcoming', tone: 'blue' },
  IN_PROGRESS: { label: 'In progress', tone: 'amber' },
  COMPLETED: { label: 'Completed', tone: 'green' },
  CANCELLED: { label: 'Cancelled', tone: 'gray' },
  NO_SHOW: { label: 'No-show', tone: 'red' },
};

export const initials = (name = '') =>
  name.replace(/^Dr\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export function slotPeriod(t) {
  const h = Number(t.split(':')[0]);
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}

export const PAYMENT = {
  PAY_AT_CLINIC: { label: 'Pay at clinic', tone: 'gray' },
  PENDING: { label: 'Payment pending', tone: 'amber' },
  PAID: { label: 'Paid online', tone: 'green' },
  REFUNDED: { label: 'Refunded', tone: 'blue' },
};

export const KIND = {
  EMERGENCY: { label: 'Emergency', tone: 'red' },
  PERSONAL: { label: 'Personal work', tone: 'amber' },
  LEAVE: { label: 'Leave', tone: 'gray' },
};

export function nowTimeIST() {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: IST }).format(new Date());
}

export const bookingId = (id) => `CS-${String(id).padStart(5, '0')}`;
