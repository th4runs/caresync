import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Download } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, PageLoader, SearchInput, Select, TableCard } from '../../components/ui';
import DoctorStatusSelect from '../../components/DoctorStatusSelect';
import { useDebounced, useFetch } from '../../lib/useFetch';
import { api, qs } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { PAYMENT, STATUS, formatDate, formatTime, rupees, todayISO } from '../../lib/format';

const ALL = Object.keys(STATUS);

function exportCsv(rows) {
  const header = ['Booking ID', 'Date', 'Time', 'Type', 'Patient', 'Phone', 'Doctor', 'Speciality', 'Fee', 'Payment', 'Status', 'Reason'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((a) =>
    [`CS-${String(a.id).padStart(5, '0')}`, a.date, a.time, a.mode === 'VIDEO' ? 'Video' : 'Clinic', a.patientName, a.patientPhone, a.doctorName, a.specialization, a.fee, PAYMENT[a.paymentStatus].label, STATUS[a.status].label, a.reason].map(esc).join(','),
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `caresync-appointments-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ManageAppointments() {
  const [search, setSearch] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [params] = useSearchParams();
  const [needsRebook, setNeedsRebook] = useState(params.get('needsRebook') === '1');
  const [mode, setMode] = useState('');
  const [payment, setPayment] = useState('');
  const toast = useToast();
  const q = useDebounced(search);
  const { data: doctors } = useFetch('/admin/doctors');
  const { data, loading, error, reload } = useFetch(`/admin/appointments${qs({ search: q, doctorId, status, from, to, mode, payment, needsRebook: needsRebook ? '1' : '' })}`);
  const filtered = search || doctorId || status || from || to || mode || payment || needsRebook;
  const today = todayISO();
  const checkIn = async (a) => {
    try {
      const r = await api.post(`/admin/appointments/${a.id}/check-in`);
      toast.success(`${a.patientName}: ${r.message}`);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Every booking across the clinic. Update a status or export for reports."
        action={
          <Button variant="secondary" onClick={() => exportCsv(data || [])} disabled={!data?.length}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto_auto] gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search patient or doctor" />
          <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">All doctors</option>
            {doctors?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {ALL.map((s) => (
              <option key={s} value={s}>
                {STATUS[s].label}
              </option>
            ))}
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" title="From" />
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="To date" title="To" />
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <Select value={mode} onChange={(e) => setMode(e.target.value)} className="w-auto">
            <option value="">Clinic & video</option>
            <option value="CLINIC">In-clinic only</option>
            <option value="VIDEO">Video only</option>
          </Select>
          <Select value={payment} onChange={(e) => setPayment(e.target.value)} className="w-auto">
            <option value="">All payments</option>
            {Object.entries(PAYMENT).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="accent-brand-600" checked={needsRebook} onChange={(e) => setNeedsRebook(e.target.checked)} />
            Needs rebooking (doctor unavailable)
          </label>
        </div>
        {filtered && (
          <button
            onClick={() => {
              setMode('');
              setPayment('');
              setNeedsRebook(false);
              setSearch('');
              setDoctorId('');
              setStatus('');
              setFrom('');
              setTo('');
            }}
            className="text-sm text-brand-600 font-medium mt-3 hover:underline"
          >
            Clear filters
          </button>
        )}
      </Card>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data.length ? (
        <Card>
          <EmptyState icon={ClipboardList} title="No appointments match these filters" />
        </Card>
      ) : (
        <TableCard footer={<p className="px-4 py-3 text-sm text-ink-muted border-t border-line">Showing {data.length} appointments{data.length === 500 ? ' (latest 500)' : ''}</p>}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Date & time</th>
                <th>Payment</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td className="text-ink-muted whitespace-nowrap">CS-{String(a.id).padStart(5, '0')}</td>
                  <td>
                    <p className="font-medium whitespace-nowrap">{a.patientName}</p>
                    <p className="text-xs text-ink-muted">{a.patientPhone ? `+91 ${a.patientPhone}` : a.patientEmail}</p>
                  </td>
                  <td>
                    <p className="whitespace-nowrap">
                      {a.doctorName}
                      {a.mode === 'VIDEO' && <span className="ml-1.5 text-xs text-brand-700">Video</span>}
                    </p>
                    <p className="text-xs text-ink-muted">{a.specialization}</p>
                  </td>
                  <td className="whitespace-nowrap">
                    <p>{formatDate(a.date)}</p>
                    <p className="text-xs text-ink-muted">{formatTime(a.time)}</p>
                  </td>
                  <td className="whitespace-nowrap">
                    <p>{rupees(a.fee)}</p>
                    <Badge tone={PAYMENT[a.paymentStatus].tone}>{PAYMENT[a.paymentStatus].label}</Badge>
                  </td>
                  <td>
                    <DoctorStatusSelect appt={a} onChanged={reload} endpoint={`/admin/appointments/${a.id}/status`} options={ALL.filter((s) => s !== a.status)} />
                    {a.needsRebook && <p className="text-xs text-amber-700 mt-1">Patient to rebook</p>}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {a.mode === 'CLINIC' && a.date === today && a.status === 'SCHEDULED' && !a.tokenNo && a.paymentStatus !== 'PENDING' ? (
                      <Button size="sm" variant="secondary" onClick={() => checkIn(a)}>
                        Check in
                      </Button>
                    ) : a.tokenNo ? (
                      <span className="text-xs text-ink-muted">Token {a.tokenNo}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}
    </>
  );
}
