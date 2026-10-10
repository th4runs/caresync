import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapPin, Printer, Video } from 'lucide-react';
import { Avatar, Badge, Button, Card, ConfirmDialog, ErrorState, PageLoader, StatusBadge } from '../../components/ui';
import Prescription from '../../components/Prescription';
import RescheduleModal from '../../components/RescheduleModal';
import PaymentModal from '../../components/PaymentModal';
import QueueCard from '../../components/QueueCard';
import ReviewForm from '../../components/ReviewForm';
import RebookCard, { DelayNotice, TransferNotice } from '../../components/RebookCard';
import { BackLink } from './DoctorProfile';
import { useFetch } from '../../lib/useFetch';
import { api } from '../../lib/api';
import { PAYMENT, bookingId, formatDate, formatDateLong, formatTime, rupees } from '../../lib/format';
import { useToast } from '../../context/ToastContext';

function PaymentCard({ a, onPay }) {
  const p = PAYMENT[a.paymentStatus];
  const last = a.payments.filter((x) => x.status !== 'CREATED' && x.status !== 'FAILED').at(-1);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">Payment</p>
        <Badge tone={p.tone}>{p.label}</Badge>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-muted">Consultation fee</dt>
          <dd className="font-medium">{rupees(a.fee)}</dd>
        </div>
        {last?.paymentId && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Transaction ID</dt>
            <dd className="font-mono text-xs truncate">{last.paymentId}</dd>
          </div>
        )}
        {a.paymentStatus === 'REFUNDED' && <p className="text-ink-soft">The refund has been issued. It usually reaches your account in 5–7 working days.</p>}
        {a.paymentStatus === 'PAY_AT_CLINIC' && a.status === 'SCHEDULED' && <p className="text-ink-muted">Pay at the reception by cash, card or UPI.</p>}
      </dl>
      {a.paymentStatus === 'PENDING' && a.status === 'SCHEDULED' && (
        <>
          <p className="text-sm text-amber-700 mt-3">Complete the payment within 15 minutes of booking to keep this slot.</p>
          <Button className="w-full mt-3" onClick={onPay}>
            Pay {rupees(a.fee)} now
          </Button>
        </>
      )}
    </Card>
  );
}

export default function AppointmentDetail() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: a, loading, error, reload } = useFetch(`/patient/appointments/${id}`);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resched, setResched] = useState(false);
  const [paying, setPaying] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (a && window.location.hash === '#review') document.getElementById('review')?.scrollIntoView({ behavior: 'smooth' });
  }, [a]);

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const cancel = async () => {
    setBusy(true);
    try {
      const r = await api.patch(`/patient/appointments/${a.id}/cancel`);
      toast.success(r.message);
      navigate('/patient/appointments');
    } catch (e) {
      toast.error(e.message);
      setBusy(false);
    }
  };

  const doCheckIn = async () => {
    setChecking(true);
    try {
      const r = await api.post(`/patient/appointments/${a.id}/check-in`);
      toast.success(r.message);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setChecking(false);
    }
  };

  const startPayment = async () => {
    try {
      setPaying(await api.post(`/patient/appointments/${a.id}/pay`));
    } catch (e) {
      toast.error(e.message);
      reload();
    }
  };

  const isUpcoming = ['SCHEDULED', 'IN_PROGRESS'].includes(a.status);

  return (
    <>
      <BackLink to="/patient/appointments">My appointments</BackLink>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[22px] sm:text-2xl mr-1">Appointment details</h1>
          <StatusBadge status={a.status} />
          {a.mode === 'VIDEO' && (
            <Badge tone="blue" className="gap-1">
              <Video className="h-3 w-3" /> Video
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {a.canChange && a.paymentStatus !== 'PENDING' && (
            <>
              <Button variant="secondary" onClick={() => setResched(true)}>
                Reschedule
              </Button>
              <Button variant="danger" onClick={() => setConfirm(true)}>
                Cancel
              </Button>
            </>
          )}
          {a.note && (
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Download / Print
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <div className="space-y-6">
          {a.needsRebook && <RebookCard appt={a} onDismissed={reload} />}
          <TransferNotice appt={a} />
          {isUpcoming && <DelayNotice minutes={a.doctorDelay} doctorName={a.doctorName} />}

          {/* Video consultation */}
          {a.mode === 'VIDEO' && isUpcoming && (
            <Card className="p-5 sm:p-6 no-print">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <Video className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Video consultation</p>
                  <p className="text-sm text-ink-muted">
                    {a.canJoinVideo
                      ? 'The room is open. Use a quiet place with good internet and allow camera and microphone access.'
                      : a.paymentStatus === 'PENDING'
                        ? 'Complete the payment to confirm your video consultation.'
                        : `The room opens 15 minutes before your slot on ${formatDate(a.date)}.`}
                  </p>
                </div>
                {a.canJoinVideo ? <Button to={`/visit/${a.id}`}>Join video call</Button> : <Button disabled>Join video call</Button>}
              </div>
            </Card>
          )}

          {/* Clinic check-in & queue */}
          {a.mode === 'CLINIC' && a.queue && <QueueCard appt={a} initial={a.queue} />}
          {a.canCheckIn && (
            <Card className="p-5 sm:p-6 no-print">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <MapPin className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">At the clinic?</p>
                  <p className="text-sm text-ink-muted">Check in to get your queue token and see live waiting time.</p>
                </div>
                <Button onClick={doCheckIn} loading={checking}>
                  I've arrived
                </Button>
              </div>
            </Card>
          )}

          {a.note ? (
            <Prescription appt={a} note={a.note} />
          ) : (
            !a.needsRebook && (
              <Card className="p-6 no-print">
                <h2 className="text-base">Prescription</h2>
                <p className="text-sm text-ink-muted mt-1">
                  {a.status === 'COMPLETED'
                    ? 'The doctor has not added notes for this visit.'
                    : a.status === 'CANCELLED'
                      ? 'This appointment was cancelled.'
                      : 'Your prescription and visit notes will appear here after the consultation.'}
                </p>
              </Card>
            )
          )}

          {a.status === 'COMPLETED' && (
            <div id="review" className="no-print scroll-mt-24">
              <ReviewForm appt={a} review={a.review} onDone={reload} />
            </div>
          )}
        </div>

        <div className="space-y-6 no-print">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar name={a.doctorName} src={a.doctorPhoto} />
              <div>
                <p className="font-semibold">{a.doctorName}</p>
                <p className="text-sm text-ink-muted">{a.specialization}</p>
              </div>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              {[
                ['Date', formatDateLong(a.date)],
                ['Time', formatTime(a.time)],
                ['Type', a.mode === 'VIDEO' ? 'Video consultation' : 'In-clinic visit'],
                ['Booking ID', bookingId(a.id)],
                ...(a.tokenNo ? [['Queue token', String(a.tokenNo)]] : []),
                ['Reason', a.reason || '—'],
                ...(a.status === 'CANCELLED' ? [['Cancelled', a.cancelReason || { PATIENT: 'By you', DOCTOR: 'By the doctor', ADMIN: 'By the clinic' }[a.cancelledBy] || '—']] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-ink-muted shrink-0">{k}</dt>
                  <dd className="font-medium text-right">{v}</dd>
                </div>
              ))}
            </dl>
            {a.mode === 'CLINIC' && <div className="mt-5 pt-4 border-t border-line text-sm text-ink-muted">CareSync Clinic, 24 Anna Salai, Puducherry · +91 413 222 4455</div>}
          </Card>
          <PaymentCard a={a} onPay={startPayment} />
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={cancel}
        loading={busy}
        title="Cancel this appointment?"
        confirmLabel="Yes, cancel"
        message={
          a.paymentStatus === 'PAID'
            ? a.refundIfCancelled
              ? `The slot will be released and your ${rupees(a.fee)} payment refunded in full.`
              : `It's less than 2 hours before your slot, so the ${rupees(a.fee)} payment can't be refunded. The slot will be released.`
            : 'The slot will be released for other patients. You can book again anytime.'
        }
      />
      {resched && <RescheduleModal appt={a} onClose={() => setResched(false)} onDone={() => { setResched(false); reload(); }} />}
      {paying && (
        <PaymentModal
          payment={paying}
          appointment={a}
          onClose={() => setPaying(null)}
          onSuccess={() => {
            toast.success('Payment successful. Your appointment is confirmed.');
            setPaying(null);
            reload();
          }}
        />
      )}
    </>
  );
}

