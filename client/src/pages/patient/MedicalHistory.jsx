import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Card, EmptyState, ErrorState, PageHeader, PageLoader, SearchInput } from '../../components/ui';
import { useFetch } from '../../lib/useFetch';
import { formatDate, formatDateShort } from '../../lib/format';

export default function MedicalHistory() {
  const { data, loading, error, reload } = useFetch('/patient/history');
  const [search, setSearch] = useState('');

  const list = (data || []).filter((v) =>
    [v.doctorName, v.specialization, v.diagnosis, v.prescription].join(' ').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeader title="Medical history" subtitle="Diagnoses and prescriptions from your past visits." />
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data.length ? (
        <Card>
          <EmptyState icon={FileText} title="No medical records yet" text="After a consultation, your doctor's notes and prescriptions will be saved here." />
        </Card>
      ) : (
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by doctor, diagnosis or medicine" className="mb-5 max-w-md" />
          <div className="space-y-4">
            {list.map((v) => (
              <Card key={v.id} className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex gap-4">
                    <div className="w-14 shrink-0 rounded-lg bg-brand-50 text-brand-700 text-center py-1.5">
                      <p className="text-lg font-semibold leading-tight">{formatDateShort(v.date).split(' ')[0]}</p>
                      <p className="text-xs">{formatDateShort(v.date).split(' ')[1]}</p>
                    </div>
                    <div>
                      <p className="font-semibold">{v.diagnosis || 'Consultation'}</p>
                      <p className="text-sm text-ink-muted">
                        {v.doctorName} · {v.specialization}
                      </p>
                    </div>
                  </div>
                  <Link to={`/patient/appointments/${v.id}`} className="text-sm text-brand-600 font-medium hover:underline shrink-0">
                    View prescription
                  </Link>
                </div>
                {v.prescription && <p className="mt-4 text-sm text-ink-soft whitespace-pre-line rounded-lg bg-canvas px-4 py-3">{v.prescription}</p>}
                {v.followUpDate && <p className="mt-3 text-sm text-ink-muted">Follow-up advised on {formatDate(v.followUpDate)}</p>}
              </Card>
            ))}
            {!list.length && <p className="text-sm text-ink-muted">No records match "{search}".</p>}
          </div>
        </>
      )}
    </>
  );
}
