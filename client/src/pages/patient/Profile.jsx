import { useEffect, useState } from 'react';
import { Alert, Avatar, Button, Card, CardHeader, ErrorState, Field, Input, PageHeader, PageLoader, Select, Textarea } from '../../components/ui';
import ChangePassword from '../../components/ChangePassword';
import { useFetch } from '../../lib/useFetch';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function PatientProfile() {
  const { refresh } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/patient/profile');
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setF({ name: data.name || '', phone: data.phone || '', age: data.age ?? '', gender: data.gender || '', bloodGroup: data.bloodGroup || '', address: data.address || '' });
  }, [data]);

  if (loading || (!f && !error)) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      await api.put('/patient/profile', { ...f, age: f.age === '' ? null : Number(f.age) });
      toast.success('Profile updated');
      refresh();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="My profile" subtitle="Keep your details up to date so doctors have the right information." />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <Card>
          <div className="flex items-center gap-4 p-5 border-b border-line">
            <Avatar name={f.name} size="lg" />
            <div>
              <p className="font-semibold text-lg">{data.name}</p>
              <p className="text-sm text-ink-muted">{data.email}</p>
            </div>
          </div>
          <form onSubmit={save} className="p-5 space-y-4">
            <Alert>{err}</Alert>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full name" required>
                <Input value={f.name} onChange={set('name')} />
              </Field>
              <Field label="Mobile number">
                <Input type="tel" maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field label="Email" hint="Contact the clinic to change your email.">
                <Input value={data.email} disabled />
              </Field>
              <Field label="Age">
                <Input type="number" min="0" max="120" value={f.age} onChange={set('age')} />
              </Field>
              <Field label="Gender">
                <Select value={f.gender} onChange={set('gender')}>
                  <option value="">Select</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                </Select>
              </Field>
              <Field label="Blood group">
                <Select value={f.bloodGroup} onChange={set('bloodGroup')}>
                  <option value="">Select</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Address">
              <Textarea rows={2} value={f.address} onChange={set('address')} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={saving}>
                Save changes
              </Button>
            </div>
          </form>
        </Card>
        <div className="space-y-6">
          <ChangePassword />
          <Card>
            <CardHeader title="Account" />
            <p className="px-5 pb-5 text-sm text-ink-muted">
              Member since {new Date(data.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
