import { useEffect, useState } from 'react';
import { Alert, Avatar, Button, Card, EmptyState, ErrorState, Field, Input, PageHeader, PageLoader, RatingInline, Stars, Tabs, Textarea, Toggle } from '../../components/ui';
import ScheduleEditor from '../../components/ScheduleEditor';
import ChangePassword from '../../components/ChangePassword';
import { useFetch } from '../../lib/useFetch';
import { api } from '../../lib/api';
import { formatDate, rupees } from '../../lib/format';
import { useToast } from '../../context/ToastContext';

export default function DoctorOwnProfile() {
  const toast = useToast();
  const [tab, setTab] = useState('schedule');
  const { data, loading, error, reload } = useFetch('/doctor/profile');
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setF({ phone: data.phone || '', qualification: data.qualification || '', languages: data.languages || '', bio: data.bio || '', videoEnabled: data.videoEnabled });
  }, [data]);

  if (loading || (!f && !error)) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      await api.put('/doctor/profile', f);
      toast.success('Profile updated');
      reload();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Profile & availability" subtitle="Manage your public profile, weekly hours and leave days." />
      <Card className="p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <Avatar name={data.name} src={data.photoUrl} size="lg" />
        <div className="flex-1">
          <p className="font-semibold text-lg">{data.name}</p>
          <p className="text-sm text-brand-700">{data.specialization}</p>
          <p className="text-sm text-ink-muted">
            {data.experience} years experience · Consultation fee {rupees(data.fee)}
          </p>
          <RatingInline rating={data.rating} count={data.reviewCount} className="mt-1" />
        </div>
        <p className="text-xs text-ink-muted sm:max-w-[200px]">Fee, speciality and photo are managed by the clinic admin.</p>
      </Card>

      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'schedule', label: 'Availability' },
          { value: 'profile', label: 'Profile' },
          { value: 'reviews', label: 'Reviews', count: data.reviewCount },
          { value: 'security', label: 'Password' },
        ]}
      />

      {tab === 'schedule' && <ScheduleEditor basePath="/doctor" />}
      {tab === 'profile' && (
        <Card className="max-w-3xl">
          <form onSubmit={save} className="p-5 space-y-4">
            <Alert>{err}</Alert>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Qualification" required>
                <Input value={f.qualification} onChange={(e) => setF({ ...f, qualification: e.target.value })} />
              </Field>
              <Field label="Mobile number">
                <Input type="tel" maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} />
              </Field>
            </div>
            <Field label="Languages spoken" hint="Separate with commas">
              <Input value={f.languages} onChange={(e) => setF({ ...f, languages: e.target.value })} placeholder="Tamil, English" />
            </Field>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-line px-4 py-3">
              <div>
                <p className="font-medium text-sm">Offer video consultations</p>
                <p className="text-sm text-ink-muted">Patients can book online consultations with you from home.</p>
              </div>
              <Toggle checked={f.videoEnabled} onChange={(v) => setF({ ...f, videoEnabled: v })} label="Offer video consultations" />
            </div>
            <Field label="About you" hint="Shown to patients on your profile.">
              <Textarea rows={5} maxLength={800} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={saving}>
                Save profile
              </Button>
            </div>
          </form>
        </Card>
      )}
      {tab === 'reviews' && <MyReviews />}
      {tab === 'security' && (
        <div className="max-w-md">
          <ChangePassword />
        </div>
      )}
    </>
  );
}

function MyReviews() {
  const { data, loading } = useFetch('/doctor/reviews');
  if (loading) return <PageLoader />;
  if (!data.length) return <Card><EmptyState title="No reviews yet" text="Patients can rate you after a completed visit." /></Card>;
  return (
    <Card className="max-w-3xl">
      <ul className="divide-y divide-line">
        {data.map((r) => (
          <li key={r.id} className="px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <Stars value={r.rating} size="xs" />
              <span className="text-xs text-ink-muted">Visit on {formatDate(r.date)}</span>
            </div>
            {r.comment && <p className="text-sm text-ink-soft mt-1.5">{r.comment}</p>}
            <p className="text-xs text-ink-muted mt-1">{r.patientName}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
