import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Hospital, Video } from 'lucide-react';
import { Alert, Avatar, Button, Card, ErrorState, Field, PageLoader, RadioCard, RatingInline, Textarea, cx } from '../../components/ui';
import SlotPicker from '../../components/SlotPicker';
import PaymentModal from '../../components/PaymentModal';
import { BackLink } from './DoctorProfile';
import { useFetch } from '../../lib/useFetch';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { bookingId, formatDateLong, formatTime, rupees, todayISO } from '../../lib/format';

export default function BookAppointment() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const toast = useToast();
  const rebookOf = params.get('rebook');
  const { data: d, loading, error, reload } = useFetch(`/doctors/${id}`);
  const [pick, setPick] = useState({ date: params.get('date') || todayISO(), time: params.get('time') || '' });
  const [mode, setMode] = useState(params.get('mode') === 'VIDEO' ? 'VIDEO' : 'CLINIC');
  const [payOnline, setPayOnline] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [pending, setPending] = useState(null); // { appointment, payment } waiting for payment
  const [booked, setBooked] = useState(null);

  // Open on the first day with free slots unless a date was passed in the link
  useEffect(() => {
    if (params.get('date')) return;
    api.get(`/doctors/${id}/next-available`).then((r) => r.date && setPick({ date: r.date, time: '' })).catch(() => {});
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const online = mode === 'VIDEO' || payOnline;

  const confirm = async () => {
    setErr('');
    setSaving(true);
    try {
      const r = await api.post('/patient/appointments', { doctorId: d.id, date: pick.date, time: pick.time, reason, mode, payOnline: online, rebookOf });
      if (r.payment) setPending(r);
      else setBooked({ ...r.appointment, paymentStatus: 'PAY_AT_CLINIC' });
    } catch (e) {
      setErr(e.message);
      toast.error(e.message);
      setPick((p) => ({ ...p, time: '' }));
    } finally {
      setSaving(false);
    }
  };

  if (booked) {
    return (
      <Card className="max-w-lg mx-auto p-6 sm:p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" strokeWidth={1.6} />
        <h1 className="text-2xl mt-4">{booked.mode === 'VIDEO' ? 'Video consultation booked' : 'Appointment confirmed'}</h1>
        <p className="text-ink-muted mt-1">A confirmation has been sent by email and SMS.</p>
        <dl className="mt-6 text-left rounded-lg border border-line divide-y divide-line text-sm">
          {[
            ['Doctor', booked.doctorName],
            ['Type', booked.mode === 'VIDEO' ? 'Video consultation' : 'In-clinic visit'],
            ['Date', formatDateLong(booked.date)],
            ['Time', formatTime(booked.time)],
            ['Fee', `${rupees(booked.fee)} · ${booked.paymentStatus === 'PAID' ? 'Paid online' : 'Pay at clinic'}`],
            ['Booking ID', bookingId(booked.id)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="font-medium text-right">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-ink-muted mt-4">
          {booked.mode === 'VIDEO'
            ? 'On the day, open this appointment and tap "Join video call" up to 15 minutes before your slot.'
            : 'On the day, tap "I\'ve arrived" in the app to get your queue token. Please arrive 10 minutes early.'}
        </p>
        <div className="grid sm:grid-cols-2 gap-2 mt-6">
          <Button to="/patient" variant="secondary">
            Back to dashboard
          </Button>
          <Button to={`/patient/appointments/${booked.id}`}>View appointment</Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <BackLink to={`/patient/doctors/${d.id}`}>Doctor profile</BackLink>
      <h1 className="text-[22px] sm:text-2xl mb-2">{rebookOf ? 'Choose a new time' : 'Book an appointment'}</h1>
      {rebookOf ? (
        <Alert tone="info" className="mb-6">
          You're rebooking an appointment that the doctor couldn't attend. Pick any free time below, or{' '}
          <Link to={`/patient/doctors?search=${encodeURIComponent(d.specialization)}`} className="underline">
            choose another {d.specialization} doctor
          </Link>
          .
        </Alert>
      ) : (
        <div className="mb-6" />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="space-y-6">
          {d.videoEnabled && (
            <Card className="p-5 sm:p-6">
              <h2 className="text-base mb-4">Type of visit</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  ['CLINIC', 'Visit the clinic', 'Meet the doctor in person', Hospital],
                  ['VIDEO', 'Video consultation', 'Talk from home on your phone or laptop', Video],
                ].map(([k, title, text, Icon]) => (
                  <button key={k} type="button" onClick={() => setMode(k)} className={cx('text-left rounded-lg border p-4 flex gap-3 transition-colors', mode === k ? 'border-brand-500 bg-brand-50/60' : 'border-line hover:border-slate-300')}>
                    <Icon className={cx('h-5 w-5 mt-0.5', mode === k ? 'text-brand-600' : 'text-ink-muted')} />
                    <span>
                      <span className="block font-medium">{title}</span>
                      <span className="block text-sm text-ink-muted">{text}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          )}
          <Card className="p-5 sm:p-6">
            <h2 className="text-base mb-4">Choose a date and time</h2>
            <SlotPicker doctorId={d.id} availability={d.availability} value={pick} onChange={setPick} allowWaitlist />
            <Field label="Reason for visit" hint="Optional. Helps the doctor prepare." className="mt-8">
              <Textarea rows={3} maxLength={300} placeholder="e.g. Fever for 3 days, follow-up for blood test" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </Card>
        </div>

        <Card className="p-5 sm:p-6 lg:sticky lg:top-24">
          <div className="flex items-center gap-3">
            <Avatar name={d.name} src={d.photoUrl} />
            <div>
              <p className="font-semibold">{d.name}</p>
              <p className="text-sm text-ink-muted">{d.specialization}</p>
              <RatingInline rating={d.rating} count={d.reviewCount} />
            </div>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Type</dt>
              <dd className="font-medium">{mode === 'VIDEO' ? 'Video consultation' : 'In-clinic visit'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Date</dt>
              <dd className="font-medium text-right">{pick.date ? formatDateLong(pick.date) : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Time</dt>
              <dd className="font-medium">{pick.time ? formatTime(pick.time) : 'Select a slot'}</dd>
            </div>
            <div className="flex justify-between pt-3 border-t border-line">
              <dt className="text-ink-muted">Consultation fee</dt>
              <dd className="font-semibold">{rupees(d.fee)}</dd>
            </div>
          </dl>

          <div className="mt-4 space-y-2">
            {mode === 'VIDEO' ? (
              <p className="text-xs text-ink-muted">Video consultations are paid online when booking (UPI, cards, net banking).</p>
            ) : (
              <>
                <RadioCard checked={!payOnline} onChange={() => setPayOnline(false)} title="Pay at the clinic" text="Cash, card or UPI at reception" />
                <RadioCard checked={payOnline} onChange={() => setPayOnline(true)} title="Pay online now" text="UPI, cards or net banking" />
              </>
            )}
          </div>
          {online && <p className="text-xs text-ink-muted mt-2">Full refund if you cancel at least 2 hours before, or if the doctor cancels.</p>}
          <Alert className="mt-4">{err}</Alert>
          <Button className="w-full mt-5" disabled={!pick.time} loading={saving} onClick={confirm}>
            {online ? `Continue to pay ${rupees(d.fee)}` : 'Confirm booking'}
          </Button>
        </Card>
      </div>

      {/* Mobile: keep the confirm action within reach once a slot is picked */}
      {pick.time && (
        <div className="lg:hidden fixed inset-x-0 bottom-[64px] z-20 bg-white border-t border-line px-4 py-3 flex items-center justify-between gap-3 shadow-pop">
          <div className="text-sm">
            <p className="font-medium">{formatTime(pick.time)}</p>
            <p className="text-ink-muted">{formatDateLong(pick.date)}</p>
          </div>
          <Button onClick={confirm} loading={saving}>
            {online ? `Pay ${rupees(d.fee)}` : 'Confirm'}
          </Button>
        </div>
      )}

      {pending && (
        <PaymentModal
          payment={pending.payment}
          appointment={pending.appointment}
          onClose={() => {
            toast.error('Payment not completed. Your slot is held for 15 minutes. You can pay from My Appointments.');
            setPending(null);
            setPick((p) => ({ ...p, time: '' }));
          }}
          onSuccess={() => {
            setBooked({ ...pending.appointment, paymentStatus: 'PAID' });
            setPending(null);
          }}
        />
      )}
    </>
  );
}
