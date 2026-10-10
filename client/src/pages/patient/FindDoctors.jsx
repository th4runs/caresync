import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Stethoscope, Video } from 'lucide-react';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, PageHeader, PageLoader, RatingInline, SearchInput, Select } from '../../components/ui';
import { useDebounced, useFetch } from '../../lib/useFetch';
import { qs } from '../../lib/api';
import { rupees } from '../../lib/format';

export default function FindDoctors() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const spec = params.get('spec') || '';
  const sort = params.get('sort') || '';
  const video = params.get('video') || '';
  const q = useDebounced(search);
  const { data: specs } = useFetch('/specializations');
  const { data: doctors, loading, error, reload } = useFetch(`/doctors${qs({ search: q, specializationId: spec, sort, video })}`);

  const update = (k, v) => {
    const p = new URLSearchParams(params);
    v ? p.set(k, v) : p.delete(k);
    setParams(p, { replace: true });
  };
  useEffect(() => update('search', q), [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const specName = specs?.find((s) => String(s.id) === spec)?.name;

  return (
    <>
      <PageHeader title="Find a doctor" subtitle="Browse experienced doctors and book a time that suits you." />

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by doctor name or speciality" className="flex-1" />
        <Select value={spec} onChange={(e) => update('spec', e.target.value)} className="md:w-56">
          <option value="">All specialities</option>
          {specs?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 h-11 px-3.5 rounded-lg border border-line bg-white text-sm whitespace-nowrap cursor-pointer">
          <input type="checkbox" className="accent-brand-600" checked={video === '1'} onChange={(e) => update('video', e.target.checked ? '1' : '')} />
          Video consult
        </label>
        <Select value={sort} onChange={(e) => update('sort', e.target.value)} className="md:w-48">
          <option value="">Sort: Name</option>
          <option value="rating">Highest rated</option>
          <option value="experience">Most experienced</option>
          <option value="fee_low">Fee: Low to high</option>
          <option value="fee_high">Fee: High to low</option>
        </Select>
      </div>

      {specs && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 [scrollbar-width:none]">
          {[{ id: '', name: 'All' }, ...specs].map((s) => (
            <button
              key={s.id}
              onClick={() => update('spec', String(s.id))}
              className={`shrink-0 h-9 px-4 rounded-full text-sm font-medium border transition-colors ${String(s.id) === spec ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-line text-ink-soft hover:border-brand-300'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !doctors.length ? (
        <Card>
          <EmptyState icon={Stethoscope} title="No doctors found" text="Try a different name or choose another speciality." />
        </Card>
      ) : (
        <>
          <p className="text-sm text-ink-muted mb-3">
            {doctors.length} {doctors.length === 1 ? 'doctor' : 'doctors'}
            {specName ? ` in ${specName}` : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {doctors.map((d) => (
              <Card key={d.id} className="p-5 flex flex-col">
                <div className="flex items-start gap-4">
                  <Avatar name={d.name} src={d.photoUrl} size="lg" />
                  <div className="min-w-0">
                    <Link to={`/patient/doctors/${d.id}`} className="font-semibold hover:text-brand-700">
                      {d.name}
                    </Link>
                    <p className="text-sm text-brand-700">{d.specialization}</p>
                    <RatingInline rating={d.rating} count={d.reviewCount} className="mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
                  <div className="rounded-lg bg-canvas px-3 py-2">
                    <p className="text-ink-muted text-xs">Experience</p>
                    <p className="font-medium">{d.experience} years</p>
                  </div>
                  <div className="rounded-lg bg-canvas px-3 py-2">
                    <p className="text-ink-muted text-xs">Consultation fee</p>
                    <p className="font-medium">{rupees(d.fee)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {d.videoEnabled && (
                    <Badge tone="blue" className="gap-1">
                      <Video className="h-3 w-3" /> Video consult
                    </Badge>
                  )}
                  {d.languages && <span className="text-sm text-ink-muted">Speaks {d.languages}</span>}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-5 pt-1 mt-auto">
                  <Button to={`/patient/doctors/${d.id}`} variant="secondary" size="sm" className="mt-4">
                    View profile
                  </Button>
                  <Button to={`/patient/doctors/${d.id}/book`} size="sm" className="mt-4">
                    Book visit
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
