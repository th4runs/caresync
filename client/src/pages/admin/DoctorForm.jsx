import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Avatar, Button, Card, CardHeader, ErrorState, Field, Input, PageHeader, PageLoader, Select, Tabs, Textarea, Toggle } from '../../components/ui';
import ScheduleEditor from '../../components/ScheduleEditor';
import { BackLink } from '../patient/DoctorProfile';
import { useFetch } from '../../lib/useFetch';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

const EMPTY = { name: '', email: '', phone: '', password: '', specializationId: '', qualification: '', experience: '', fee: '', languages: '', bio: '', photoUrl: '', videoEnabled: true };

export default function DoctorForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const { data: specs } = useFetch('/specializations');
  const { data: doctor, loading, error, reload } = useFetch(isEdit ? `/admin/doctors/${id}` : null);
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState('details');
  const fileRef = useRef(null);

  useEffect(() => {
    if (doctor) {
      setF({
        ...EMPTY,
        ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, doctor[k] ?? ''])),
        password: '',
      });
    }
  }, [doctor]);

  if (isEdit && loading) return <PageLoader />;
  if (isEdit && error) return <ErrorState message={error} onRetry={reload} />;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const validate = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Enter a valid email';
    if (f.phone && !/^[6-9]\d{9}$/.test(f.phone)) e.phone = 'Enter a valid 10-digit number';
    if (!isEdit && f.password.length < 6) e.password = 'At least 6 characters';
    if (isEdit && f.password && f.password.length < 6) e.password = 'At least 6 characters';
    if (!f.specializationId) e.specializationId = 'Choose a speciality';
    if (!f.qualification.trim()) e.qualification = 'Required';
    if (f.experience === '' || f.experience < 0) e.experience = 'Required';
    if (f.fee === '' || f.fee < 0) e.fee = 'Required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const upload = async (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error('Image must be under 2 MB');
    const fd = new FormData();
    fd.append('photo', file);
    setUploading(true);
    try {
      const { url } = await api.post('/uploads', fd);
      setF((x) => ({ ...x, photoUrl: url }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!validate()) return;
    setSaving(true);
    try {
      const body = { ...f, experience: Number(f.experience), fee: Number(f.fee) };
      if (isEdit) {
        await api.put(`/admin/doctors/${id}`, body);
        toast.success('Doctor updated');
        reload();
      } else {
        const d = await api.post('/admin/doctors', body);
        toast.success(`${d.name} added with default hours (Mon–Sat)`);
        navigate(`/admin/doctors/${d.id}/edit`, { replace: true });
      }
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <BackLink to="/admin/doctors">Doctors</BackLink>
      <PageHeader title={isEdit ? `Edit ${doctor?.name}` : 'Add doctor'} subtitle={isEdit ? 'Update details or manage this doctor\'s schedule.' : 'Create a login for the doctor and set up their profile.'} />

      {isEdit && (
        <Tabs
          className="mb-6"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'details', label: 'Details' },
            { value: 'schedule', label: 'Schedule & leave' },
          ]}
        />
      )}

      {tab === 'schedule' && isEdit ? (
        <ScheduleEditor basePath={`/admin/doctors/${id}`} />
      ) : (
        <form onSubmit={submit} noValidate className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
          <div className="space-y-6">
            <Alert>{err}</Alert>
            <Card>
              <CardHeader title="Account" />
              <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full name" required error={errors.name}>
                  <Input placeholder="Dr. Firstname Lastname" value={f.name} onChange={set('name')} />
                </Field>
                <Field label="Email" required error={errors.email}>
                  <Input type="email" placeholder="name@caresync.in" value={f.email} onChange={set('email')} />
                </Field>
                <Field label="Mobile number" error={errors.phone}>
                  <Input type="tel" maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} />
                </Field>
                <Field label={isEdit ? 'New password' : 'Password'} required={!isEdit} error={errors.password} hint={isEdit ? 'Leave blank to keep the current password' : 'Share this with the doctor to log in'}>
                  <Input type="password" autoComplete="new-password" value={f.password} onChange={set('password')} />
                </Field>
              </div>
            </Card>
            <Card>
              <CardHeader title="Professional details" />
              <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Speciality" required error={errors.specializationId}>
                  <Select value={f.specializationId} onChange={set('specializationId')}>
                    <option value="">Select speciality</option>
                    {specs?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Qualification" required error={errors.qualification}>
                  <Input placeholder="e.g. MBBS, MD" value={f.qualification} onChange={set('qualification')} />
                </Field>
                <Field label="Experience (years)" required error={errors.experience}>
                  <Input type="number" min="0" max="60" value={f.experience} onChange={set('experience')} />
                </Field>
                <Field label="Consultation fee (₹)" required error={errors.fee}>
                  <Input type="number" min="0" step="50" value={f.fee} onChange={set('fee')} />
                </Field>
                <Field label="Languages" className="sm:col-span-2">
                  <Input placeholder="Tamil, English" value={f.languages} onChange={set('languages')} />
                </Field>
                <div className="sm:col-span-2 flex items-center justify-between gap-4 rounded-lg border border-line px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">Video consultations</p>
                    <p className="text-sm text-ink-muted">Allow patients to book online video visits with this doctor.</p>
                  </div>
                  <Toggle checked={f.videoEnabled !== false} onChange={(v) => setF({ ...f, videoEnabled: v })} label="Video consultations" />
                </div>
                <Field label="Bio" className="sm:col-span-2">
                  <Textarea rows={4} maxLength={800} placeholder="A short introduction shown to patients" value={f.bio} onChange={set('bio')} />
                </Field>
              </div>
            </Card>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" to="/admin/doctors">
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {isEdit ? 'Save changes' : 'Add doctor'}
              </Button>
            </div>
          </div>

          <Card className="p-5 text-center lg:sticky lg:top-24">
            <p className="font-medium text-left mb-4">Photo</p>
            <Avatar name={f.name || 'Doctor'} src={f.photoUrl} size="xl" className="mx-auto" />
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files[0])} />
            <div className="flex justify-center gap-2 mt-4">
              <Button type="button" size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current.click()}>
                {f.photoUrl ? 'Change photo' : 'Upload photo'}
              </Button>
              {f.photoUrl && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setF({ ...f, photoUrl: '' })}>
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-ink-muted mt-3">JPG, PNG or WebP, up to 2 MB. A square photo works best.</p>
          </Card>
        </form>
      )}
    </>
  );
}
