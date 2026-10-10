import { Link } from 'react-router-dom';
import Logo from './Logo';
import { cx } from './ui';
import authPhoto from '../assets/photos/auth.jpg';

export default function AuthShell({ mode, title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <div className="px-4 sm:px-6 h-16 flex items-center max-w-6xl w-full mx-auto">
        <Logo className="h-7" />
      </div>
      <div className="flex-1 flex items-start sm:items-center justify-center px-4 pb-10 pt-2 sm:py-10">
        <div className="w-full max-w-5xl card overflow-hidden grid grid-cols-1 lg:grid-cols-2">
          <div className="hidden lg:block relative min-h-[640px]">
            <img src={authPhoto} alt="A CareSync doctor talking with a patient" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-10 text-white">
              <h2 className="text-3xl leading-tight text-white">Better care, together.</h2>
              <p className="mt-3 text-white/85 max-w-sm">Book visits, consult by video, track your queue token and keep every prescription in one place.</p>
              <p className="mt-6 text-sm text-white/70">Need help? Call +91 413 222 4455</p>
            </div>
          </div>
          <div className="p-6 sm:p-10">
            <div className="grid grid-cols-2 bg-canvas rounded-lg p-1 mb-8">
              {[
                ['login', 'Log in', '/login'],
                ['register', 'Sign up', '/register'],
              ].map(([m, label, to]) => (
                <Link key={m} to={to} className={cx('h-10 rounded-md flex items-center justify-center text-sm font-medium transition-colors', mode === m ? 'bg-white text-ink shadow-card' : 'text-ink-muted hover:text-ink')}>
                  {label}
                </Link>
              ))}
            </div>
            <h1 className="text-2xl">{title}</h1>
            <p className="text-ink-muted mt-1 mb-6">{subtitle}</p>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
