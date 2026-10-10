import { useEffect, useState } from 'react';
import { CreditCard, ShieldCheck, Smartphone } from 'lucide-react';
import { Alert, Button, Field, Input, Modal, Spinner, cx } from './ui';
import { api } from '../lib/api';
import { rupees } from '../lib/format';
import { useAuth } from '../context/AuthContext';

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => reject(new Error('Could not load the payment page. Check your internet connection.'));
    document.body.appendChild(s);
  });
}

/** Opens Razorpay Checkout, or the built-in demo gateway when Razorpay isn't configured. */
export default function PaymentModal({ payment, appointment, onSuccess, onClose }) {
  const { user } = useAuth();
  const [method, setMethod] = useState('upi');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isDemo = payment.provider === 'DEMO';

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    setBusy(true);
    loadRazorpay()
      .then((Razorpay) => {
        if (cancelled) return;
        const rzp = new Razorpay({
          key: payment.keyId,
          amount: payment.amount * 100,
          currency: 'INR',
          order_id: payment.orderId,
          name: 'CareSync',
          description: `Consultation with ${appointment.doctorName}`,
          prefill: { name: user.name, email: user.email, contact: user.phone || '' },
          theme: { color: '#1669d6' },
          handler: async (resp) => {
            try {
              await api.post(`/patient/payments/${payment.paymentId}/verify`, resp);
              onSuccess();
            } catch (e) {
              setErr(e.message);
              setBusy(false);
            }
          },
          modal: { ondismiss: () => !cancelled && onClose() },
        });
        rzp.on('payment.failed', (r) => {
          setErr(r.error?.description || 'Payment failed. Please try again.');
          setBusy(false);
        });
        rzp.open();
      })
      .catch((e) => {
        setErr(e.message);
        setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const payDemo = async (outcome) => {
    setErr('');
    setBusy(true);
    try {
      await api.post(`/patient/payments/${payment.paymentId}/demo`, { outcome });
      onSuccess();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  if (!isDemo) {
    return (
      <Modal open onClose={onClose} title="Complete payment" size="sm">
        {err ? (
          <>
            <Alert>{err}</Alert>
            <p className="text-sm text-ink-muted mt-3">Your slot is held for 15 minutes. You can retry from the appointment page.</p>
          </>
        ) : (
          <div className="py-8 flex flex-col items-center gap-3 text-sm text-ink-muted">
            <Spinner /> Opening secure Razorpay checkout…
          </div>
        )}
      </Modal>
    );
  }

  return (
    <Modal open onClose={busy ? undefined : onClose} title="Secure payment" size="sm">
      <div className="rounded-lg bg-canvas px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-muted">Consultation fee</p>
          <p className="text-sm font-medium">{appointment.doctorName}</p>
        </div>
        <p className="text-xl font-semibold">{rupees(payment.amount)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        {[
          ['upi', 'UPI', Smartphone],
          ['card', 'Card', CreditCard],
        ].map(([k, label, Icon]) => (
          <button key={k} type="button" onClick={() => setMethod(k)} className={cx('h-11 rounded-lg border flex items-center justify-center gap-2 text-sm font-medium', method === k ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-ink-soft')}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {method === 'upi' ? (
          <Field label="UPI ID">
            <Input defaultValue="kavya@okaxis" />
          </Field>
        ) : (
          <>
            <Field label="Card number">
              <Input defaultValue="4111 1111 1111 1111" inputMode="numeric" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expiry">
                <Input defaultValue="12/29" />
              </Field>
              <Field label="CVV">
                <Input defaultValue="123" type="password" />
              </Field>
            </div>
          </>
        )}
      </div>

      <Alert className="mt-4">{err}</Alert>
      <Button className="w-full mt-4" loading={busy} onClick={() => payDemo('success')}>
        Pay {rupees(payment.amount)}
      </Button>
      <div className="flex items-center justify-between mt-3">
        <p className="flex items-center gap-1.5 text-xs text-ink-muted">
          <ShieldCheck className="h-3.5 w-3.5" /> Test mode · no real money is charged
        </p>
        <button type="button" disabled={busy} onClick={() => payDemo('fail')} className="text-xs text-ink-muted underline hover:text-ink">
          Simulate failure
        </button>
      </div>
    </Modal>
  );
}
