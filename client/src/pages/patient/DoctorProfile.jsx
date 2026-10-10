import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Video } from 'lucide-react';
import { Avatar, Badge, Button, Card, ErrorState, PageLoader, RatingInline, Stars, Tabs } from '../../components/ui';
import { useFetch } from '../../lib/useFetch';
import { DAYS, formatDate, formatTime, rupees } from '../../lib/format';

export function BackLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink mb-4 no-print">
      <ChevronLeft className="h-4 w-4" /> {children}
    </Link>
  );
}

export default function DoctorProfile() {
  const { id } = useParams();
  const { data: d, loading, error, reload } = useFetch(`/doctors/${id}`);
  const [tab, setTab] = useState('about');
  const { data: rv } = useFetch(`/doctors/${id}/reviews`);

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const byDay = [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day, ranges: d.availability.filter((a) => a.dayOfWeek === day) }));

  return (
    <>
      <BackLink to="/patient/doctors">All doctors</BackLink>
      <Card className="p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row gap-5 sm:items-start">
          <Avatar name={d.name} src={d.photoUrl} size="xl" />
          <div className="flex-1">
            <h1 className="text-2xl">{d.name}</h1>
            <p className="text-brand-700 font-medium">{d.specialization}</p>
            <p className="text-ink-muted mt-1">{d.qualification}</p>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <button onClick={() => setTab('reviews')} className="hover:opacity-80">
                <RatingInline rating={d.rating} count={d.reviewCount} />
              </button>
              {d.videoEnabled && (
                <Badge tone="blue" className="gap-1">
                  <Video className="h-3 w-3" /> Video consults available
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3 mt-5">
              {[
                ['Experience', `${d.experience} years`],
                ['Consultation fee', rupees(d.fee)],
                ['Consultations', `${d.consultations}+`],
                ['Slot length', `${d.slotDuration} min`],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-ink-muted">{k}</p>
                  <p className="font-semibold">{v}</p>
                </div>
              ))}
            </div>
          </div>
          <Button to={`/patient/doctors/${d.id}/book`} size="lg" className="w-full sm:w-auto">
            Book appointment
          </Button>
        </div>
      </Card>

      <Card className="mt-6">
        <Tabs
          className="px-3 sm:px-5 pt-2"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'about', label: 'About' },
            { value: 'hours', label: 'Consultation hours' },
            { value: 'reviews', label: 'Reviews', count: d.reviewCount },
          ]}
        />
        <div className="p-5 sm:p-7">
          {tab === 'reviews' ? (
            <ReviewList d={d} rv={rv} />
          ) : tab === 'about' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <h3 className="text-base mb-2">About</h3>
                <p className="text-ink-soft leading-relaxed">{d.bio || 'No description added yet.'}</p>
              </div>
              <div className="space-y-5 text-sm">
                <div>
                  <p className="text-ink-muted">Qualification</p>
                  <p className="font-medium mt-0.5">{d.qualification}</p>
                </div>
                {d.languages && (
                  <div>
                    <p className="text-ink-muted">Languages</p>
                    <p className="font-medium mt-0.5">{d.languages}</p>
                  </div>
                )}
                <div>
                  <p className="text-ink-muted">Clinic</p>
                  <p className="font-medium mt-0.5">CareSync Clinic, 24 Anna Salai, Puducherry</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-lg">
              <div className="divide-y divide-line">
                {byDay.map(({ day, ranges }) => (
                  <div key={day} className="flex justify-between py-3 text-sm">
                    <span className="font-medium">{DAYS[day]}</span>
                    <span className={ranges.length ? 'text-ink-soft text-right' : 'text-ink-muted'}>
                      {ranges.length ? ranges.map((r) => `${formatTime(r.startTime)} – ${formatTime(r.endTime)}`).join(', ') : 'Not available'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-ink-muted mt-4">Leave days are not shown here. You'll only see open slots when booking.</p>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

function ReviewList({ d, rv }) {
  if (!rv) return <p className="text-sm text-ink-muted">Loading reviews…</p>;
  if (!rv.reviews.length) return <p className="text-sm text-ink-muted">No reviews yet. Patients can rate the doctor after a completed visit.</p>;
  const total = rv.breakdown.reduce((s, b) => s + b.count, 0);
  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-8">
      <div>
        <p className="text-4xl font-semibold">{d.rating.toFixed(1)}</p>
        <Stars value={d.rating} size="md" className="mt-1" />
        <p className="text-sm text-ink-muted mt-1">{total} verified {total === 1 ? 'review' : 'reviews'}</p>
        <div className="mt-4 space-y-1.5">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = rv.breakdown.find((b) => b.rating === n)?.count || 0;
            return (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-ink-muted">{n}</span>
                <div className="flex-1 h-1.5 rounded-full bg-canvas overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(c / total) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-ink-muted tabular-nums">{c}</span>
              </div>
            );
          })}
        </div>
      </div>
      <ul className="divide-y divide-line">
        {rv.reviews.map((r) => (
          <li key={r.id} className="py-4 first:pt-0">
            <div className="flex items-center justify-between gap-3">
              <Stars value={r.rating} size="xs" />
              <span className="text-xs text-ink-muted">{formatDate(String(r.createdAt).slice(0, 10))}</span>
            </div>
            {r.comment && <p className="text-sm text-ink-soft mt-1.5">{r.comment}</p>}
            <p className="text-xs text-ink-muted mt-1.5">
              {r.patientFirst} {r.patientInitial && `${r.patientInitial}.`} · Verified patient
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
