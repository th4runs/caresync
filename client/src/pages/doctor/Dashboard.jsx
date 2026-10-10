import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarCheck, CalendarDays, Clock, Megaphone, MonitorPlay, Users, Video } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, ErrorState, Modal, PageLoader, StatCard, cx } from '../../components/ui';
import DoctorStatusSelect from '../../components/DoctorStatusSelect';
import UnavailableModal from '../../components/UnavailableModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../lib/useFetch';
import { useQueueWatch } from '../../lib/socket';
import { api } from '../../lib/api';
import { formatDateLong, formatTime, nowTimeIST, relativeDay } from '../../lib/format';

function DelayModal({ current, onClose, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const set = async (minutes) => {
    setBusy(minutes);
    try {
      const r = await api.put('/doctor/delay', { minutes });
      toast.success(minutes ? `Patients notified that you're running ${minutes} min late` : 'Delay cleared. Patients notified.');
      onDone(r.delayMinutes);
      onClose();
    } catch (e) {
      toast.error(e.message);
      setBusy(null);
    }
  };
  return (
    <Modal open onClose={onClose} title="Running late?" size="sm">
      <p className="text-sm text-ink-muted mb-4">Patients with appointments later today get an app alert and SMS with the expected delay, so they don't wait at the clinic.</p>
      <div className="grid grid-cols-3 gap-2">
        {[15, 30, 45, 60, 90].map((m) => (
          <Button key={m} variant={current === m ? 'primary' : 'secondary'} loading={busy === m} onClick={() => set(m)}>
            {m} min
          </Button>
        ))}
      </div>
      {current > 0 && (
        <Button variant="ghost" className="w-full mt-3" loading={busy === 0} onClick={() => set(0)}>
          I'm back on schedule
        </Button>
      )}
    </Modal>
  );
}

function QueuePanel({ queue, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const callNext = async () => {
    setBusy(true);
    try {
      const r = await api.post('/doctor/queue/next');
      toast.success(r.called ? `Calling token ${r.called}` : 'No one is waiting in the queue');
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Clinic queue</p>
        <a href="/display" target="_blank" rel="noreferrer" className="text-xs text-brand-600 font-medium inline-flex items-center gap-1 hover:underline">
          <MonitorPlay className="h-3.5 w-3.5" /> TV screen
        </a>
      </div>
      <div className="flex items-end justify-between mt-3">
        <div>
          <p className="text-sm text-ink-muted">Now serving</p>
          <p className="text-4xl font-bold text-brand-700 tabular-nums leading-tight">{queue.nowServing ?? '–'}</p>
          {queue.servingPatient && <p className="text-sm text-ink-soft">{queue.servingPatient}</p>}
        </div>
        <div className="text-right">
          <p className="text-sm text-ink-muted">Waiting</p>
          <p className="text-2xl font-semibold tabular-nums">{queue.waiting.length}</p>
        </div>
      </div>
      {queue.waiting.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {queue.waiting.map((w) => (
            <span key={w.id} title={`${w.patientName} · ${formatTime(w.time)}`} className="h-8 min-w-8 px-2 rounded-md bg-canvas border border-line text-sm font-medium flex items-center justify-center tabular-nums">
              {w.token}
            </span>
          ))}
        </div>
      )}
      <Button className="w-full mt-4" onClick={callNext} loading={busy} disabled={!queue.waiting.length && !queue.nowServing}>
        {queue.nowServing ? 'Finish & call next patient' : 'Call next patient'}
      </Button>
      <p className="text-xs text-ink-muted mt-2">Patients get a token when they check in at reception or in the app.</p>
    </Card>
  );
}

export default function DoctorDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useFetch('/doctor/dashboard');
  const [blocking, setBlocking] = useState(null);
  const [delayOpen, setDelayOpen] = useState(false);
  useQueueWatch(user.doctorId, reload);

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { stats, todays, next, queue } = data;
  const current = todays.find((a) => a.status === 'IN_PROGRESS') || todays.find((a) => a.status === 'SCHEDULED' && a.paymentStatus !== 'PENDING');
  const now = nowTimeIST();

  const checkIn = async (a) => {
    try {
      const r = await api.post(`/doctor/appointments/${a.id}/check-in`);
      toast.success(`${a.patientName} checked in with token ${r.token}`);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-[22px] sm:text-2xl">Welcome, {user.name}</h1>
          <p className="text-ink-muted mt-1">Here's your schedule for {formatDateLong(data.today)}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setDelayOpen(true)}>
            <Megaphone className="h-4 w-4" /> {data.delayMinutes ? `Running ${data.delayMinutes} min late` : 'Running late'}
          </Button>
          <Button variant="danger" onClick={() => setBlocking('today')}>
            <AlertTriangle className="h-4 w-4" /> Emergency / unavailable
          </Button>
        </div>
      </div>

      {data.delayMinutes > 0 && (
        <Alert tone="warn" className="mb-6">
          Patients have been told you're running about {data.delayMinutes} minutes late today.{' '}
          <button onClick={() => setDelayOpen(true)} className="underline font-medium">
            Update
          </button>
        </Alert>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Today's appointments" value={stats.today} icon={CalendarDays} />
        <StatCard label="Completed" value={stats.completed} icon={CalendarCheck} />
        <StatCard label="Pending" value={stats.pending} icon={Clock} />
        <StatCard label="Next 7 days" value={stats.thisWeek} hint={`${stats.totalPatients} patients seen in total`} icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Today's appointments" action={<Link to="/doctor/appointments" className="text-sm text-brand-600 font-medium hover:underline">All appointments</Link>} />
          {todays.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No appointments today" text="Enjoy the quieter day. New bookings will show up here." />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {todays.map((a) => {
                const canCheckIn = a.mode === 'CLINIC' && a.status === 'SCHEDULED' && !a.tokenNo && a.paymentStatus !== 'PENDING';
                return (
                  <li key={a.id} className={cx('flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4', current?.id === a.id && 'bg-brand-50/50')}>
                    <div className="sm:w-20 shrink-0">
                      <p className={cx('font-medium tabular-nums text-sm', a.time < now && a.status === 'SCHEDULED' && 'text-ink-muted')}>{formatTime(a.time)}</p>
                      {a.tokenNo && <p className="text-xs text-ink-muted">Token {a.tokenNo}</p>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/doctor/appointments/${a.id}`} className="font-medium hover:text-brand-700">
                          {a.patientName}
                        </Link>
                        {a.mode === 'VIDEO' && (
                          <Badge tone="blue" className="gap-1">
                            <Video className="h-3 w-3" /> Video
                          </Badge>
                        )}
                        {a.paymentStatus === 'PENDING' && <Badge tone="amber">Awaiting payment</Badge>}
                      </div>
                      <p className="text-sm text-ink-muted truncate">
                        {[a.patientAge && `${a.patientAge} yrs`, a.patientGender, a.reason].filter(Boolean).join(' · ') || 'General consultation'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <DoctorStatusSelect appt={a} onChanged={reload} />
                      {canCheckIn && (
                        <Button size="sm" variant="secondary" onClick={() => checkIn(a)}>
                          Check in
                        </Button>
                      )}
                      {a.mode === 'VIDEO' && ['SCHEDULED', 'IN_PROGRESS'].includes(a.status) && a.paymentStatus !== 'PENDING' ? (
                        <Button size="sm" to={`/visit/${a.id}`}>
                          <Video className="h-4 w-4" /> Start call
                        </Button>
                      ) : (
                        <Button size="sm" variant={a.status === 'IN_PROGRESS' ? 'primary' : 'secondary'} to={`/doctor/appointments/${a.id}`}>
                          {a.hasNotes ? 'View notes' : a.status === 'COMPLETED' ? 'Open' : 'Consult'}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <QueuePanel queue={queue} onChanged={reload} />
          {current && (
            <Card className="p-5 border-brand-200">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{current.status === 'IN_PROGRESS' ? 'In consultation' : 'Next patient'}</p>
              <p className="font-semibold text-lg mt-2">{current.patientName}</p>
              <p className="text-sm text-ink-muted">
                {formatTime(current.time)} · {current.mode === 'VIDEO' ? 'Video consultation' : current.reason || 'General consultation'}
              </p>
              <Button to={current.mode === 'VIDEO' ? `/visit/${current.id}` : `/doctor/appointments/${current.id}`} className="w-full mt-4">
                {current.mode === 'VIDEO' ? 'Start video call' : current.status === 'IN_PROGRESS' ? 'Continue consultation' : 'Start consultation'}
              </Button>
            </Card>
          )}
          <Card>
            <CardHeader title="Coming up" />
            {next.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-ink-muted">No upcoming bookings after today.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {next.map((a) => (
                  <li key={a.id}>
                    <Link to={`/doctor/appointments/${a.id}`} className="flex justify-between gap-3 px-5 py-3 hover:bg-canvas/60">
                      <span className="text-sm font-medium flex items-center gap-1.5">
                        {a.patientName} {a.mode === 'VIDEO' && <Video className="h-3.5 w-3.5 text-brand-600" />}
                      </span>
                      <span className="text-sm text-ink-muted shrink-0">
                        {relativeDay(a.date)}, {formatTime(a.time)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="px-5 py-3 border-t border-line">
              <button onClick={() => setBlocking('plan')} className="text-sm text-brand-600 font-medium hover:underline">
                Plan time off or personal work
              </button>
            </div>
          </Card>
        </div>
      </div>

      {blocking && <UnavailableModal basePath="/doctor" preset={blocking === 'today' ? 'today' : undefined} onClose={() => setBlocking(null)} onDone={reload} />}
      {delayOpen && <DelayModal current={data.delayMinutes} onClose={() => setDelayOpen(false)} onDone={(m) => setData((d) => ({ ...d, delayMinutes: m }))} />}
    </>
  );
}
