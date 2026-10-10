import { useState } from 'react';
import { Star } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, PageLoader, Select, Stars } from '../../components/ui';
import { useFetch } from '../../lib/useFetch';
import { api, qs } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useToast } from '../../context/ToastContext';

export default function ManageReviews() {
  const toast = useToast();
  const [rating, setRating] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const { data: doctors } = useFetch('/admin/doctors');
  const { data, loading, error, reload } = useFetch(`/admin/reviews${qs({ rating, doctorId })}`);

  const toggle = async (r) => {
    try {
      const res = await api.patch(`/admin/reviews/${r.id}`, { isHidden: !r.isHidden });
      toast.success(res.message);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const avg = data?.length ? data.filter((r) => !r.isHidden).reduce((s, r) => s + r.rating, 0) / Math.max(1, data.filter((r) => !r.isHidden).length) : 0;

  return (
    <>
      <PageHeader title="Reviews" subtitle="Patient ratings after completed visits. Hide reviews that break the guidelines." />
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="sm:w-64">
          <option value="">All doctors</option>
          {doctors?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select value={rating} onChange={(e) => setRating(e.target.value)} className="sm:w-44">
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} star{n > 1 ? 's' : ''}
            </option>
          ))}
        </Select>
        {data?.length > 0 && (
          <p className="sm:ml-auto self-center text-sm text-ink-muted flex items-center gap-2">
            <Stars value={avg} size="xs" /> {avg.toFixed(1)} average · {data.length} reviews
          </p>
        )}
      </div>
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data.length ? (
        <Card>
          <EmptyState icon={Star} title="No reviews match" />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {data.map((r) => (
              <li key={r.id} className={`px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3 ${r.isHidden ? 'bg-canvas/70' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} size="xs" />
                    <span className="text-sm font-medium">{r.doctorName}</span>
                    {r.isHidden && <Badge tone="gray">Hidden</Badge>}
                  </div>
                  {r.comment ? <p className={`text-sm mt-1.5 ${r.isHidden ? 'text-ink-muted line-through' : 'text-ink-soft'}`}>{r.comment}</p> : <p className="text-sm text-ink-muted mt-1.5">No comment</p>}
                  <p className="text-xs text-ink-muted mt-1">
                    {r.patientName} · visit on {formatDate(r.date)}
                  </p>
                </div>
                <Button size="sm" variant={r.isHidden ? 'secondary' : 'ghost'} onClick={() => toggle(r)}>
                  {r.isHidden ? 'Show again' : 'Hide'}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
