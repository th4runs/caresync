import { useState } from 'react';
import { Alert, Button, Card, CardHeader, StarInput, Stars, Textarea } from './ui';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';

export default function ReviewForm({ appt, review, onDone }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (review) {
    return (
      <Card>
        <CardHeader title="Your review" />
        <div className="px-5 pb-5">
          <Stars value={review.rating} size="md" />
          {review.comment && <p className="text-sm text-ink-soft mt-2">"{review.comment}"</p>}
        </div>
      </Card>
    );
  }

  const submit = async () => {
    if (!rating) return setErr('Please choose a star rating');
    setErr('');
    setBusy(true);
    try {
      await api.post(`/patient/appointments/${appt.id}/review`, { rating, comment });
      toast.success('Thank you for your feedback');
      onDone?.();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title={`How was your visit with ${appt.doctorName}?`} subtitle="Your rating helps other patients choose the right doctor." />
      <div className="px-5 pb-5 space-y-3">
        <StarInput value={rating} onChange={setRating} />
        <Textarea rows={3} maxLength={600} placeholder="Share what went well or what could be better (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
        <Alert>{err}</Alert>
        <Button onClick={submit} loading={busy}>
          Submit review
        </Button>
      </div>
    </Card>
  );
}
