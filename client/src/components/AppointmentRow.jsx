import { Link } from 'react-router-dom';
import { CalendarDays, Clock, Video } from 'lucide-react';
import { Avatar, Badge, StatusBadge } from './ui';
import { formatTime, relativeDay } from '../lib/format';

/** Patient-facing appointment summary. */
export default function AppointmentRow({ appt, actions, to }) {
  const body = (
    <div className="flex items-start gap-4">
      <Avatar name={appt.doctorName} src={appt.doctorPhoto} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-semibold mr-1">{appt.doctorName}</p>
          {appt.paymentStatus === 'PENDING' && appt.status === 'SCHEDULED' ? <Badge tone="amber">Payment pending</Badge> : <StatusBadge status={appt.status} />}
          {appt.mode === 'VIDEO' && (
            <Badge tone="blue" className="gap-1">
              <Video className="h-3 w-3" /> Video
            </Badge>
          )}
          {appt.tokenNo && appt.status !== 'CANCELLED' && <Badge tone="gray">Token {appt.tokenNo}</Badge>}
        </div>
        <p className="text-sm text-ink-muted">{appt.specialization}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-ink-muted" /> {relativeDay(appt.date)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-ink-muted" /> {formatTime(appt.time)}
          </span>
        </div>
        {appt.doctorDelay > 0 && appt.status === 'SCHEDULED' && <p className="text-sm text-amber-700 mt-1.5">Doctor running ~{appt.doctorDelay} min late today</p>}
        {appt.transferredFromName && appt.status === 'SCHEDULED' && <p className="text-sm text-brand-700 mt-1.5">Moved from {appt.transferredFromName}</p>}
      </div>
    </div>
  );
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5">
      <div className="flex-1 min-w-0">{to ? <Link to={to} className="block hover:opacity-90">{body}</Link> : body}</div>
      {actions && <div className="flex flex-wrap gap-2 sm:shrink-0 pl-[60px] sm:pl-0">{actions}</div>}
    </div>
  );
}
