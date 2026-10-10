import { useState } from 'react';
import { Mail, MessageSquareText } from 'lucide-react';
import { Alert, Badge, Card, EmptyState, ErrorState, PageHeader, PageLoader, SearchInput, Select, TableCard } from '../../components/ui';
import { useDebounced, useFetch } from '../../lib/useFetch';
import { qs } from '../../lib/api';
import { timeAgo } from '../../lib/format';

const STATUS_TONE = { SENT: 'green', FAILED: 'red', LOGGED: 'gray' };

export default function MessageLog() {
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('');
  const q = useDebounced(search);
  const { data, loading, error, reload } = useFetch(`/admin/messages${qs({ search: q, channel })}`);

  return (
    <>
      <PageHeader title="Email & SMS log" subtitle="Confirmations, reminders, waitlist alerts and doctor-unavailable notices sent to patients." />
      {data && (!data.providers.email || !data.providers.sms) && (
        <Alert tone="info" className="mb-4">
          {!data.providers.email && !data.providers.sms ? 'Email and SMS are' : !data.providers.email ? 'Email is' : 'SMS is'} not connected yet, so messages are recorded here
          instead of being delivered. Add SMTP / Twilio details in <code className="bg-white px-1 rounded">server/.env</code> and restart the server to send them for real.
        </Alert>
      )}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search recipient or message" className="flex-1" />
        <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="sm:w-40">
          <option value="">Email & SMS</option>
          <option value="EMAIL">Email</option>
          <option value="SMS">SMS</option>
        </Select>
      </div>
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data.items.length ? (
        <Card>
          <EmptyState icon={Mail} title="No messages yet" text="Messages appear here when patients book, get reminders or are notified about changes." />
        </Card>
      ) : (
        <TableCard footer={<p className="px-4 py-3 text-sm text-ink-muted border-t border-line">Latest {data.items.length} messages</p>}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Channel</th>
                <th>To</th>
                <th>Message</th>
                <th>Status</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className="inline-flex items-center gap-1.5 text-ink-soft">
                      {m.channel === 'EMAIL' ? <Mail className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />}
                      {m.channel === 'EMAIL' ? 'Email' : 'SMS'}
                    </span>
                  </td>
                  <td>
                    <p className="font-medium whitespace-nowrap">{m.userName || '—'}</p>
                    <p className="text-xs text-ink-muted">{m.recipient}</p>
                  </td>
                  <td className="min-w-[280px] max-w-[460px]">
                    {m.subject && <p className="font-medium">{m.subject}</p>}
                    <p className="text-ink-soft line-clamp-2">{m.body}</p>
                    {m.error && <p className="text-xs text-red-600 mt-1">{m.error}</p>}
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[m.status]}>{m.status === 'LOGGED' ? 'Logged' : m.status === 'SENT' ? 'Sent' : 'Failed'}</Badge>
                  </td>
                  <td className="whitespace-nowrap text-ink-muted">{timeAgo(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}
    </>
  );
}
