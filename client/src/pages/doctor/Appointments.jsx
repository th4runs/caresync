import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, Input, PageHeader, PageLoader, SearchInput, Select, Tabs, TableCard } from '../../components/ui';
import DoctorStatusSelect from '../../components/DoctorStatusSelect';
import { useDebounced, useFetch } from '../../lib/useFetch';
import { qs } from '../../lib/api';
import { formatDate, formatTime, STATUS, todayISO } from '../../lib/format';

export default function DoctorAppointments() {
  const [range, setRange] = useState('today');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const query = range === 'today' ? { date: todayISO() } : range === 'date' ? { date } : { range };
  const { data, loading, error, reload } = useFetch(range === 'date' && !date ? null : `/doctor/appointments${qs({ ...query, status, search: q })}`);

  return (
    <>
      <PageHeader title="Appointments" subtitle="View your bookings, update their status and open consultations." />
      <Card className="mb-4">
        <Tabs
          className="px-2 sm:px-4 pt-1"
          value={range}
          onChange={setRange}
          tabs={[
            { value: 'today', label: 'Today' },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
            { value: 'date', label: 'Pick a date' },
          ]}
        />
        <div className="p-4 flex flex-col md:flex-row gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search patient name" className="flex-1" />
          {range === 'date' && <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="md:w-48" />}
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="md:w-48">
            <option value="">All statuses</option>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {range === 'date' && !date ? (
        <Card>
          <EmptyState icon={CalendarDays} title="Choose a date" text="Pick a date above to see appointments for that day." />
        </Card>
      ) : loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data.length ? (
        <Card>
          <EmptyState icon={CalendarDays} title="No appointments found" text="Try a different filter." />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <TableCard>
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Date & time</th>
                    <th>Patient</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap">
                        <p className="font-medium">{formatTime(a.time)}</p>
                        <p className="text-ink-muted">{formatDate(a.date)}</p>
                      </td>
                      <td>
                        <p className="font-medium">
                          {a.patientName}
                          {a.mode === 'VIDEO' && <span className="ml-2 text-xs font-normal text-brand-700">Video</span>}
                          {a.tokenNo && <span className="ml-2 text-xs font-normal text-ink-muted">Token {a.tokenNo}</span>}
                        </p>
                        <p className="text-ink-muted">{[a.patientAge && `${a.patientAge} yrs`, a.patientGender].filter(Boolean).join(', ')}</p>
                      </td>
                      <td className="text-ink-soft max-w-[220px] truncate">{a.reason || '—'}</td>
                      <td>
                        <DoctorStatusSelect appt={a} onChanged={reload} />
                      </td>
                      <td className="text-right">
                        <Button size="sm" variant="secondary" to={`/doctor/appointments/${a.id}`}>
                          {a.hasNotes ? 'View notes' : 'Open'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {data.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex justify-between gap-3">
                  <Link to={`/doctor/appointments/${a.id}`}>
                    <p className="font-medium">{a.patientName}</p>
                    <p className="text-sm text-ink-muted">
                      {formatDate(a.date)}, {formatTime(a.time)}
                      {a.mode === 'VIDEO' && ' · Video'}
                    </p>
                  </Link>
                  <DoctorStatusSelect appt={a} onChanged={reload} />
                </div>
                {a.reason && <p className="text-sm text-ink-soft mt-2">{a.reason}</p>}
              </Card>
            ))}
          </div>
          <p className="text-sm text-ink-muted mt-3">{data.length} appointments</p>
        </>
      )}
    </>
  );
}
