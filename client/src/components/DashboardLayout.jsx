import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, CalendarDays, ClipboardList, FileText, LayoutDashboard, LogOut, Menu, Search, Stethoscope, Tags, User, Users, X, CalendarClock, Star, Mail, MonitorPlay,
} from 'lucide-react';
import Logo from './Logo';
import { Avatar, cx } from './ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useSocketEvent } from '../lib/socket';
import { useToast } from '../context/ToastContext';
import { timeAgo } from '../lib/format';

const NAV = {
  PATIENT: [
    { to: '/patient', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/patient/doctors', label: 'Find Doctors', icon: Search },
    { to: '/patient/appointments', label: 'My Appointments', icon: CalendarDays },
    { to: '/patient/history', label: 'Medical History', icon: FileText },
    { to: '/patient/profile', label: 'Profile', icon: User },
  ],
  DOCTOR: [
    { to: '/doctor', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/doctor/appointments', label: 'Appointments', icon: CalendarDays },
    { to: '/doctor/profile', label: 'Profile & Availability', icon: CalendarClock },
  ],
  ADMIN: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/doctors', label: 'Doctors', icon: Stethoscope },
    { to: '/admin/patients', label: 'Patients', icon: Users },
    { to: '/admin/appointments', label: 'Appointments', icon: ClipboardList },
    { to: '/admin/specializations', label: 'Specializations', icon: Tags },
    { to: '/admin/reviews', label: 'Reviews', icon: Star },
    { to: '/admin/messages', label: 'Email & SMS log', icon: Mail },
  ],
};

const MOBILE_TABS = {
  PATIENT: [
    { to: '/patient', label: 'Home', icon: LayoutDashboard, end: true },
    { to: '/patient/doctors', label: 'Doctors', icon: Search },
    { to: '/patient/appointments', label: 'Visits', icon: CalendarDays },
    { to: '/patient/profile', label: 'Profile', icon: User },
  ],
};

const ROLE_LABEL = { PATIENT: 'Patient', DOCTOR: 'Doctor', ADMIN: 'Administrator' };

function NavItems({ items, onNavigate }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14.5px] font-medium transition-colors',
              isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-canvas hover:text-ink',
            )
          }
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function useClickOutside(ref, onOutside) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onOutside();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOutside]);
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });
  const ref = useRef(null);
  const navigate = useNavigate();
  useClickOutside(ref, () => setOpen(false));

  const toast = useToast();
  const load = () => api.get('/notifications').then(setData).catch(() => {});
  useSocketEvent('notification', (n) => {
    setData((d) => ({ unread: d.unread + 1, items: [n, ...d.items].slice(0, 20) }));
    toast.success(n.message);
  });
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const toggle = () => {
    setOpen((o) => !o);
    if (!open) load();
  };
  const markAll = async () => {
    await api.patch('/notifications/read-all').catch(() => {});
    setData((d) => ({ unread: 0, items: d.items.map((i) => ({ ...i, isRead: true })) }));
  };
  const openItem = async (n) => {
    setOpen(false);
    if (!n.isRead) {
      api.patch(`/notifications/${n.id}/read`).catch(() => {});
      setData((d) => ({ unread: Math.max(0, d.unread - 1), items: d.items.map((i) => (i.id === n.id ? { ...i, isRead: true } : i)) }));
    }
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative h-10 w-10 rounded-lg flex items-center justify-center text-ink-soft hover:bg-canvas" aria-label="Notifications">
        <Bell className="h-5 w-5" strokeWidth={1.8} />
        {data.unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {data.unread > 9 ? '9+' : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] card shadow-pop z-40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="font-semibold text-sm">Notifications</p>
            {data.unread > 0 && (
              <button onClick={markAll} className="text-sm text-brand-600 hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {data.items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">You're all caught up.</p>
            ) : (
              data.items.map((n) => (
                <button key={n.id} onClick={() => openItem(n)} className={cx('w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-canvas flex gap-3', !n.isRead && 'bg-brand-50/50')}>
                  <span className={cx('mt-1.5 h-2 w-2 rounded-full shrink-0', n.isRead ? 'bg-transparent' : 'bg-brand-600')} />
                  <span>
                    <span className="block text-sm text-ink leading-snug">{n.message}</span>
                    <span className="block text-xs text-ink-muted mt-1">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useClickOutside(ref, () => setOpen(false));
  const profilePath = { PATIENT: '/patient/profile', DOCTOR: '/doctor/profile', ADMIN: null }[user.role];

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 rounded-lg pl-1.5 pr-2 py-1.5 hover:bg-canvas">
        <Avatar name={user.name} size="sm" />
        <span className="hidden md:block text-left leading-tight">
          <span className="block text-sm font-medium">{user.name}</span>
          <span className="block text-xs text-ink-muted">{ROLE_LABEL[user.role]}</span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 card shadow-pop z-40 py-1.5">
          <div className="px-4 py-2 border-b border-line mb-1">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-ink-muted truncate">{user.email}</p>
          </div>
          {profilePath && (
            <button onClick={() => { setOpen(false); navigate(profilePath); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-ink-soft hover:bg-canvas">
              <User className="h-4 w-4" /> My profile
            </button>
          )}
          <button onClick={() => { logout(); navigate('/login'); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const items = NAV[user.role];
  const tabs = MOBILE_TABS[user.role];

  useEffect(() => {
    setDrawer(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-white border-r border-line no-print">
        <div className="h-16 flex items-center px-6 border-b border-line">
          <Logo to={items[0].to} className="h-7" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavItems items={items} />
        </div>
        <div className="p-3 border-t border-line">
          {user.role !== 'PATIENT' && (
            <a href="/display" target="_blank" rel="noreferrer" className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14.5px] font-medium text-ink-soft hover:bg-canvas hover:text-ink">
              <MonitorPlay className="h-[18px] w-[18px]" strokeWidth={1.9} /> Waiting-room screen
            </a>
          )}
          <button onClick={() => { logout(); navigate('/login'); }} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14.5px] font-medium text-ink-soft hover:bg-canvas hover:text-ink">
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.9} /> Log out
          </button>
        </div>
      </aside>

      {/* Mobile drawer (doctor/admin) */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 no-print">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white flex flex-col">
            <div className="h-16 flex items-center justify-between px-5 border-b border-line">
              <Logo to={items[0].to} className="h-7" />
              <button onClick={() => setDrawer(false)} className="p-2 -mr-2 text-ink-muted" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <NavItems items={items} />
            </div>
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-sm border-b border-line no-print">
          <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 lg:hidden">
              {!tabs && (
                <button onClick={() => setDrawer(true)} className="p-2 -ml-2 text-ink-soft" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </button>
              )}
              <Logo to={items[0].to} className="h-6" />
            </div>
            <p className="hidden lg:block text-sm text-ink-muted">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}
            </p>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <UserMenu />
            </div>
          </div>
        </header>

        <main className={cx('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8', tabs && 'pb-24 lg:pb-8')}>
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tabs (patient) */}
      {tabs && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-line grid grid-cols-4 pb-[env(safe-area-inset-bottom)] no-print">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-brand-600' : 'text-ink-muted')}>
              <Icon className="h-5 w-5" strokeWidth={1.9} />
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
