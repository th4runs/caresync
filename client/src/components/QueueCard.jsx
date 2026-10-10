import { useState } from 'react';
import { Card } from './ui';
import { api } from '../lib/api';
import { useQueueWatch } from '../lib/socket';

/** Live token status for a checked-in patient. */
export default function QueueCard({ appt, initial }) {
  const [q, setQ] = useState(initial);
  useQueueWatch(appt.doctorId, () => api.get(`/patient/appointments/${appt.id}/queue`).then(setQ).catch(() => {}));
  if (!q) return null;
  return (
    <Card className={`p-5 ${q.isMyTurn ? 'border-emerald-300 bg-emerald-50/40' : ''}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Your token</p>
          <p className="text-5xl font-bold text-brand-700 tabular-nums leading-tight mt-1">{q.myToken}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Now serving</p>
          <p className="text-3xl font-semibold tabular-nums mt-1">{q.nowServing ?? '–'}</p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-line text-sm">
        {q.isMyTurn ? (
          <p className="font-medium text-emerald-700">It's your turn. Please go to the consultation room.</p>
        ) : appt.status === 'COMPLETED' ? (
          <p className="text-ink-muted">Consultation completed.</p>
        ) : (
          <p className="text-ink-soft">
            <span className="font-medium">{q.ahead}</span> {q.ahead === 1 ? 'patient' : 'patients'} ahead of you · about{' '}
            <span className="font-medium">{q.estimatedWait} min</span> wait
            {q.delayMinutes > 0 && <span className="text-amber-700"> (doctor running {q.delayMinutes} min late)</span>}
          </p>
        )}
        <p className="text-xs text-ink-muted mt-1">Updates live. You'll also get an alert when you're next.</p>
      </div>
    </Card>
  );
}
