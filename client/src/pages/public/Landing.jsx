import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Baby, Bell, Bone, Brain, Clock, CreditCard, Ear, HeartPulse, MapPin, Phone, ScanFace, Stethoscope, Ticket, Venus, Video,
} from 'lucide-react';
import Logo from '../../components/Logo';
import { Button, RatingInline, Select, Stars } from '../../components/ui';
import { api } from '../../lib/api';
import { rupees } from '../../lib/format';
import { HOME_FOR_ROLE, useAuth } from '../../context/AuthContext';
import logoFull from '../../assets/logo-full.png';
import heroPhoto from '../../assets/photos/hero.jpg';
import clinicPhoto from '../../assets/photos/clinic.jpg';
import consultPhoto from '../../assets/photos/consultation.jpg';

const SPEC_ICON = {
  'General Medicine': Stethoscope,
  Dermatology: ScanFace,
  Pediatrics: Baby,
  Orthopedics: Bone,
  Gynecology: Venus,
  Cardiology: HeartPulse,
  ENT: Ear,
  Neurology: Brain,
};

function Header() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-line">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Logo className="h-7 sm:h-8" />
        <nav className="hidden md:flex items-center gap-8 text-[15px] text-ink-soft">
          <a href="#specialities" className="hover:text-ink">Specialities</a>
          <a href="#doctors" className="hover:text-ink">Doctors</a>
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#contact" className="hover:text-ink">Contact</a>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Button to={HOME_FOR_ROLE[user.role]} size="sm" className="sm:h-10 sm:px-4">
              Go to dashboard
            </Button>
          ) : (
            <>
              <Button to="/login" variant="ghost" size="sm" className="sm:h-10 sm:px-4">
                Log in
              </Button>
              <Button to="/register" size="sm" className="sm:h-10 sm:px-4">
                Sign up
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [specs, setSpecs] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [spec, setSpec] = useState('');

  useEffect(() => {
    api.get('/specializations').then(setSpecs).catch(() => {});
    api.get('/doctors?sort=rating').then(setDoctors).catch(() => {});
    api.get('/stats').then(setStats).catch(() => {});
  }, []);

  const onSearch = (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (search.trim()) p.set('search', search.trim());
    if (spec) p.set('spec', spec);
    navigate(`/patient/doctors${p.toString() ? `?${p}` : ''}`);
  };

  return (
    <div className="bg-white">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#f4f6f8]">
        <img src={heroPhoto} alt="" aria-hidden="true" className="hidden lg:block absolute inset-0 h-full w-full object-cover object-[75%_center]" />
        <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-white via-white/85 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-12 sm:pt-16 lg:py-28">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-brand-700">Puducherry's trusted clinic</p>
            <h1 className="mt-3 text-[40px] leading-[1.1] sm:text-[54px] font-bold tracking-tight">
              Your health,
              <br />
              <span className="text-brand-600">our priority.</span>
            </h1>
            <p className="mt-5 text-lg text-ink-soft">Book a clinic visit or a video consultation with experienced doctors, and keep every prescription in one place.</p>

            <form onSubmit={onSearch} className="mt-8 bg-white border border-line rounded-xl p-2 shadow-card flex flex-col sm:flex-row gap-2">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search doctor or speciality" className="flex-1 h-11 px-3 rounded-lg text-[15px] focus:outline-none focus:bg-canvas" />
              <div className="hidden sm:block w-px bg-line my-2" />
              <Select value={spec} onChange={(e) => setSpec(e.target.value)} className="sm:w-48 border-0 focus:ring-0 shadow-none">
                <option value="">All specialities</option>
                {specs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Button type="submit" className="sm:px-6">
                Search
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-soft">
              {stats?.reviews > 0 && (
                <span className="flex items-center gap-2">
                  <Stars value={stats.rating} size="xs" /> <span className="font-medium text-ink">{stats.rating.toFixed(1)}</span> from {stats.reviews} patient reviews
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Video className="h-4 w-4 text-brand-600" /> Video consults
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-brand-600" /> Same-day slots
              </span>
            </div>
          </div>
          <img src={heroPhoto} alt="A CareSync doctor" className="lg:hidden mt-8 w-full aspect-[4/3] object-cover object-[78%_center] rounded-2xl" />
        </div>
      </section>

      {/* Numbers */}
      <section className="border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            [stats?.doctors ?? '–', 'Experienced doctors'],
            [stats?.specializations ?? '–', 'Specialities'],
            [stats ? `${stats.patients}+` : '–', 'Registered patients'],
            ['Mon – Sat', '10 AM to 8 PM'],
          ].map(([v, l]) => (
            <div key={l}>
              <p className="text-2xl font-semibold tabular-nums">{v}</p>
              <p className="text-sm text-ink-muted mt-0.5">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Specialities */}
      <section id="specialities" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 scroll-mt-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
          <div>
            <h2 className="text-3xl">Browse by speciality</h2>
            <p className="text-ink-muted mt-2">Choose a department to see its doctors and open slots.</p>
          </div>
          <Link to="/patient/doctors" className="text-brand-600 font-medium inline-flex items-center gap-1 hover:gap-2 transition-all">
            See all doctors <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {specs.map((s) => {
            const Icon = SPEC_ICON[s.name] || Stethoscope;
            return (
              <Link key={s.id} to={`/patient/doctors?spec=${s.id}`} className="card p-5 hover:border-brand-300 transition-colors group">
                <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <p className="font-semibold mt-4 group-hover:text-brand-700">{s.name}</p>
                <p className="text-sm text-ink-muted mt-1.5 line-clamp-2">{s.description}</p>
                <p className="text-sm text-brand-700 mt-3">
                  {s.doctorCount} {s.doctorCount === 1 ? 'doctor' : 'doctors'}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Clinic + features */}
      <section className="bg-canvas border-y border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <img src={clinicPhoto} alt="The CareSync clinic reception and waiting area" className="w-full aspect-[4/3] object-cover rounded-2xl" loading="lazy" />
          <div>
            <h2 className="text-3xl">Less waiting, more caring</h2>
            <p className="text-ink-muted mt-3">Everything around your visit is handled in the app, so your time at the clinic is spent with the doctor.</p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                [Video, 'Video consultations', 'See a doctor from home on your phone or laptop.'],
                [Ticket, 'Live queue token', 'Check in on arrival and watch your turn approach.'],
                [Bell, 'Reminders', 'Confirmations and reminders by SMS and email.'],
                [CreditCard, 'Pay your way', 'UPI or card online, or pay at the reception.'],
              ].map(([Icon, t, d]) => (
                <div key={t} className="flex gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-white border border-line text-brand-600 flex items-center justify-center">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="font-semibold">{t}</p>
                    <p className="text-sm text-ink-muted mt-0.5">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 scroll-mt-16 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        <div className="lg:order-2">
          <img src={consultPhoto} alt="A doctor checking a patient's blood pressure" className="w-full aspect-[4/3] object-cover rounded-2xl" loading="lazy" />
        </div>
        <div>
          <h2 className="text-3xl">How it works</h2>
          <ol className="mt-8 space-y-7">
            {[
              ['Find the right doctor', 'Search by name or speciality and compare experience, fees and patient ratings.'],
              ['Pick a time that suits you', 'Choose a clinic visit or video call and book a live slot. Reschedule or cancel anytime.'],
              ['Visit and get your prescription', 'Your prescription and notes are saved to your medical history, ready to print.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="h-9 w-9 shrink-0 rounded-full bg-brand-600 text-white font-semibold flex items-center justify-center">{i + 1}</span>
                <div>
                  <p className="font-semibold text-lg">{t}</p>
                  <p className="text-ink-muted mt-1">{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-sm text-ink-muted">If your doctor has an emergency, we'll move you to a colleague or help you rebook in one tap, with a full refund if you paid online.</p>
        </div>
      </section>

      {/* Doctors */}
      <section id="doctors" className="bg-canvas border-y border-line scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2 className="text-3xl">Meet our doctors</h2>
              <p className="text-ink-muted mt-2">Rated by patients after every visit.</p>
            </div>
            <Link to="/patient/doctors" className="text-brand-600 font-medium inline-flex items-center gap-1 hover:gap-2 transition-all">
              All {doctors.length} doctors <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {doctors.slice(0, 4).map((d) => (
              <Link key={d.id} to={`/patient/doctors/${d.id}`} className="card overflow-hidden hover:border-brand-300 transition-colors group">
                {d.photoUrl ? (
                  <img src={d.photoUrl} alt={d.name} loading="lazy" className="w-full aspect-square object-cover object-top bg-white" />
                ) : (
                  <div className="w-full aspect-square bg-brand-50" />
                )}
                <div className="p-4">
                  <p className="font-semibold group-hover:text-brand-700">{d.name}</p>
                  <p className="text-sm text-brand-700">{d.specialization}</p>
                  <RatingInline rating={d.rating} count={d.reviewCount} className="mt-2" />
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-line text-sm">
                    <span className="text-ink-muted">{d.experience} yrs exp.</span>
                    <span className="font-medium">{rupees(d.fee)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="rounded-2xl bg-brand-600 px-6 py-10 sm:px-12 sm:py-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl sm:text-3xl text-white">Book your next visit in under a minute</h2>
            <p className="text-brand-100 mt-2">Create a free account to manage appointments for yourself.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button to="/register" className="bg-white !text-brand-700 hover:bg-brand-50">
              Create account
            </Button>
            <Button to="/patient/doctors" className="bg-brand-700 hover:bg-brand-800">
              Find a doctor
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="border-t border-line bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr] gap-10">
          <div>
            <img src={logoFull} alt="CareSync – Healthcare, Made Simple" className="h-14" />
            <p className="text-sm text-ink-muted mt-4 max-w-xs">Book appointments, consult trusted doctors and manage your family's health in one place.</p>
          </div>
          <div className="space-y-3 text-sm text-ink-soft">
            <p className="font-semibold text-ink">Visit us</p>
            <p className="flex gap-2.5"><MapPin className="h-4 w-4 mt-0.5 text-ink-muted shrink-0" /> 24, Anna Salai, Puducherry 605001</p>
            <p className="flex gap-2.5"><Clock className="h-4 w-4 mt-0.5 text-ink-muted shrink-0" /> Mon – Sat, 10:00 AM – 8:00 PM</p>
            <p className="flex gap-2.5"><Phone className="h-4 w-4 mt-0.5 text-ink-muted shrink-0" /> +91 413 222 4455</p>
          </div>
          <div className="space-y-3 text-sm text-ink-soft">
            <p className="font-semibold text-ink">Quick links</p>
            <Link to="/patient/doctors" className="block hover:text-ink">Find a doctor</Link>
            <Link to="/login" className="block hover:text-ink">Patient login</Link>
            <Link to="/login" className="block hover:text-ink">Doctor login</Link>
            <Link to="/register" className="block hover:text-ink">Create account</Link>
          </div>
        </div>
        <div className="border-t border-line">
          <p className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-sm text-ink-muted">© {new Date().getFullYear()} CareSync. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
