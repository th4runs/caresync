import logoFull from '../assets/logo-full.png';
import { formatDate, formatTime } from '../lib/format';

/** Printable prescription sheet. */
export default function Prescription({ appt, note, patient }) {
  const rows = [
    ['Symptoms', note.symptoms],
    ['Diagnosis', note.diagnosis],
    ['Advice & notes', note.notes],
  ].filter(([, v]) => v);
  return (
    <div className="print-area bg-white border border-line rounded-xl p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-brand-600">
        <img src={logoFull} alt="CareSync" className="h-12 w-auto self-start" />
        <div className="sm:text-right text-sm">
          <p className="font-semibold text-base">{appt.doctorName}</p>
          <p className="text-ink-muted">{appt.doctor?.qualification || appt.specialization}</p>
          <p className="text-ink-muted">24, Anna Salai, Puducherry 605001</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-b border-line text-sm">
        <div>
          <p className="text-ink-muted text-xs">Patient</p>
          <p className="font-medium">{patient?.name || appt.patientName}</p>
        </div>
        <div>
          <p className="text-ink-muted text-xs">Age / Gender</p>
          <p className="font-medium">
            {appt.patientAge ?? '—'} {appt.patientGender ? `/ ${appt.patientGender}` : ''}
          </p>
        </div>
        <div>
          <p className="text-ink-muted text-xs">Visit date</p>
          <p className="font-medium">
            {formatDate(appt.date)}, {formatTime(appt.time)}
          </p>
        </div>
        <div>
          <p className="text-ink-muted text-xs">Booking ID</p>
          <p className="font-medium">CS-{String(appt.id).padStart(5, '0')}</p>
        </div>
      </div>

      <div className="py-5 space-y-4 text-sm">
        {rows.map(([k, v]) => (
          <div key={k}>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{k}</p>
            <p className="mt-1 whitespace-pre-line">{v}</p>
          </div>
        ))}
        {note.prescription && (
          <div>
            <p className="text-2xl font-semibold text-brand-700 leading-none mb-2 font-serif">Rx</p>
            <div className="rounded-lg bg-canvas border border-line px-4 py-3 whitespace-pre-line leading-7">{note.prescription}</div>
          </div>
        )}
        {note.followUpDate && (
          <p>
            <span className="text-ink-muted">Follow-up on: </span>
            <span className="font-medium">{formatDate(note.followUpDate)}</span>
          </p>
        )}
      </div>

      <div className="flex justify-between items-end pt-8 text-sm">
        <p className="text-xs text-ink-muted max-w-xs">This is a digitally generated prescription from CareSync. Take medicines only as advised.</p>
        <div className="text-right">
          <div className="w-40 border-t border-ink/30 mb-1" />
          <p className="font-medium">{appt.doctorName}</p>
        </div>
      </div>
    </div>
  );
}
