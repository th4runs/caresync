import { Link } from 'react-router-dom';
import { CalendarDays, FileText, Search, User } from 'lucide-react';
import { Button, Card, CardHeader, EmptyState, ErrorState, PageLoader, Stars } from '../../components/ui';
import AppointmentRow from '../../components/AppointmentRow';
import RebookCard from '../../components/RebookCard';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../lib/useFetch';
import { formatDate } from '../../lib/format';

const ACTIONS = [
  { to: '/patient/doctors', title: 'Find a doctor', text: 'Book a new appointment', icon: Search },
  { to: '/patient/appointments', title: 'My appointments', text: 'View or reschedule visits', icon: CalendarDays },
  { to: '/patient/history', title: 'Medical history', text: 'Prescriptions and notes', icon: FileText },
  { to: '/patient/profile', title: 'Profile', text: 'Update your details', icon: User },
];

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function PatientDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch('/patient/dashboard');

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[22px] sm:text-2xl">
          {greeting()}, {user.name.split(' ')[0]}
        </h1>
        <p className="text-ink-muted mt-1">Here's an overview of your appointments.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {ACTIONS.map(({ to, title, text, icon: Icon }) => (
          <Link key={to} to={to} className="card p-4 sm:p-5 hover:border-brand-300 transition-colors group">
            <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <Icon className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <p className="font-semibold mt-3 group-hover:text-brand-700">{title}</p>
            <p className="text-sm text-ink-muted mt-0.5">{text}</p>
          </Link>
        ))}
      </div>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {data.actionNeeded.map((a) => (
              <RebookCard key={a.id} appt={a} onDismissed={reload} />
            ))}
            {data.toReview.map((a) => (
              <Card key={a.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <p className="font-semibold">How was your visit with {a.doctorName}?</p>
                  <p className="text-sm text-ink-muted">A quick rating helps other patients and the clinic.</p>
                </div>
                <Link to={`/patient/appointments/${a.id}#review`} className="flex items-center gap-3">
                  <Stars value={0} size="lg" />
                  <span className="text-sm text-brand-600 font-medium">Rate</span>
                </Link>
              </Card>
            ))}
            <Card>
              <CardHeader title="Upcoming appointments" action={<Link to="/patient/appointments" className="text-sm text-brand-600 font-medium hover:underline">View all</Link>} />
              {data.upcoming.length ? (
                <div className="divide-y divide-line border-t border-line">
                  {data.upcoming.map((a) => (
                    <AppointmentRow key={a.id} appt={a} to={`/patient/appointments/${a.id}`} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={CalendarDays} title="No upcoming appointments" text="Find a doctor and book a slot that suits you." action={<Button to="/patient/doctors" size="sm">Book an appointment</Button>} />
              )}
            </Card>

            <Card>
              <CardHeader title="Recent visits" action={<Link to="/patient/history" className="text-sm text-brand-600 font-medium hover:underline">Medical history</Link>} />
              {data.recentVisits.length ? (
                <div className="divide-y divide-line border-t border-line">
                  {data.recentVisits.map((a) => (
                    <Link key={a.id} to={`/patient/appointments/${a.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-canvas/60">
                      <div>
                        <p className="font-medium">{a.doctorName}</p>
                        <p className="text-sm text-ink-muted">
                          {a.specialization} · {formatDate(a.date)}
                        </p>
                      </div>
                      <span className="text-sm text-brand-600 font-medium shrink-0">{a.hasNotes ? 'View prescription' : 'View visit'}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="px-5 pb-5 text-sm text-ink-muted">Your completed visits will appear here.</p>
              )}
            </Card>
          </div>

          <Card className="h-fit">
            <CardHeader title="Your summary" />
            <dl className="px-5 pb-5 divide-y divide-line">
              {[
                ['Total appointments', data.stats.total],
                ['Upcoming', data.stats.upcoming],
                ['Completed', data.stats.completed],
                ['Cancelled', data.stats.cancelled],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-3 text-sm">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      )}
    </>
  );
}
