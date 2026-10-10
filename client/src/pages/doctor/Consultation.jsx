import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Avatar, Button, Card, CardHeader, ErrorState, Field, Input, Modal, PageLoader, StatusBadge, Textarea } from '../../components/ui';
import Prescription from '../../components/Prescription';
import DoctorStatusSelect from '../../components/DoctorStatusSelect';
import { BackLink } from '../patient/DoctorProfile';
import { useFetch } from '../../lib/useFetch';
import { api } from '../../lib/api';
import { addDays, formatDate, formatDateLong, formatTime } from '../../lib/format';
import { useToast } from '../../context/ToastContext';

const EMPTY = { symptoms: '', diagnosis: '', notes: '', prescription: '', followUpDate: '' };

export default function Consultation() {
  const { id } = useParams();
  const toast = useToast();
  const { data: a, loading, error, reload } = useFetch(`/doctor/appointments/${id}`);
  const [f, setF] = useState(EMPTY);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState('');
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (a) setF(a.note ? { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, a.note[k] || ''])) } : EMPTY);
  }, [a]);

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const locked = a.status === 'CANCELLED';

  const save = async (markCompleted) => {
    setErr('');
    setSaving(markCompleted ? 'complete' : 'draft');
    try {
      await api.put(`/doctor/appointments/${a.id}/notes`, { ...f, markCompleted });
      toast.success(markCompleted ? 'Consultation completed. Prescription shared with the patient.' : 'Notes saved');
      reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving('');
    }
  };

  const p = a.patient;
  return (
    <>
      <BackLink to="/doctor/appointments">Appointments</BackLink>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] sm:text-2xl">Consultation notes</h1>
          <p className="text-ink-muted mt-1">
            {formatDateLong(a.date)} · {formatTime(a.time)} · {a.mode === 'VIDEO' ? 'Video consultation' : 'In-clinic visit'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {a.mode === 'VIDEO' && ['SCHEDULED', 'IN_PROGRESS'].includes(a.status) && (
            <Button size="sm" to={`/visit/${a.id}`}>
              Join video call
            </Button>
          )}
          {a.tokenNo && <span className="text-sm text-ink-muted">Token {a.tokenNo}</span>}
          <span className="text-sm text-ink-muted">Status</span>
          <DoctorStatusSelect appt={a} onChanged={reload} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-start gap-4">
              <Avatar name={p.name} size="lg" />
              <div className="flex-1">
                <p className="font-semibold text-lg">{p.name}</p>
                <p className="text-sm text-ink-muted">Booking ID CS-{String(a.id).padStart(5, '0')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
                  {[
                    ['Age', p.age ? `${p.age} years` : '—'],
                    ['Gender', p.gender || '—'],
                    ['Blood group', p.bloodGroup || '—'],
                    ['Phone', p.phone ? `+91 ${p.phone}` : '—'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs text-ink-muted">{k}</p>
                      <p className="font-medium">{v}</p>
                    </div>
                  ))}
                </div>
                {a.reason && (
                  <p className="mt-4 text-sm rounded-lg bg-canvas px-3 py-2">
                    <span className="text-ink-muted">Reason for visit: </span>
                    {a.reason}
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Notes" subtitle={locked ? 'This appointment was cancelled.' : 'Saved notes become the patient\'s prescription.'} />
            <div className="px-5 pb-5 space-y-4">
              <Alert>{err}</Alert>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Symptoms">
                  <Textarea rows={3} disabled={locked} value={f.symptoms} onChange={set('symptoms')} placeholder="e.g. Fever and body ache for 3 days" />
                </Field>
                <Field label="Diagnosis">
                  <Textarea rows={3} disabled={locked} value={f.diagnosis} onChange={set('diagnosis')} placeholder="e.g. Viral fever" />
                </Field>
              </div>
              <Field label="Prescription" hint="One medicine per line: name, strength, dosage and duration.">
                <Textarea rows={5} disabled={locked} value={f.prescription} onChange={set('prescription')} placeholder={'Tab. Paracetamol 650 mg – 1-1-1 after food × 3 days\nORS sachets as needed'} className="font-mono text-[14px]" />
              </Field>
              <Field label="Advice & notes">
                <Textarea rows={3} maxLength={1000} disabled={locked} value={f.notes} onChange={set('notes')} placeholder="Rest, fluids, review if symptoms worsen" />
              </Field>
              <Field label="Follow-up date" className="max-w-xs">
                <Input type="date" disabled={locked} min={addDays(a.date, 1)} value={f.followUpDate} onChange={set('followUpDate')} />
              </Field>
              {!locked && (
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                  {a.note && (
                    <Button variant="ghost" onClick={() => setPreview(true)}>
                      Preview prescription
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => save(false)} loading={saving === 'draft'} disabled={!!saving}>
                    Save notes
                  </Button>
                  {a.status !== 'COMPLETED' && (
                    <Button onClick={() => save(true)} loading={saving === 'complete'} disabled={!!saving}>
                      Save & complete visit
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Previous visits" subtitle={a.previousVisits.length ? 'Most recent completed visits' : null} />
          {a.previousVisits.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-ink-muted">This is the patient's first visit.</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {a.previousVisits.map((v) => (
                <li key={v.id} className="px-5 py-4">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-medium">{formatDate(v.date)}</span>
                    <span className="text-ink-muted text-right">{v.specialization}</span>
                  </div>
                  <p className="text-sm mt-1">{v.diagnosis || 'No diagnosis recorded'}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{v.doctorName}</p>
                  {v.prescription && <p className="text-xs text-ink-soft mt-2 whitespace-pre-line bg-canvas rounded-md px-2.5 py-2">{v.prescription}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal open={preview} onClose={() => setPreview(false)} title="Prescription preview" size="xl">
        {a.note && <Prescription appt={{ ...a, patientAge: p.age, patientGender: p.gender }} note={a.note} patient={p} />}
        <p className="text-sm text-ink-muted mt-3">
          <StatusBadge status={a.status} /> The patient sees this on their appointment page and can download it.
        </p>
      </Modal>
    </>
  );
}
