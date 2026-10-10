import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, Clock4 } from 'lucide-react';
import { Avatar, Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, ErrorState, PageHeader, PageLoader, Tabs } from '../../components/ui';
import AppointmentRow from '../../components/AppointmentRow';
import RescheduleModal from '../../components/RescheduleModal';
import RebookCard from '../../components/RebookCard';
import PaymentModal from '../../components/PaymentModal';
import { useFetch } from '../../lib/useFetch';
import { api } from '../../lib/api';
import { formatDate, formatTime, relativeDay, rupees } from '../../lib/format';
import { useToast } from '../../context/ToastContext';

export default function MyAppointments() {
  const toast = useToast();
  const [params] = useSearchParams();
  const highlight = Number(params.get('rebook')) || null;
  const { data, loading, error, reload } = useFetch('/patient/appointments');
  const [tab, setTab] = useState('upcoming');
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rescheduling, setRescheduling] = useState(null);
  const [paying, setPaying] = useState(null);

  const doCancel = async () => {
    setBusy(true);
    try {
      const r = await api.patch(`/patient/appointments/${cancelling.id}/cancel`);
      toast.success(r.message);
      setCancelling(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const startPayment = async (a) => {
    try {
      setPaying({ appointment: a, payment: await api.post(`/patient/appointments/${a.id}/pay`) });
    } catch (e) {
      toast.error(e.message);
      reload();
    }
  };

  const leaveWaitlist = async (w) => {
    await api.del(`/patient/waitlist/${w.id}`).catch(() => {});
    toast.success('Removed from waitlist');
    reload();
  };

  const list = data?.[tab] || [];
  const empty = {
    upcoming: ['No upcoming appointments', 'Book a visit with one of our doctors.'],
    past: ['No past visits yet', 'Completed appointments will appear here.'],
    cancelled: ['No cancelled appointments', null],
  }[tab];

  const cancelMessage = (a) => {
    if (!a) return '';
    const base = `Your appointment with ${a.doctorName} on ${formatDate(a.date)} at ${formatTime(a.time)} will be cancelled and the slot released.`;
    if (a.paymentStatus !== 'PAID') return base;
    const [h, m] = a.time.split(':').map(Number);
    const start = new Date(`${a.date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+05:30`);
    return start - Date.now() >= 2 * 3600e3
      ? `${base} Your ${rupees(a.fee)} payment will be refunded in full.`
      : `${base} Because it's less than 2 hours before your slot, the ${rupees(a.fee)} payment can't be refunded.`;
  };

  return (
    <>
      <PageHeader title="My appointments" subtitle="Track, reschedule or cancel your visits." action={<Button to="/patient/doctors">Book new appointment</Button>} />
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="space-y-6">
          {data.actionNeeded.map((a) => (
            <RebookCard key={a.id} appt={a} highlight={a.id === highlight} onDismissed={reload} />
          ))}

          {data.waitlist.length > 0 && (
            <Card>
              <CardHeader title="Waitlist" subtitle="We'll alert you by SMS and email as soon as a slot opens." />
              <ul className="divide-y divide-line border-t border-line">
                {data.waitlist.map((w) => (
                  <li key={w.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar name={w.doctorName} src={w.doctorPhoto} size="sm" />
                      <div>
                        <p className="font-medium">
                          {w.doctorName} · {relativeDay(w.date)}
                        </p>
                        <p className="text-sm text-ink-muted">{w.specialization}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-12 sm:pl-0">
                      {w.status === 'NOTIFIED' ? (
                        <>
                          <Badge tone="green">Slot opened</Badge>
                          <Button size="sm" to={`/patient/doctors/${w.doctorId}/book?date=${w.date}`}>
                            Book now
                          </Button>
                        </>
                      ) : (
                        <Badge tone="amber" className="gap-1">
                          <Clock4 className="h-3 w-3" /> Waiting
                        </Badge>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => leaveWaitlist(w)}>
                        Leave
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <Tabs
              className="px-2 sm:px-4 pt-1"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'upcoming', label: 'Upcoming', count: data.upcoming.length },
                { value: 'past', label: 'Past', count: data.past.length },
                { value: 'cancelled', label: 'Cancelled', count: data.cancelled.length },
              ]}
            />
            {list.length === 0 ? (
              <EmptyState icon={CalendarDays} title={empty[0]} text={empty[1]} action={tab === 'upcoming' && <Button to="/patient/doctors" size="sm">Find a doctor</Button>} />
            ) : (
              <div className="divide-y divide-line">
                {list.map((a) => (
                  <AppointmentRow
                    key={a.id}
                    appt={a}
                    to={`/patient/appointments/${a.id}`}
                    actions={
                      tab === 'upcoming' && a.paymentStatus === 'PENDING' ? (
                        <Button size="sm" onClick={() => startPayment(a)}>
                          Pay {rupees(a.fee)}
                        </Button>
                      ) : tab === 'upcoming' && a.status === 'SCHEDULED' ? (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => setRescheduling(a)}>
                            Reschedule
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setCancelling(a)}>
                            Cancel
                          </Button>
                        </>
                      ) : tab === 'past' ? (
                        <>
                          {a.status === 'COMPLETED' && !a.myRating && (
                            <Button size="sm" variant="secondary" to={`/patient/appointments/${a.id}#review`}>
                              Rate visit
                            </Button>
                          )}
                          <Button size="sm" variant={a.hasNotes ? 'soft' : 'secondary'} to={`/patient/appointments/${a.id}`}>
                            {a.hasNotes ? 'Prescription' : 'Details'}
                          </Button>
                        </>
                      ) : tab === 'cancelled' && !a.needsRebook ? (
                        <Button size="sm" variant="secondary" to={`/patient/doctors/${a.doctorId}/book`}>
                          Book again
                        </Button>
                      ) : null
                    }
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      <ConfirmDialog open={!!cancelling} onClose={() => setCancelling(null)} onConfirm={doCancel} loading={busy} title="Cancel this appointment?" confirmLabel="Yes, cancel" message={cancelMessage(cancelling)} />
      {rescheduling && (
        <RescheduleModal
          appt={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            setRescheduling(null);
            reload();
          }}
        />
      )}
      {paying && (
        <PaymentModal
          payment={paying.payment}
          appointment={paying.appointment}
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
