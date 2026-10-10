import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../../components/AuthShell';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', age: '', gender: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Enter your full name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address';
    if (form.phone && !/^[6-9]\d{9}$/.test(form.phone)) e.phone = 'Enter a valid 10-digit mobile number';
    if (form.age && (form.age < 0 || form.age > 120)) e.age = 'Enter a valid age';
    if (form.password.length < 6) e.password = 'Use at least 6 characters';
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await register({ name: form.name, email: form.email.trim(), phone: form.phone, age: form.age ? Number(form.age) : null, gender: form.gender, password: form.password });
      navigate('/patient', { replace: true });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <AuthShell mode="register" title="Create your account" subtitle="Book and manage appointments in a few taps">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Alert>{error}</Alert>
        <Field label="Full name" required error={errors.name}>
          <Input autoComplete="name" placeholder="e.g. Kavya Raman" value={form.name} onChange={set('name')} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Email address" required error={errors.email}>
            <Input type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Mobile number" error={errors.phone}>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted text-[15px]">+91</span>
              <Input type="tel" inputMode="numeric" maxLength={10} placeholder="98765 43210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} className="pl-12" />
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Age" error={errors.age}>
            <Input type="number" min="0" max="120" placeholder="Years" value={form.age} onChange={set('age')} />
          </Field>
          <Field label="Gender">
            <Select value={form.gender} onChange={set('gender')}>
              <option value="">Select</option>
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Password" required error={errors.password}>
            <Input type="password" autoComplete="new-password" placeholder="At least 6 characters" value={form.password} onChange={set('password')} />
          </Field>
          <Field label="Confirm password" required error={errors.confirm}>
            <Input type="password" autoComplete="new-password" placeholder="Re-enter password" value={form.confirm} onChange={set('confirm')} />
          </Field>
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
        <p className="text-xs text-ink-muted text-center">By signing up you agree to receive appointment updates from CareSync.</p>
      </form>
      <p className="text-sm text-ink-muted mt-5 text-center">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-600 font-medium hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
