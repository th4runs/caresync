import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { addDays, formatDateLong, formatDay, formatDayNum, formatMonth, formatTime, slotPeriod, todayISO } from '../lib/format';
import { Button, Spinner, cx } from './ui';
import { useToast } from '../context/ToastContext';

const DAYS_AHEAD = 30;

/** Date strip + slot grid. value = { date, time }. */
export default function SlotPicker({ doctorId, value, onChange, availability = [], allowWaitlist = false }) {
  const toast = useToast();
  const [joined, setJoined] = useState({});
  const [joining, setJoining] = useState(false);
  const today = todayISO();
  const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
  const workingDays = new Set(availability.map((a) => a.dayOfWeek));
  const [data, setData] = useState({ slots: [], reason: null });
  const [loading, setLoading] = useState(false);
  const stripRef = useRef(null);

  useEffect(() => {
    if (!value.date) return;
    let cancelled = false;
    setLoading(true);
    api
      .get(`/doctors/${doctorId}/slots?date=${value.date}`)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setData({ slots: [], reason: e.message }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [doctorId, value.date]);

  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.querySelector('[data-selected="true"]');
    if (strip && el) strip.scrollTo({ left: el.offsetLeft - strip.offsetLeft - 8, behavior: 'smooth' });
  }, [value.date]);

  const scroll = (dir) => stripRef.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
  const groups = data.slots.reduce((acc, s) => {
    (acc[slotPeriod(s.time)] ||= []).push(s);
    return acc;
  }, {});
  const openCount = data.slots.filter((s) => s.available).length;

  return (
    <div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => scroll(-1)} className="hidden sm:flex h-9 w-9 shrink-0 rounded-lg border border-line items-center justify-center text-ink-muted hover:bg-canvas" aria-label="Earlier dates">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div ref={stripRef} className="flex-1 min-w-0 flex gap-2 overflow-x-auto scroll-smooth pb-1 -mb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {dates.map((d) => {
            const dow = new Date(d + 'T00:00:00Z').getUTCDay();
            const off = availability.length > 0 && !workingDays.has(dow);
            const selected = value.date === d;
            return (
              <button
                key={d}
                type="button"
                data-selected={selected}
                onClick={() => onChange({ date: d, time: '' })}
                className={cx(
                  'shrink-0 w-[64px] rounded-lg border py-2 text-center transition-colors',
                  selected ? 'bg-brand-600 border-brand-600 text-white' : off ? 'border-line text-ink-muted/60 bg-canvas' : 'border-line text-ink hover:border-brand-400',
                )}
              >
                <span className={cx('block text-xs', selected ? 'text-brand-100' : 'text-ink-muted')}>{d === today ? 'Today' : formatDay(d)}</span>
                <span className="block text-lg font-semibold leading-tight">{formatDayNum(d)}</span>
                <span className={cx('block text-xs', selected ? 'text-brand-100' : 'text-ink-muted')}>{formatMonth(d)}</span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => scroll(1)} className="hidden sm:flex h-9 w-9 shrink-0 rounded-lg border border-line items-center justify-center text-ink-muted hover:bg-canvas" aria-label="Later dates">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <p className="font-medium">{value.date ? formatDateLong(value.date) : 'Choose a date'}</p>
          {!loading && openCount > 0 && <p className="text-sm text-ink-muted">{openCount} slots open</p>}
        </div>
        {loading ? (
          <div className="py-10 flex justify-center">
            <Spinner />
          </div>
        ) : !data.slots.length ? (
          <div className="rounded-lg bg-canvas px-4 py-8 text-center text-sm text-ink-muted">{data.reason || 'No slots available on this day.'} Please choose another date.</div>
        ) : openCount === 0 ? (
          <div className="rounded-lg bg-canvas px-4 py-8 text-center text-sm text-ink-muted">
            <p>All slots on this day are booked.</p>
            {allowWaitlist ? (
              joined[value.date] ? (
                <p className="mt-2 text-emerald-700 font-medium">You're on the waitlist. We'll alert you by SMS and email if a slot opens.</p>
              ) : (
                <>
                  <p className="mt-1">Join the waitlist and we'll alert you the moment someone cancels.</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    loading={joining}
                    onClick={async () => {
                      setJoining(true);
                      try {
                        const r = await api.post('/patient/waitlist', { doctorId, date: value.date });
                        setJoined((j) => ({ ...j, [value.date]: true }));
                        toast.success(r.message);
                      } catch (e) {
                        toast.error(e.message);
                      } finally {
                        setJoining(false);
                      }
                    }}
                  >
                    Join waitlist for this day
                  </Button>
                </>
              )
            ) : (
              <p className="mt-1">Please choose another date.</p>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(groups).map(([period, slots]) => (
              <div key={period}>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-2">{period}</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!s.available}
                      onClick={() => onChange({ ...value, time: s.time })}
                      className={cx(
                        'h-10 rounded-lg border text-sm font-medium transition-colors',
                        value.time === s.time
                          ? 'bg-brand-600 border-brand-600 text-white'
                          : s.available
                            ? 'border-line text-ink-soft hover:border-brand-500 hover:text-brand-700'
                            : 'border-line bg-canvas text-ink-muted/50 line-through cursor-not-allowed',
                      )}
                    >
                      {formatTime(s.time)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-xs text-ink-muted">All times are in IST.</p>
          </div>
        )}
      </div>
    </div>
  );
}
