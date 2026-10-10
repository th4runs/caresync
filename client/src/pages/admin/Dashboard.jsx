import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays, IndianRupee, Stethoscope, Users } from 'lucide-react';
import { Badge, Card, CardHeader, EmptyState, ErrorState, PageHeader, PageLoader, StatCard, Stars, StatusBadge, TableCard } from '../../components/ui';
import { useFetch } from '../../lib/useFetch';
import { KIND, STATUS, formatDay, formatDayNum, formatTime, relativeDay, rupees } from '../../lib/format';

function DailyChart({ days, today }) {
  const max = Math.max(...days.map((d) => d.count), 1);
  return (
    <div className="px-5 pb-5">
      <div className="flex items-end gap-2 sm:gap-4 h-48 border-b border-line">
        {days.map((d) => (
          <div key={d.date} className="flex-1 h-full flex flex-col justify-end items-center gap-1.5 group">
            <span className="text-xs font-medium tabular-nums text-ink-soft">{d.count}</span>
            <div
              className={`w-full max-w-[44px] rounded-t-md transition-colors ${d.date === today ? 'bg-brand-600' : 'bg-brand-200 group-hover:bg-brand-300'}`}
              style={{ height: `${Math.max((d.count / max) * 100, d.count ? 4 : 1)}%` }}
              title={`${d.count} appointments`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 sm:gap-4 mt-2">
        {days.map((d) => (
          <div key={d.date} className="flex-1 text-center text-xs text-ink-muted leading-tight">
            <span className={d.date === today ? 'text-brand-700 font-medium' : ''}>{d.date === today ? 'Today' : formatDay(d.date)}</span>
            <span className="block">{formatDayNum(d.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarList({ items }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="px-5 pb-5 space-y-3">
      {items.map((i) => (
        <li key={i.name}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-ink-soft">{i.name}</span>
            <span className="font-medium tabular-nums">{i.count}</span>
          </div>
          <div className="h-2 rounded-full bg-canvas overflow-hidden">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${(i.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AdminDashboard() {
  const { data, loading, error, reload } = useFetch('/admin/stats');
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { totals: t } = data;
  const statusTotal = data.byStatus.reduce((s, x) => s + x.count, 0) || 1;
  const cancelRate = t.last30 ? Math.round((t.last30Cancelled / t.last30) * 100) : 0;

  return (
    <>
      <PageHeader title="Clinic overview" subtitle="Key numbers for the last 30 days and today's activity." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Total patients" value={t.patients} hint={`${t.newPatients30} joined this month`} icon={Users} />
        <StatCard label="Active doctors" value={t.doctors} hint={`${t.specializations} specialities`} icon={Stethoscope} />
        <StatCard label="Today's appointments" value={t.today} hint={`${t.todayCompleted} completed · ${t.upcoming} upcoming later`} icon={CalendarDays} />
        <StatCard label="Revenue (30 days)" value={rupees(t.revenue30)} hint={`${rupees(t.online30)} collected online · ${t.video30} video visits`} icon={IndianRupee} />
      </div>

      {(t.needsRebook > 0 || data.disruptions.length > 0 || data.delays.length > 0 || t.waitlisted > 0) && (
        <Card className="mb-6 border-amber-200">
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-sm font-medium text-amber-800 rounded-t-xl">
            <AlertTriangle className="h-4 w-4" /> Needs attention
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">
            <div className="p-5">
              <p className="text-sm text-ink-muted">Patients still to rebook</p>
              <p className="text-2xl font-semibold mt-1">{t.needsRebook}</p>
              {t.needsRebook > 0 && (
                <Link to="/admin/appointments?needsRebook=1" className="text-sm text-brand-600 font-medium hover:underline">
                  View and call them
                </Link>
              )}
              {t.waitlisted > 0 && <p className="text-sm text-ink-muted mt-2">{t.waitlisted} on waitlists for full days</p>}
            </div>
            <div className="p-5 md:col-span-2">
              <p className="text-sm text-ink-muted mb-2">Doctor unavailability & delays</p>
              {data.disruptions.length === 0 && data.delays.length === 0 ? (
                <p className="text-sm text-ink-soft">None upcoming.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.delays.map((d) => (
                    <li key={d.doctorName} className="flex flex-wrap items-center gap-2">
                      <Badge tone="amber">Running late</Badge>
                      <span className="font-medium">{d.doctorName}</span>
                      <span className="text-ink-muted">about {d.delayMinutes} min today</span>
                    </li>
                  ))}
                  {data.disruptions.map((d, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2">
                      <Badge tone={KIND[d.kind].tone}>{KIND[d.kind].label}</Badge>
                      <span className="font-medium">{d.doctorName}</span>
                      <span className="text-ink-muted">
                        {relativeDay(d.date)}, {d.startTime ? `${formatTime(d.startTime)} – ${d.endTime === '23:59' ? 'end of day' : formatTime(d.endTime)}` : 'whole day'}
                        {d.reason && ` · ${d.reason}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Appointments this week" subtitle="Booked visits per day, excluding cancellations" />
          <DailyChart days={data.days} today={data.today} />
        </Card>
        <Card>
          <CardHeader title="Last 30 days" subtitle={`${t.last30} appointments · ${cancelRate}% cancelled`} />
          <div className="px-5 pb-5">
            <div className="flex h-3 rounded-full overflow-hidden bg-canvas">
              {['COMPLETED', 'SCHEDULED', 'IN_PROGRESS', 'NO_SHOW', 'CANCELLED'].map((s) => {
                const c = data.byStatus.find((x) => x.status === s)?.count || 0;
                const color = { COMPLETED: 'bg-emerald-500', SCHEDULED: 'bg-brand-500', IN_PROGRESS: 'bg-amber-400', NO_SHOW: 'bg-red-400', CANCELLED: 'bg-slate-300' }[s];
                return c ? <div key={s} className={color} style={{ width: `${(c / statusTotal) * 100}%` }} /> : null;
              })}
            </div>
            <ul className="mt-4 space-y-2.5 text-sm">
              {['COMPLETED', 'SCHEDULED', 'IN_PROGRESS', 'NO_SHOW', 'CANCELLED'].map((s) => {
                const c = data.byStatus.find((x) => x.status === s)?.count || 0;
                const color = { COMPLETED: 'bg-emerald-500', SCHEDULED: 'bg-brand-500', IN_PROGRESS: 'bg-amber-400', NO_SHOW: 'bg-red-400', CANCELLED: 'bg-slate-300' }[s];
                return (
                  <li key={s} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-ink-soft">
                      <span className={`h-2.5 w-2.5 rounded-full ${color}`} /> {STATUS[s].label}
                    </span>
                    <span className="font-medium tabular-nums">{c}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader title="By speciality" subtitle="Appointments in the last 30 days" />
          <BarList items={data.bySpecialization} />
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Most consulted doctors" subtitle="Completed visits in the last 30 days" action={<Link to="/admin/doctors" className="text-sm text-brand-600 font-medium hover:underline">Manage doctors</Link>} />
          <ul className="divide-y divide-line border-t border-line">
            {data.topDoctors.map((d, i) => (
              <li key={d.name} className="flex items-center gap-4 px-5 py-3">
                <span className="w-5 text-sm text-ink-muted tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{d.name}</p>
                  <p className="text-xs text-ink-muted">{d.specialization}</p>
                </div>
                {d.rating && (
                  <span className="hidden sm:flex items-center gap-1 text-sm">
                    <Stars value={d.rating} size="xs" /> {d.rating.toFixed(1)}
                  </span>
                )}
                <span className="text-sm font-medium tabular-nums w-20 text-right">{d.count} visits</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg">Today's appointments</h2>
        <Link to="/admin/appointments" className="text-sm text-brand-600 font-medium hover:underline">
          View all
        </Link>
      </div>
      {data.todays.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarDays} title="No appointments today" />
        </Card>
      ) : (
        <TableCard>
          <table className="table-base">
            <thead>
              <tr>
                <th>Time</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.todays.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap font-medium">{formatTime(a.time)}</td>
                  <td>{a.patientName}</td>
                  <td>
                    <p>{a.doctorName}</p>
                    <p className="text-xs text-ink-muted">{a.specialization}</p>
                  </td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}

      <Card className="mt-6 p-5">
        <p className="font-medium">Integrations</p>
        <div className="grid sm:grid-cols-3 gap-4 mt-3 text-sm">
          {[
            ['Email', data.providers.email ? 'Sending via SMTP' : 'Not configured (messages are logged)', data.providers.email],
            ['SMS', data.providers.sms ? 'Sending via Twilio' : 'Not configured (messages are logged)', data.providers.sms],
            ['Payments', data.providers.payments === 'RAZORPAY' ? 'Razorpay connected' : 'Demo gateway (no real money)', data.providers.payments === 'RAZORPAY'],
          ].map(([k, v, live]) => (
            <div key={k} className="flex items-start gap-2.5">
              <span className={`mt-1.5 h-2 w-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              <span>
                <span className="block font-medium">{k}</span>
                <span className="block text-ink-muted">{v}</span>
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-muted mt-3">
          Add keys in <code className="bg-canvas px-1 rounded">server/.env</code> to go live. See <Link to="/admin/messages" className="underline">Email & SMS log</Link>.
        </p>
      </Card>
    </>
  );
}
