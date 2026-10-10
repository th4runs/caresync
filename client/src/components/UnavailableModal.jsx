import { useState } from 'react';
import { AlertTriangle, CalendarOff, Clock } from 'lucide-react';
import { Alert, Avatar, Button, Field, Input, Modal, RadioCard, Textarea, cx } from './ui';
import { api } from '../lib/api';
import { addDays, formatDateLong, formatTime, nowTimeIST, rupees, todayISO } from '../lib/format';
import { useToast } from '../context/ToastContext';

const KINDS = [
  { value: 'EMERGENCY', label: 'Emergency', text: 'Medical or family emergency', icon: AlertTriangle },
  { value: 'PERSONAL', label: 'Personal work', text: 'Important personal commitment', icon: Clock },
  { value: 'LEAVE', label: 'Leave', text: 'Planned day off or conference', icon: CalendarOff },
];

const roundDown = (t) => {
  const [h, m] = t.split(':').map(Number);
  return `${String(h).padStart(2, '0')}:${m < 30 ? '00' : '30'}`;
};

/**
 * Marks a doctor unavailable and decides what happens to booked patients.
 * basePath: '/doctor' or '/admin/doctors/:id'. preset: 'today' for the quick emergency button.
 */
export default function UnavailableModal({ basePath, preset, onClose, onDone }) {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    kind: preset === 'today' ? 'EMERGENCY' : 'LEAVE',
    when: preset === 'today' ? 'rest' : 'day',
    date: preset === 'today' ? todayISO() : addDays(todayISO(), 1),
    startTime: '10:00',
    endTime: '13:00',
    reason: '',
  });
  const [preview, setPreview] = useState(null);
  const [action, setAction] = useState('REBOOK');
  const [colleague, setColleague] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const body = () => {
    const base = { kind: form.kind, reason: form.reason };
    if (form.when === 'rest') return { ...base, date: todayISO(), startTime: roundDown(nowTimeIST()), endTime: '23:59' };
    if (form.when === 'day') return { ...base, date: form.date, wholeDay: true };
    return { ...base, date: form.date, startTime: form.startTime, endTime: form.endTime };
  };

  const next = async () => {
    setErr('');
    setBusy(true);
    try {
      const p = await api.post(`${basePath}/unavailability/preview`, body());
      setPreview(p);
      const best = [...p.colleagues].sort((a, b) => b.canTake.length - a.canTake.length)[0];
      if (best?.canTake.length) {
        setAction('TRANSFER');
        setColleague(best.id);
      } else {
        setAction('REBOOK');
      }
      setStep(2);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setErr('');
    setBusy(true);
    try {
      const r = await api.post(`${basePath}/unavailability`, { ...body(), action, transferDoctorId: colleague });
      const parts = [];
      if (r.transferred) parts.push(`${r.transferred} moved to a colleague`);
      if (r.rebook) parts.push(`${r.rebook} asked to rebook`);
      toast.success(parts.length ? `Marked unavailable. ${parts.join(', ')}. Patients have been notified.` : 'Marked unavailable. Patients can no longer book this time.');
      onDone?.(r);
      onClose();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const affected = preview?.affected || [];
  const chosen = preview?.colleagues.find((c) => c.id === colleague);
  const paidCount = affected.filter((a) => a.paymentStatus === 'PAID').length;

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={step === 1 ? 'Mark yourself unavailable' : affected.length ? `${affected.length} booked ${affected.length === 1 ? 'patient' : 'patients'} affected` : 'Confirm'}
      footer={
        step === 1 ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={next} loading={busy}>
              Continue
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep(1)} disabled={busy}>
              Back
            </Button>
            <Button variant={form.kind === 'EMERGENCY' ? 'dangerSolid' : 'primary'} onClick={confirm} loading={busy} disabled={action === 'TRANSFER' && !chosen?.canTake.length}>
              {affected.length ? 'Confirm and notify patients' : 'Confirm'}
            </Button>
          </>
        )
      }
    >
      {step === 1 ? (
        <div className="space-y-5">
          <div>
            <p className="label">Reason</p>
            <div className="grid sm:grid-cols-3 gap-2">
              {KINDS.map(({ value, label, text, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set('kind', value)}
                  className={cx('text-left rounded-lg border p-3 transition-colors', form.kind === value ? (value === 'EMERGENCY' ? 'border-red-400 bg-red-50' : 'border-brand-500 bg-brand-50') : 'border-line hover:border-slate-300')}
                >
                  <Icon className={cx('h-5 w-5', value === 'EMERGENCY' ? 'text-red-600' : 'text-brand-600')} />
                  <span className="block font-medium mt-2">{label}</span>
                  <span className="block text-xs text-ink-muted mt-0.5">{text}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label">When</p>
            <div className="space-y-2">
              <RadioCard checked={form.when === 'rest'} onChange={() => set('when', 'rest')} title="Rest of today" text={`From ${formatTime(roundDown(nowTimeIST()))} until the end of the day`} />
              <RadioCard checked={form.when === 'day'} onChange={() => set('when', 'day')} title="A whole day">
                {form.when === 'day' && <Input type="date" min={todayISO()} value={form.date} onChange={(e) => set('date', e.target.value)} className="mt-2 max-w-[200px]" />}
              </RadioCard>
              <RadioCard checked={form.when === 'hours'} onChange={() => set('when', 'hours')} title="Specific hours">
                {form.when === 'hours' && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Input type="date" min={todayISO()} value={form.date} onChange={(e) => set('date', e.target.value)} className="w-[170px]" />
                    <Input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} className="w-[130px]" aria-label="From" />
                    <span className="text-ink-muted">to</span>
                    <Input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} className="w-[130px]" aria-label="Until" />
                  </div>
                )}
              </RadioCard>
            </div>
          </div>

          <Field label="Note (optional)" hint="Only the clinic sees this. Patients see a polite general message.">
            <Textarea rows={2} maxLength={200} value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="e.g. Called in for emergency surgery" />
          </Field>
          <Alert>{err}</Alert>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-ink-soft">
            {preview.block.startTime ? `${formatDateLong(preview.block.date)}, ${formatTime(preview.block.startTime)} – ${preview.block.endTime === '23:59' ? 'end of day' : formatTime(preview.block.endTime)}` : `${formatDateLong(preview.block.date)} (whole day)`}
          </p>

          {affected.length === 0 ? (
            <Alert tone="success">No patients are booked in this time. New bookings will be blocked.</Alert>
          ) : (
            <>
              <ul className="divide-y divide-line border border-line rounded-lg max-h-52 overflow-y-auto">
                {affected.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-20 font-medium tabular-nums">{formatTime(a.time)}</span>
                    <span className="flex-1">{a.patientName}</span>
                    {a.mode === 'VIDEO' && <span className="text-xs text-ink-muted">Video</span>}
                    {a.paymentStatus === 'PAID' && <span className="text-xs text-emerald-700">Paid {rupees(a.fee)}</span>}
                  </li>
                ))}
              </ul>

              <div>
                <p className="label">What should happen to these appointments?</p>
                <div className="space-y-2">
                  <RadioCard
                    checked={action === 'TRANSFER'}
                    onChange={() => setAction('TRANSFER')}
                    disabled={!preview.colleagues.some((c) => c.canTake.length)}
                    title="Transfer to a colleague"
                    text={preview.colleagues.length ? 'Patients keep the same time with another doctor of the same speciality.' : 'No other doctor in this speciality.'}
                  >
                    {action === 'TRANSFER' && (
                      <div className="mt-3 space-y-2">
                        {preview.colleagues.map((c) => (
                          <label key={c.id} className={cx('flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer', colleague === c.id ? 'border-brand-500 bg-white' : 'border-line bg-white')}>
                            <input type="radio" className="accent-brand-600" checked={colleague === c.id} onChange={() => setColleague(c.id)} disabled={!c.canTake.length} />
                            <Avatar name={c.name} size="xs" />
                            <span className="flex-1 text-sm font-medium">{c.name}</span>
                            <span className={cx('text-xs', c.canTake.length === affected.length ? 'text-emerald-700' : 'text-ink-muted')}>
                              Free for {c.canTake.length} of {affected.length}
                            </span>
                          </label>
                        ))}
                        {chosen && chosen.canTake.length < affected.length && (
                          <p className="text-xs text-ink-muted">The other {affected.length - chosen.canTake.length} will be asked to pick a new time.</p>
                        )}
                      </div>
                    )}
                  </RadioCard>
                  <RadioCard
                    checked={action === 'REBOOK'}
                    onChange={() => setAction('REBOOK')}
                    title="Ask patients to pick a new time"
                    text={`Patients get an email, SMS and app alert with one-tap rebooking.${paidCount ? ` ${paidCount} online ${paidCount === 1 ? 'payment' : 'payments'} will be refunded automatically.` : ''}`}
                  />
                </div>
              </div>
            </>
          )}
          <Alert>{err}</Alert>
        </div>
      )}
    </Modal>
  );
}
