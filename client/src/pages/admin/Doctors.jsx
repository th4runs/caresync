import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Stethoscope, Trash2 } from 'lucide-react';
import { Avatar, Button, Card, ConfirmDialog, EmptyState, ErrorState, PageHeader, PageLoader, SearchInput, Select, TableCard, Toggle } from '../../components/ui';
import { useDebounced, useFetch } from '../../lib/useFetch';
import { api, qs } from '../../lib/api';
import { rupees } from '../../lib/format';
import { useToast } from '../../context/ToastContext';

export default function ManageDoctors() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [spec, setSpec] = useState('');
  const [status, setStatus] = useState('');
  const q = useDebounced(search);
  const { data: specs } = useFetch('/specializations');
  const { data, loading, error, reload } = useFetch(`/admin/doctors${qs({ search: q, specializationId: spec, status })}`);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const toggle = async (d, isActive) => {
    try {
      await api.patch(`/admin/doctors/${d.id}/status`, { isActive });
      toast.success(`${d.name} ${isActive ? 'activated' : 'deactivated'}`);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await api.del(`/admin/doctors/${deleting.id}`);
      toast.success('Doctor deleted');
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error(e.message);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Doctors" subtitle="Add doctors, update their details and control who appears to patients." action={<Button to="/admin/doctors/new">Add doctor</Button>} />
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email" className="flex-1" />
        <Select value={spec} onChange={(e) => setSpec(e.target.value)} className="md:w-56">
          <option value="">All specialities</option>
          {specs?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
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
          <EmptyState icon={Stethoscope} title="No doctors found" action={<Button size="sm" to="/admin/doctors/new">Add doctor</Button>} />
        </Card>
      ) : (
        <TableCard footer={<p className="px-4 py-3 text-sm text-ink-muted border-t border-line">{data.length} doctors</p>}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Speciality</th>
                <th>Experience</th>
                <th>Fee</th>
                <th>Upcoming</th>
                <th>Active</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id} className={d.isActive ? '' : 'opacity-60'}>
                  <td>
                    <div className="flex items-center gap-3 min-w-[220px]">
                      <Avatar name={d.name} src={d.photoUrl} size="sm" />
                      <div>
                        <Link to={`/admin/doctors/${d.id}/edit`} className="font-medium hover:text-brand-700">
                          {d.name}
                        </Link>
                        <p className="text-ink-muted text-xs">{d.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap">{d.specialization}</td>
                  <td className="whitespace-nowrap">{d.experience} yrs</td>
                  <td className="whitespace-nowrap">{rupees(d.fee)}</td>
                  <td className="tabular-nums">{d.upcomingCount}</td>
                  <td>
                    <Toggle checked={d.isActive} onChange={(v) => toggle(d, v)} label={`Toggle ${d.name}`} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <Link to={`/admin/doctors/${d.id}/edit`} className="p-2 rounded-md text-ink-muted hover:bg-canvas hover:text-ink" aria-label={`Edit ${d.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button onClick={() => setDeleting(d)} className="p-2 rounded-md text-ink-muted hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${d.name}`}>
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

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        loading={busy}
        title="Delete doctor?"
        confirmLabel="Delete"
        message={deleting && `${deleting.name} will be removed permanently. Doctors with appointment history can't be deleted. Deactivate them instead.`}
      />
    </>
  );
}
