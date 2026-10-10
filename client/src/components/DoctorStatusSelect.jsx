import { useState } from 'react';
import { api } from '../lib/api';
import { STATUS } from '../lib/format';
import { useToast } from '../context/ToastContext';
import { cx } from './ui';

export const DOCTOR_FLOW = {
  SCHEDULED: ['IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'SCHEDULED'],
  NO_SHOW: ['SCHEDULED'],
  COMPLETED: ['IN_PROGRESS'],
  CANCELLED: [],
};

const TONE = {
  SCHEDULED: 'text-brand-700 bg-brand-50 border-brand-100',
  IN_PROGRESS: 'text-amber-700 bg-amber-50 border-amber-100',
  COMPLETED: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  NO_SHOW: 'text-red-700 bg-red-50 border-red-100',
  CANCELLED: 'text-slate-600 bg-slate-100 border-slate-200',
};

/** Compact status dropdown that only offers valid next steps. */
export default function DoctorStatusSelect({ appt, onChanged, endpoint = `/doctor/appointments/${appt.id}/status`, options }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const allowed = options || DOCTOR_FLOW[appt.status] || [];

  const change = async (status) => {
    if (status === appt.status) return;
    if (status === 'CANCELLED' && !window.confirm('Cancel this appointment? The patient will be notified.')) return;
    setBusy(true);
    try {
      await api.patch(endpoint, { status });
      toast.success(`Marked as ${STATUS[status].label.toLowerCase()}`);
      onChanged?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <select
      value={appt.status}
      disabled={busy || !allowed.length}
      onChange={(e) => change(e.target.value)}
      aria-label="Appointment status"
      className={cx('h-8 rounded-full border pl-3 pr-7 text-xs font-medium appearance-none cursor-pointer disabled:cursor-default bg-no-repeat bg-[right_8px_center] bg-[length:12px]', TONE[appt.status])}
      style={{ backgroundImage: allowed.length ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" : 'none' }}
    >
      {[appt.status, ...allowed].map((s) => (
        <option key={s} value={s}>
          {STATUS[s].label}
        </option>
      ))}
    </select>
  );
}
