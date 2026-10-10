import { useState } from 'react';
import { Pencil, Tags, Trash2 } from 'lucide-react';
import { Alert, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader, PageLoader, Textarea } from '../../components/ui';
import { useFetch } from '../../lib/useFetch';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

export default function ManageSpecializations() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/specializations');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const open = (s) => {
    setErr('');
    setEditing(s || 'new');
    setForm(s ? { name: s.name, description: s.description || '' } : { name: '', description: '' });
  };

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.name.trim()) return setErr('Name is required');
    setSaving(true);
    try {
      if (editing === 'new') await api.post('/admin/specializations', form);
      else await api.put(`/admin/specializations/${editing.id}`, form);
      toast.success(editing === 'new' ? 'Speciality added' : 'Speciality updated');
      setEditing(null);
      reload();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await api.del(`/admin/specializations/${deleting.id}`);
      toast.success('Speciality deleted');
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleting(null);
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Specializations" subtitle="Departments patients can browse when finding a doctor." action={<Button onClick={() => open(null)}>Add speciality</Button>} />
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data.length ? (
        <Card>
          <EmptyState icon={Tags} title="No specialities yet" action={<Button size="sm" onClick={() => open(null)}>Add speciality</Button>} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map((s) => (
            <Card key={s.id} className="p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{s.name}</p>
                <div className="flex -mr-2 -mt-1">
                  <button onClick={() => open(s)} className="p-2 rounded-md text-ink-muted hover:bg-canvas hover:text-ink" aria-label={`Edit ${s.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleting(s)} className="p-2 rounded-md text-ink-muted hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${s.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-ink-muted mt-1 flex-1">{s.description || 'No description'}</p>
              <p className="text-sm mt-4 pt-3 border-t border-line">
                <span className="font-medium">{s.doctorCount}</span> <span className="text-ink-muted">active {s.doctorCount === 1 ? 'doctor' : 'doctors'}</span>
              </p>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add speciality' : 'Edit speciality'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-4">
          <Alert>{err}</Alert>
          <Field label="Name" required>
            <Input autoFocus placeholder="e.g. Ophthalmology" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Description" hint="Shown to patients on the home page.">
            <Textarea rows={3} maxLength={200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        loading={busy}
        title="Delete speciality?"
        confirmLabel="Delete"
        message={deleting && `"${deleting.name}" will be removed. Specialities that still have doctors can't be deleted.`}
      />
    </>
  );
}
