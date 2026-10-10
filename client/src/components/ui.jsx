import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { STATUS, initials } from '../lib/format';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

/* ---------- Buttons ---------- */
const BTN_VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary: 'bg-white text-ink border border-line hover:bg-canvas hover:border-slate-300 disabled:text-ink-muted',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  ghost: 'text-ink-soft hover:bg-canvas hover:text-ink',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
  dangerSolid: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
};
const BTN_SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-[15px] gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export function Button({ variant = 'primary', size = 'md', loading, className, children, to, ...props }) {
  const classes = cx(
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors whitespace-nowrap disabled:cursor-not-allowed',
    BTN_VARIANTS[variant],
    BTN_SIZES[size],
    className,
  );
  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ---------- Form fields ---------- */
export function Field({ label, error, hint, required, children, className }) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {children}
      {error ? <p className="mt-1.5 text-sm text-red-600">{error}</p> : hint ? <p className="mt-1.5 text-sm text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export const Input = ({ className, ...p }) => <input className={cx('input', className)} {...p} />;
export const Textarea = ({ className, rows = 4, ...p }) => <textarea rows={rows} className={cx('input', className)} {...p} />;
export function Select({ className, children, ...p }) {
  return (
    <select className={cx('input appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b768a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p}>
      {children}
    </select>
  );
}

export function Alert({ tone = 'error', children, className }) {
  if (!children) return null;
  const tones = {
    error: 'bg-red-50 text-red-700 border-red-100',
    info: 'bg-brand-50 text-brand-800 border-brand-100',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    warn: 'bg-amber-50 text-amber-800 border-amber-100',
  };
  return <div className={cx('rounded-lg border px-4 py-3 text-sm', tones[tone], className)}>{children}</div>;
}

/* ---------- Display ---------- */
const TONES = {
  blue: 'bg-brand-50 text-brand-700 ring-brand-100',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  red: 'bg-red-50 text-red-700 ring-red-100',
  gray: 'bg-slate-100 text-slate-600 ring-slate-200',
};
export function Badge({ tone = 'gray', children, className }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  );
}
export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, tone: 'gray' };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function Avatar({ name, src, size = 'md', className }) {
  const [failed, setFailed] = useState(false);
  const sizes = { xs: 'h-7 w-7 text-[11px]', sm: 'h-9 w-9 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-16 w-16 text-lg', xl: 'h-24 w-24 text-2xl' };
  if (src && !failed) {
    return <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} className={cx('rounded-full object-cover object-top bg-canvas shrink-0 ring-1 ring-line', sizes[size], className)} />;
  }
  return (
    <div className={cx('rounded-full bg-brand-50 text-brand-700 font-semibold flex items-center justify-center shrink-0 ring-1 ring-inset ring-brand-100', sizes[size], className)}>
      {initials(name)}
    </div>
  );
}

export function Card({ className, children, ...p }) {
  return (
    <div className={cx('card', className)} {...p}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action, subtitle }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
      <div>
        <h3 className="text-base">{title}</h3>
        {subtitle && <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action, back }) {
  return (
    <div className="mb-6">
      {back}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] sm:text-2xl">{title}</h1>
          {subtitle && <p className="text-ink-muted mt-1">{subtitle}</p>}
        </div>
        {action && <div className="flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">{label}</p>
          <p className="text-2xl font-semibold mt-1.5 tabular-nums">{value}</p>
          {hint && <p className="text-xs text-ink-muted mt-1">{hint}</p>}
        </div>
        {Icon && (
          <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </div>
        )}
      </div>
    </Card>
  );
}

export function Spinner({ className }) {
  return <Loader2 className={cx('h-5 w-5 animate-spin text-brand-600', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

export function EmptyState({ title, text, action, icon: Icon }) {
  return (
    <div className="text-center py-12 px-6">
      {Icon && (
        <div className="mx-auto h-12 w-12 rounded-full bg-canvas flex items-center justify-center text-ink-muted mb-3">
          <Icon className="h-6 w-6" strokeWidth={1.6} />
        </div>
      )}
      <p className="font-medium text-ink">{title}</p>
      {text && <p className="text-sm text-ink-muted mt-1 max-w-sm mx-auto">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <Card className="p-8 text-center">
      <p className="font-medium">Couldn't load this page</p>
      <p className="text-sm text-ink-muted mt-1">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cx('flex gap-1 border-b border-line overflow-x-auto', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
            value === t.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-muted hover:text-ink',
          )}
        >
          {t.label}
          {t.count != null && (
            <span className={cx('ml-2 rounded-full px-2 py-0.5 text-xs', value === t.value ? 'bg-brand-50 text-brand-700' : 'bg-canvas text-ink-muted')}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" className={cx('relative bg-white w-full rounded-t-2xl sm:rounded-xl shadow-pop max-h-[92vh] flex flex-col', widths[size])}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h3 className="text-base">{title}</h3>
          <button onClick={onClose} className="p-1.5 -mr-1.5 rounded-md text-ink-muted hover:bg-canvas" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-line flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'danger', loading }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Go back
          </Button>
          <Button variant={tone === 'danger' ? 'dangerSolid' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-ink-soft">{message}</p>
    </Modal>
  );
}

/* ---------- Table wrapper ---------- */
export function TableCard({ children, footer }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">{children}</div>
      {footer}
    </Card>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search', className }) {
  return (
    <div className={cx('relative', className)}>
      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input pl-10" />
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-brand-600' : 'bg-slate-300')}
    >
      <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

/* ---------- Ratings ---------- */
const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';

export function Stars({ value = 0, size = 'sm', className }) {
  const px = { xs: 12, sm: 14, md: 18, lg: 22 }[size];
  return (
    <span className={cx('inline-flex items-center gap-0.5', className)} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <svg key={i} width={px} height={px} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <linearGradient id={`star-${i}-${fill}`}>
                <stop offset={`${fill * 100}%`} stopColor="#f5a524" />
                <stop offset={`${fill * 100}%`} stopColor="#e4e9f0" />
              </linearGradient>
            </defs>
            <path d={STAR_PATH} fill={`url(#star-${i}-${fill})`} />
          </svg>
        );
      })}
    </span>
  );
}

export function RatingInline({ rating, count, className }) {
  if (!count) return <span className={cx('text-sm text-ink-muted', className)}>New on CareSync</span>;
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-sm', className)}>
      <Stars value={rating} size="xs" />
      <span className="font-medium">{rating.toFixed(1)}</span>
      <span className="text-ink-muted">({count})</span>
    </span>
  );
}

export function StarInput({ value, onChange }) {
  const labels = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} onClick={() => onChange(i)} className="p-0.5">
            <svg width="30" height="30" viewBox="0 0 24 24">
              <path d={STAR_PATH} fill={i <= value ? '#f5a524' : '#e4e9f0'} className="transition-colors" />
            </svg>
          </button>
        ))}
      </div>
      {value > 0 && <span className="text-sm font-medium text-ink-soft">{labels[value]}</span>}
    </div>
  );
}

export function RadioCard({ checked, onChange, title, text, disabled, children }) {
  return (
    <label className={cx('flex gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors', checked ? 'border-brand-500 bg-brand-50/60' : 'border-line hover:border-slate-300', disabled && 'opacity-50 cursor-not-allowed')}>
      <input type="radio" className="mt-1 accent-brand-600" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="flex-1">
        <span className="block font-medium text-[15px]">{title}</span>
        {text && <span className="block text-sm text-ink-muted mt-0.5">{text}</span>}
        {children}
      </span>
    </label>
  );
}
