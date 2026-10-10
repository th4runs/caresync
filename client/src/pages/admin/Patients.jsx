import { useState } from 'react';
import { Trash2, Users } from 'lucide-react';
import { Avatar, Button, Card, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, PageLoader, SearchInput, Select, Spinner, StatusBadge, TableCard, Toggle } from '../../components/ui';
import { useDebounced, useFetch } from '../../lib/useFetch';
import { api, qs } from '../../lib/api';
import { formatDate, formatTime } from '../../lib/format';
import { useToast } from '../../context/ToastContext';

function PatientModal({ id, onClose }) {
  const { data: p, loading, error } = useFetch(`/admin/patients/${id}`);
  return (
    <Modal open onClose={onClose} title="Patient details" size="lg">
      {loading ? (
        <div className="py-10 flex justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Avatar name={p.name} size="lg" />
            <div>
              <p className="font-semibold text-lg">{p.name}</p>
              <p className="text-sm text-ink-muted">
                {p.email}
                {p.phone && ` · +91 ${p.phone}`}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 text-sm">
            {[
              ['Age', p.age ? `${p.age} yrs` : '—'],
              ['Gender', p.gender || '—'],
              ['Blood group', p.bloodGroup || '—'],
              ['Joined', new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-ink-muted">{k}</p>
                <p className="font-medium">{v}</p>
              </div>
            ))}
          </div>
          {p.address && <p className="text-sm text-ink-soft mt-4">{p.address}</p>}
          <h4 className="text-sm font-semibold mt-6 mb-2">Appointments ({p.appointments.length})</h4>
          {p.appointments.length === 0 ? (
            <p className="text-sm text-ink-muted">No appointments yet.</p>
          ) : (
            <ul className="divide-y divide-line border border-line rounded-lg max-h-72 overflow-y-auto">
              {p.appointments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{a.doctorName}</p>
                    <p className="text-ink-muted">
                      {formatDate(a.date)}, {formatTime(a.time)} · {a.specialization}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}

export default function ManagePatients() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const q = useDebounced(search);
  const { data, loading, error, reload } = useFetch(`/admin/patients${qs({ search: q, status })}`);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const toggle = async (p, isActive) => {
    try {
      await api.patch(`/admin/patients/${p.id}/status`, { isActive });
      toast.success(`${p.name} ${isActive ? 'activated' : 'deactivated'}`);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };
  const doDelete = async () => {
    setBusy(true);
    try {
      await api.del(`/admin/patients/${deleting.id}`);
      toast.success('Patient deleted');
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Patients" subtitle="View registered patients, their visits and account status." />
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email or phone" className="flex-1" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="md:w-40">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data.length ? (
        <Card>
          <EmptyState icon={Users} title="No patients found" />
        </Card>
      ) : (
        <TableCard footer={<p className="px-4 py-3 text-sm text-ink-muted border-t border-line">{data.length} patients</p>}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Phone</th>
                <th>Age / Gender</th>
                <th>Visits</th>
                <th>Last visit</th>
                <th>Active</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className={p.isActive ? '' : 'opacity-60'}>
                  <td>
                    <button onClick={() => setViewing(p.id)} className="flex items-center gap-3 text-left min-w-[200px]">
                      <Avatar name={p.name} size="sm" />
                      <span>
                        <span className="block font-medium hover:text-brand-700">{p.name}</span>
                        <span className="block text-xs text-ink-muted">{p.email}</span>
                      </span>
                    </button>
                  </td>
                  <td className="whitespace-nowrap">{p.phone ? `+91 ${p.phone}` : '—'}</td>
                  <td className="whitespace-nowrap">{[p.age, p.gender].filter(Boolean).join(' / ') || '—'}</td>
                  <td className="tabular-nums">{p.appointmentCount}</td>
                  <td className="whitespace-nowrap">{p.lastVisit ? formatDate(p.lastVisit) : '—'}</td>
                  <td>
                    <Toggle checked={p.isActive} onChange={(v) => toggle(p, v)} label={`Toggle ${p.name}`} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(p.id)}>
                        View
                      </Button>
                      <button onClick={() => setDeleting(p)} className="p-2 rounded-md text-ink-muted hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${p.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}

      {viewing && <PatientModal id={viewing} onClose={() => setViewing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        loading={busy}
        title="Delete patient?"
        confirmLabel="Delete permanently"
        message={deleting && `${deleting.name}'s account and all ${deleting.appointmentCount} appointment records will be deleted. To keep their history, deactivate the account instead.`}
      />
    </>
  );
}
