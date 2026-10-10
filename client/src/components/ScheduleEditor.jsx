import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Field, Input, PageLoader, Select, Toggle } from './ui';
import UnavailableModal from './UnavailableModal';
import { api } from '../lib/api';
import { DAYS, KIND, formatDateLong, formatTime } from '../lib/format';
import { useToast } from '../context/ToastContext';

const ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Weekly hours + leave days. basePath is '/doctor' or '/admin/doctors/:id'. */
export default function ScheduleEditor({ basePath }) {
  const toast = useToast();
  const [loaded, setLoaded] = useState(null);
  const [slot, setSlot] = useState(30);
  const [days, setDays] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [blocking, setBlocking] = useState(false);

  const apply = (s) => {
    setLoaded(s);
    setSlot(s.slotDuration);
    const d = {};
    for (const day of ORDER) d[day] = s.availability.filter((a) => a.dayOfWeek === day).map((a) => ({ startTime: a.startTime, endTime: a.endTime }));
    setDays(d);
  };

  useEffect(() => {
    api.get(`${basePath}/schedule`).then(apply).catch((e) => setErr(e.message));
  }, [basePath]);

  if (!loaded) return err ? <Alert>{err}</Alert> : <PageLoader />;

  const setDay = (day, sessions) => setDays({ ...days, [day]: sessions });
  const toggleDay = (day, on) => setDay(day, on ? [{ startTime: '10:00', endTime: '13:00' }] : []);
  const updateSession = (day, i, k, v) => setDay(day, days[day].map((s, j) => (j === i ? { ...s, [k]: v } : s)));

  const save = async () => {
    setErr('');
    setSaving(true);
    try {
      const availability = ORDER.flatMap((day) => days[day].map((s) => ({ dayOfWeek: day, ...s })));
      apply(await api.put(`${basePath}/schedule`, { slotDuration: Number(slot), availability }));
      toast.success('Weekly schedule saved');
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeBlock = async (id) => {
    try {
      apply(await api.del(`${basePath}/unavailability/${id}`));
      toast.success('Removed. Patients can book this time again.');
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Weekly consultation hours" subtitle="Patients can book slots only within these hours." />
        <div className="px-5 pb-2">
          <Field label="Slot length" className="max-w-xs">
            <Select value={slot} onChange={(e) => setSlot(e.target.value)}>
              {[10, 15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="divide-y divide-line border-t border-line mt-4">
          {ORDER.map((day) => {
            const sessions = days[day] || [];
            return (
              <div key={day} className="px-5 py-4 flex flex-col sm:flex-row gap-3 sm:gap-6">
                <div className="flex items-center gap-3 sm:w-40 sm:pt-2.5 shrink-0">
                  <Toggle checked={sessions.length > 0} onChange={(on) => toggleDay(day, on)} label={`${DAYS[day]} availability`} />
                  <span className="font-medium">{DAYS[day]}</span>
                </div>
                <div className="flex-1 space-y-2">
                  {sessions.length === 0 ? (
                    <p className="text-sm text-ink-muted sm:pt-2.5">Not available</p>
                  ) : (
                    sessions.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input type="time" value={s.startTime} onChange={(e) => updateSession(day, i, 'startTime', e.target.value)} className="flex-1 min-w-0 sm:flex-none sm:w-[150px]" aria-label="Start time" />
                        <span className="text-ink-muted">to</span>
                        <Input type="time" value={s.endTime} onChange={(e) => updateSession(day, i, 'endTime', e.target.value)} className="flex-1 min-w-0 sm:flex-none sm:w-[150px]" aria-label="End time" />
                        <button type="button" onClick={() => setDay(day, sessions.filter((_, j) => j !== i))} className="p-2 text-ink-muted hover:text-red-600" aria-label="Remove session">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                  {sessions.length > 0 && sessions.length < 3 && (
                    <button type="button" onClick={() => setDay(day, [...sessions, { startTime: '17:00', endTime: '20:00' }])} className="inline-flex items-center gap-1 text-sm text-brand-600 font-medium hover:underline">
                      <Plus className="h-4 w-4" /> Add session
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-4 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">Existing bookings are not affected by changes to your hours.</p>
          <Button onClick={save} loading={saving}>
            Save schedule
          </Button>
        </div>
        {err && <Alert className="mx-5 mb-5">{err}</Alert>}
      </Card>

      <Card>
        <CardHeader
          title="Time off & unavailability"
          subtitle="Leave, personal work or emergencies. Booked patients are transferred or asked to rebook."
          action={<Button size="sm" onClick={() => setBlocking(true)}>Mark unavailable</Button>}
        />
        <div className="px-5 pb-5">
          {loaded.timeOff.length === 0 ? (
            <p className="text-sm text-ink-muted">No upcoming time off.</p>
          ) : (
            <ul className="divide-y divide-line border border-line rounded-lg">
              {loaded.timeOff.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-sm">{formatDateLong(l.date)}</p>
                      <Badge tone={KIND[l.kind].tone}>{KIND[l.kind].label}</Badge>
                    </div>
                    <p className="text-sm text-ink-muted">
                      {l.startTime ? `${formatTime(l.startTime)} – ${l.endTime === '23:59' ? 'end of day' : formatTime(l.endTime)}` : 'Whole day'}
                      {l.reason && ` · ${l.reason}`}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeBlock(l.id)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {blocking && <UnavailableModal basePath={basePath} onClose={() => setBlocking(false)} onDone={(r) => apply(r.schedule)} />}
    </div>
  );
}
