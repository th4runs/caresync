import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import AuthShell from '../../components/AuthShell';
import { Alert, Button, Field, Input } from '../../components/ui';
import { HOME_FOR_ROLE, useAuth } from '../../context/AuthContext';

const DEMO = [
  ['Patient', 'patient@caresync.in', 'Patient@123'],
  ['Doctor', 'doctor@caresync.in', 'Doctor@123'],
  ['Admin', 'admin@caresync.in', 'Admin@123'],
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e, creds = form) => {
    e?.preventDefault();
    setError('');
    if (!creds.email || !creds.password) return setError('Please enter your email and password');
    setLoading(true);
    try {
      const user = await login(creds.email.trim(), creds.password);
      const next = params.get('next');
      navigate(next && (next.startsWith(HOME_FOR_ROLE[user.role]) || next.startsWith('/visit/')) ? next : HOME_FOR_ROLE[user.role], { replace: true });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <AuthShell mode="login" title="Welcome back" subtitle="Log in to your CareSync account">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Alert>{error}</Alert>
        <Field label="Email address">
          <Input type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password">
          <div className="relative">
            <Input type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="pr-11" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          Log in
        </Button>
      </form>
      <p className="text-sm text-ink-muted mt-5 text-center">
        New to CareSync?{' '}
        <Link to="/register" className="text-brand-600 font-medium hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-8 pt-6 border-t border-line">
        <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-3">Demo accounts</p>
        <div className="grid grid-cols-3 gap-2">
          {DEMO.map(([role, email, password]) => (
            <button key={role} type="button" disabled={loading} onClick={() => submit(null, { email, password })} className="h-10 rounded-lg border border-line text-sm font-medium text-ink-soft hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-colors disabled:opacity-60">
              {role}
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}
