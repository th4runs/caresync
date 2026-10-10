import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Avatar, Button, Card } from './ui';
import { api } from '../lib/api';
import { formatDate, formatTime, relativeDay, rupees } from '../lib/format';
import { useToast } from '../context/ToastContext';

/** Shown when a doctor became unavailable and the patient needs to pick a new time. */
export default function RebookCard({ appt, onDismissed, highlight }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [next, setNext] = useState(null);

  useEffect(() => {
    api.get(`/doctors/${appt.doctorId}/next-available`).then(setNext).catch(() => setNext({ date: null, slots: [] }));
  }, [appt.doctorId]);

  const dismiss = async () => {
    await api.patch(`/patient/appointments/${appt.id}/dismiss-rebook`).catch(() => {});
    toast.success('Okay, we won\'t remind you about this one');
    onDismissed?.();
  };

  const bookUrl = (date, time) => `/patient/doctors/${appt.doctorId}/book?rebook=${appt.id}${date ? `&date=${date}` : ''}${time ? `&time=${time}` : ''}`;

  return (
    <Card className={`overflow-hidden border-amber-200 ${highlight ? 'ring-2 ring-amber-300' : ''}`}>
      <div className="bg-amber-50 px-5 py-3 flex items-center gap-2 text-amber-800 text-sm font-medium border-b border-amber-100">
        <AlertTriangle className="h-4 w-4" /> Action needed: please choose a new time
      </div>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <Avatar name={appt.doctorName} src={appt.doctorPhoto} />
          <div className="flex-1">
            <p className="font-semibold">{appt.doctorName}</p>
            <p className="text-sm text-ink-muted">{appt.specialization}</p>
            <p className="text-sm text-ink-soft mt-2">
              Your appointment on <span className="font-medium">{formatDate(appt.date)} at {formatTime(appt.time)}</span> was cancelled because{' '}
              {appt.cancelReason === 'Doctor emergency' ? 'the doctor had a medical emergency' : appt.cancelReason === 'Doctor on leave' ? 'the doctor is on leave' : 'the doctor became unavailable'}. We're sorry for the trouble.
              {appt.paymentStatus === 'REFUNDED' && ` Your ${rupees(appt.fee)} payment has been refunded.`}
            </p>
          </div>
        </div>

        <p className="text-sm font-medium mt-5 mb-2">
          {next === null ? 'Finding the next free slots…' : next.date ? `Next available with ${appt.doctorName.replace('Dr. ', 'Dr. ')} · ${relativeDay(next.date)}` : 'No free slots with this doctor in the next 30 days'}
        </p>
        {next?.date && (
          <div className="flex flex-wrap gap-2">
            {next.slots.slice(0, 4).map((s) => (
              <button key={s.time} onClick={() => navigate(bookUrl(next.date, s.time))} className="h-10 px-4 rounded-lg border border-line text-sm font-medium text-ink-soft hover:border-brand-500 hover:text-brand-700 hover:bg-brand-50">
                {formatTime(s.time)}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-4">
          <Button size="sm" to={bookUrl()}>
            Choose another time
          </Button>
          <Button size="sm" variant="secondary" to={`/patient/doctors?search=${encodeURIComponent(appt.specialization)}`}>
            See other {appt.specialization} doctors
          </Button>
          <button onClick={dismiss} className="text-sm text-ink-muted hover:text-ink px-2">
            I'll book later
          </button>
        </div>
      </div>
    </Card>
  );
}

export function DelayNotice({ minutes, doctorName, className = '' }) {
  if (!minutes) return null;
  return (
    <div className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 ${className}`}>
      <span className="font-medium">{doctorName} is running about {minutes} minutes late today.</span> Your consultation may start a little later than booked.
    </div>
  );
}

export function TransferNotice({ appt }) {
  if (!appt.transferredFromName || appt.status !== 'SCHEDULED') return null;
  return (
    <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
      {appt.transferredFromName} became unavailable, so this appointment was moved to <span className="font-medium">{appt.doctorName}</span> at the same time. You can still{' '}
      <Link to={`/patient/appointments/${appt.id}`} className="underline">reschedule or cancel for free</Link>.
    </div>
  );
}
