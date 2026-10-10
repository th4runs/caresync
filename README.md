# CareSync – Healthcare, Made Simple

A full-stack clinic appointment system with separate portals for patients, doctors and the clinic admin.

**Stack:** React 18 + Vite + Tailwind CSS · Node.js + Express · PostgreSQL (`pg` driver, plain SQL) · JWT authentication · Socket.IO (live updates, video-call signalling) · WebRTC · Nodemailer · Twilio · Razorpay

---

## Features

**Patient**
- Register / log in
- Browse, search and filter doctors by speciality; sort by experience or fee
- Doctor profile with bio, qualification, fee and weekly consultation hours
- Real-time slot booking (morning / afternoon / evening, IST)
- Reschedule or cancel upcoming appointments
- Appointment history (upcoming / past / cancelled)
- Printable / downloadable prescription after each visit
- Medical history: every diagnosis and prescription in one place
- Profile and password management, in-app notifications

**Doctor**
- Dashboard with today's appointments, next patient and upcoming bookings
- Update appointment status (in progress, completed, no-show, cancelled)
- Patient details with previous visits before each consultation
- Consultation notes: symptoms, diagnosis, prescription, advice, follow-up date
- Manage weekly hours, slot length (10–60 min) and leave days
  (adding leave on a booked day cancels those bookings and notifies patients)

**Admin**
- Clinic statistics: patients, doctors, today's visits, 30-day revenue, weekly chart,
  status breakdown, appointments by speciality, most consulted doctors
- Add / edit / delete doctors, upload photos, activate or deactivate
- Manage each doctor's schedule and leave
- Manage patients (view history, deactivate, delete)
- Manage all appointments with filters, status updates and CSV export
- Manage specializations

**Doctor emergencies & personal work**
- One-tap **Emergency / unavailable** on the doctor dashboard: rest of today, a whole day, or specific hours, marked as Emergency, Personal work or Leave
- Booked patients in that time are either **transferred to a colleague** in the same speciality at the same time (the system shows who is free) or **asked to rebook**
- Patients are told by app alert, email and SMS; online payments are **refunded automatically**
- Patients get an **"Action needed"** card with the doctor's next free slots and other doctors in that speciality, so they can rebook in one tap
- **Running late** alert (15–90 min) notifies the rest of today's patients and adjusts queue wait times
- Admin sees disruptions, delays and patients who still need to rebook, and can mark any doctor unavailable

**More features**
- **Email & SMS**: booking confirmations, reminders 24 hours before, cancellations, waitlist alerts. Every message is logged in Admin → Email & SMS log
- **Ratings & reviews**: patients rate completed visits; ratings show on doctor cards and profiles, with sort by "Highest rated"; admin can hide reviews
- **Waitlist**: join a fully booked day; everyone waiting is alerted the moment a slot opens
- **Online payment**: Razorpay (UPI, cards, net banking) or pay at clinic; failed payments can be retried, unpaid holds are released after 15 minutes, refunds on cancellation (patient: up to 2 h before)
- **Video consultation**: built-in 1:1 video call (WebRTC) with mute, camera toggle and chat; doctors can open notes beside the call
- **Queue tokens**: patients check in ("I've arrived") or reception checks them in, get a token, and watch "Now serving" update live; doctors use "Call next patient"; a **waiting-room TV screen** is at `/display`
- Live in-app notifications (no refresh needed)

**Built-in safeguards:** a slot can never be double-booked (database unique index), patients can't
book past slots or overlapping times, every API route checks the user's role and ownership.

---

## Run it locally

### 1. Requirements
- Node.js 18 or newer
- PostgreSQL 14 or newer (running locally)

### 2. Create the database
```bash
psql -U postgres -c "CREATE DATABASE caresync;"
```

### 3. Configure the server
```bash
cd server
cp .env.example .env
```
Edit `server/.env` and set your PostgreSQL username/password in `DATABASE_URL`, and change `JWT_SECRET`
to any long random string.

Email, SMS and payments work **without any keys**: messages are saved to the Email & SMS log, and payments use a
built-in test gateway. To make them real, fill in the optional values in `server/.env` and restart the server:

| Feature | What to add | Where to get it |
|---|---|---|
| Email | `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASS` | Gmail → Google Account → Security → App passwords |
| SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | twilio.com (free trial sends to verified numbers) |
| Payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | dashboard.razorpay.com → Test mode → API keys |

The server prints which ones are active when it starts.

### 4. Install and load sample data
From the project root:
```bash
npm run install:all
npm run db:setup
```
`db:setup` creates all tables and loads 10 doctors (with photos), 8 specialities, 50 patients and ~450 appointments
with prescriptions, payments and reviews, dated around today. **If you ran an older version, run it again**. New tables were added. **It drops existing CareSync tables**, so run it again any time you
want a fresh demo.

### 5. Start (two terminals)
```bash
npm run dev:server   # API on http://localhost:5000
npm run dev:client   # App on http://localhost:5173
```
Open **http://localhost:5173**.

### Demo logins
| Role    | Email                 | Password     |
|---------|-----------------------|--------------|
| Patient | patient@caresync.in   | Patient@123  |
| Doctor  | doctor@caresync.in    | Doctor@123   |
| Admin   | admin@caresync.in     | Admin@123    |

The login page also has one-click demo buttons.

**Try the new features quickly**
- *Emergency:* log in as the doctor → **Emergency / unavailable** → pick a day with bookings → choose Transfer or Rebook
- *Rebooking:* log in as the patient → My Appointments shows an "Action needed" card (Dr. Rahul Menon had an emergency)
- *Waitlist:* the patient is already waiting for a fully booked day with Dr. Priya Venkatesh
- *Video call:* open the app in two browsers (or one normal + one private window), log in as patient and doctor, and join the same video appointment on its day. Camera access needs `localhost` or HTTPS
- *Queue:* open `http://localhost:5173/display` on a second screen, then check a patient in and press **Call next patient** All other seeded doctors use `Doctor@123`
and all other patients use `Patient@123`.

### Production build
```bash
npm run build   # builds client/dist
npm start       # Express serves the API and the built app on port 5000
```

---

## Project structure
```
caresync/
├── client/                 React app (public/doctors has the doctor photos)
│   └── src/
│       ├── assets/photos/  Hero, login, clinic and consultation photos
│       ├── components/     Layout, UI kit, SlotPicker, ScheduleEditor, UnavailableModal, PaymentModal,
│       │                   RebookCard, QueueCard, ReviewForm, Prescription…
│       ├── context/        Auth and toast providers
│       ├── lib/            API client, date/currency formatting, hooks
│       └── pages/
│           ├── VideoVisit  1:1 video consultation room
│           ├── public/     Landing, Login, Register, Queue display (TV)
│           ├── patient/    Dashboard, Find Doctors, Doctor Profile, Book, My Appointments,
│           │               Appointment Detail, Medical History, Profile
│           ├── doctor/     Dashboard, Appointments, Consultation Notes, Profile & Availability
│           └── admin/      Dashboard, Doctors, Add/Edit Doctor, Patients, Appointments, Specializations,
│                           Reviews, Email & SMS log
└── server/
    ├── db/                 schema.sql + setup.js (tables and sample data)
    └── src/
        ├── middleware/     JWT auth + role guard
        ├── routes/         auth, public, patient, doctor, admin, notifications, uploads
        ├── services/       messaging (email/SMS), payments, realtime (Socket.IO), queue, waitlist, jobs
        └── utils/          db, slot generation, schedule & unavailability, IST time helpers
```

## API overview
| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/password` |
| Public | `GET /api/doctors`, `/api/doctors/:id`, `/api/doctors/:id/slots?date=`, `/api/doctors/:id/next-available`, `/api/specializations`, `/api/stats` |
| Patient | `/api/patient/dashboard`, `/profile`, `/appointments` (list, book, `:id`, `:id/cancel`, `:id/reschedule`), `/history` |
| Doctor | `/api/doctor/dashboard`, `/appointments` (list, `:id`, `:id/status`, `:id/notes`), `/profile`, `/schedule`, `/leaves` |
| Admin | `/api/admin/stats`, `/doctors` (CRUD, `:id/status`, `:id/schedule`, `:id/leaves`), `/patients`, `/appointments`, `/specializations` |
| Unavailability | `POST …/unavailability/preview`, `POST …/unavailability`, `PUT /api/doctor/delay` (doctor and admin) |
| Queue | `POST …/check-in`, `POST /api/doctor/queue/next`, `GET /api/queue/display` |
| Payments | `POST /api/patient/appointments/:id/pay`, `POST /api/patient/payments/:id/verify` |
| Other | `/api/notifications`, `/api/patient/waitlist`, `POST /api/patient/appointments/:id/review`, `/api/admin/reviews`, `/api/admin/messages`, `POST /api/uploads` |

All dates are stored as `YYYY-MM-DD` and times as `HH:MM` in Indian Standard Time.
