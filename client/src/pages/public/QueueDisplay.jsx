import { useEffect, useState } from 'react';
import logo from '../../assets/logo.png';
import { api } from '../../lib/api';
import { useQueueWatch } from '../../lib/socket';
import { formatDateLong } from '../../lib/format';

/** Full-screen board for the waiting-room TV. Shows token numbers only, never patient names. */
export default function QueueDisplay() {
  const [data, setData] = useState(null);
  const [clock, setClock] = useState('');
  const load = () => api.get('/queue/display').then(setData).catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    const c = setInterval(() => setClock(new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })), 1000);
    return () => {
      clearInterval(t);
      clearInterval(c);
    };
  }, []);
  useQueueWatch('display', load);

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="bg-white border-b border-line px-6 sm:px-10 h-20 flex items-center justify-between">
        <img src={logo} alt="CareSync" className="h-9" />
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums">{clock}</p>
          {data && <p className="text-sm text-ink-muted">{formatDateLong(data.today)}</p>}
        </div>
      </header>
      <main className="flex-1 p-6 sm:p-10">
        {!data ? null : data.boards.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <p className="text-3xl font-semibold">Welcome to CareSync Clinic</p>
            <p className="text-xl text-ink-muted mt-3">Please check in at the reception or in the CareSync app to get your token.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {data.boards.map((b) => (
              <div key={b.doctorId} className="bg-white border border-line rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-line flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold">{b.doctorName}</p>
                    <p className="text-ink-muted">{b.specialization}</p>
                  </div>
                  {b.delayMinutes > 0 && <span className="rounded-full bg-amber-50 text-amber-800 text-sm font-medium px-3 py-1">Running {b.delayMinutes} min late</span>}
                </div>
                <div className="px-6 py-6 flex items-end justify-between gap-6">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wider text-ink-muted">Now serving</p>
                    <p className="text-7xl font-bold text-brand-600 tabular-nums leading-none mt-2">{b.nowServing ?? '–'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium uppercase tracking-wider text-ink-muted">Next</p>
                    <p className="text-3xl font-semibold tabular-nums mt-2">{b.next.length ? b.next.join('  ') : '–'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <footer className="px-10 py-4 text-ink-muted text-sm">Please wait for your token number to be called. For help, speak to the reception.</footer>
    </div>
  );
}
