import { useEffect, useState } from 'react';
import { Alert, Button, Modal, Spinner } from './ui';
import SlotPicker from './SlotPicker';
import { api } from '../lib/api';
import { formatDate, formatTime } from '../lib/format';
import { useToast } from '../context/ToastContext';

export default function RescheduleModal({ appt, onClose, onDone }) {
  const toast = useToast();
  const [availability, setAvailability] = useState(null);
  const [pick, setPick] = useState({ date: appt.date, time: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get(`/doctors/${appt.doctorId}`).then((d) => setAvailability(d.availability)).catch(() => setAvailability([]));
  }, [appt.doctorId]);

  const save = async () => {
    setErr('');
    setSaving(true);
    try {
      await api.patch(`/patient/appointments/${appt.id}/reschedule`, pick);
      toast.success(`Moved to ${formatDate(pick.date)} at ${formatTime(pick.time)}`);
      onDone();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Reschedule appointment"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!pick.time} loading={saving}>
            Confirm new time
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-muted mb-5">
        Currently booked with <span className="text-ink font-medium">{appt.doctorName}</span> on {formatDate(appt.date)} at {formatTime(appt.time)}.
      </p>
      {availability === null ? (
        <div className="py-10 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <SlotPicker doctorId={appt.doctorId} availability={availability} value={pick} onChange={setPick} />
      )}
      <Alert className="mt-4">{err}</Alert>
    </Modal>
  );
}
