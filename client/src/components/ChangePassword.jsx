import { useState } from 'react';
import { Alert, Button, Card, CardHeader, Field, Input } from './ui';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';

export default function ChangePassword() {
  const toast = useToast();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (f.newPassword.length < 6) return setErr('New password must be at least 6 characters');
    if (f.newPassword !== f.confirm) return setErr('Passwords do not match');
    setSaving(true);
    try {
      await api.put('/auth/password', f);
      toast.success('Password updated');
      setF({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Change password" />
      <form onSubmit={submit} className="px-5 pb-5 space-y-4">
        <Alert>{err}</Alert>
        <Field label="Current password">
          <Input type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} />
        </Field>
        <Field label="New password">
          <Input type="password" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} />
        </Field>
        <Field label="Confirm new password">
          <Input type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
        </Field>
        <Button type="submit" variant="secondary" loading={saving}>
          Update password
        </Button>
      </form>
    </Card>
  );
}
