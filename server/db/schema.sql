-- CareSync database schema (PostgreSQL)
-- Dates are stored as 'YYYY-MM-DD' and times as 'HH:MM', both in IST.

DROP TABLE IF EXISTS message_log, payments, waitlist, reviews, notifications, consultation_notes, appointments, unavailability, leaves, availability,
  doctors, patients, specializations, users CASCADE;
DROP TYPE IF EXISTS user_role, appointment_status, visit_mode, payment_status CASCADE;

CREATE TYPE user_role AS ENUM ('PATIENT', 'DOCTOR', 'ADMIN');
CREATE TYPE appointment_status AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE visit_mode AS ENUM ('CLINIC', 'VIDEO');
CREATE TYPE payment_status AS ENUM ('PAY_AT_CLINIC', 'PENDING', 'PAID', 'REFUNDED');

CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,
  phone       TEXT,
  role        user_role NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE patients (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  age          INT,
  gender       TEXT,
  blood_group  TEXT,
  address      TEXT
);

CREATE TABLE specializations (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  description  TEXT
);

CREATE TABLE doctors (
  id                 SERIAL PRIMARY KEY,
  user_id            INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  specialization_id  INT NOT NULL REFERENCES specializations(id),
  qualification      TEXT NOT NULL,
  experience         INT NOT NULL DEFAULT 0,
  fee                INT NOT NULL DEFAULT 0,
  bio                TEXT,
  languages          TEXT,
  photo_url          TEXT,
  slot_duration      INT NOT NULL DEFAULT 30,
  video_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  -- "Running late" notice for one day
  delay_minutes      INT NOT NULL DEFAULT 0,
  delay_date         TEXT
);

-- Weekly working hours. day_of_week: 0 = Sunday ... 6 = Saturday
CREATE TABLE availability (
  id           SERIAL PRIMARY KEY,
  doctor_id    INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week  INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TEXT NOT NULL,
  end_time     TEXT NOT NULL
);

-- Time a doctor can't see patients. start/end NULL = whole day.
-- kind: LEAVE (planned day off), PERSONAL (personal work), EMERGENCY
CREATE TABLE unavailability (
  id          SERIAL PRIMARY KEY,
  doctor_id   INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  start_time  TEXT,
  end_time    TEXT,
  kind        TEXT NOT NULL DEFAULT 'LEAVE' CHECK (kind IN ('LEAVE', 'PERSONAL', 'EMERGENCY')),
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_unavail_doctor_date ON unavailability (doctor_id, date);

CREATE TABLE appointments (
  id            SERIAL PRIMARY KEY,
  patient_id    INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id     INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  time          TEXT NOT NULL,
  reason        TEXT,
  status        appointment_status NOT NULL DEFAULT 'SCHEDULED',
  cancelled_by  user_role,
  cancel_reason TEXT,
  mode          visit_mode NOT NULL DEFAULT 'CLINIC',
  fee           INT NOT NULL DEFAULT 0,
  payment_status payment_status NOT NULL DEFAULT 'PAY_AT_CLINIC',
  -- Set when the doctor became unavailable and the patient should pick a new time
  needs_rebook  BOOLEAN NOT NULL DEFAULT FALSE,
  rebooked_from INT REFERENCES appointments(id) ON DELETE SET NULL,
  transferred_from_doctor_id INT REFERENCES doctors(id) ON DELETE SET NULL,
  -- Queue token, given when the patient checks in at the clinic
  token_no      INT,
  checked_in_at TIMESTAMPTZ,
  reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_appt_doctor_date ON appointments (doctor_id, date);
CREATE INDEX idx_appt_patient ON appointments (patient_id);
-- A slot can only be held by one active appointment (unpaid online bookings hold it for 15 minutes)
CREATE UNIQUE INDEX uniq_active_slot ON appointments (doctor_id, date, time) WHERE status <> 'CANCELLED';

CREATE TABLE consultation_notes (
  id              SERIAL PRIMARY KEY,
  appointment_id  INT NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  symptoms        TEXT,
  diagnosis       TEXT,
  notes           TEXT,
  prescription    TEXT,
  follow_up_date  TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  link        TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_user ON notifications (user_id, created_at DESC);

CREATE TABLE reviews (
  id              SERIAL PRIMARY KEY,
  appointment_id  INT NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id      INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id       INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  rating          INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reviews_doctor ON reviews (doctor_id);

-- Patients waiting for a slot on a fully booked day
CREATE TABLE waitlist (
  id           SERIAL PRIMARY KEY,
  patient_id   INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id    INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'NOTIFIED', 'BOOKED', 'LEFT')),
  notified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, doctor_id, date)
);

CREATE TABLE payments (
  id              SERIAL PRIMARY KEY,
  appointment_id  INT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  amount          INT NOT NULL,
  provider        TEXT NOT NULL,              -- RAZORPAY or DEMO
  order_id        TEXT,
  payment_id      TEXT,
  refund_id       TEXT,
  status          TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'PAID', 'FAILED', 'REFUNDED')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_appt ON payments (appointment_id);

-- Every email/SMS the system sends (or would send, when no provider is configured)
CREATE TABLE message_log (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  channel     TEXT NOT NULL CHECK (channel IN ('EMAIL', 'SMS')),
  recipient   TEXT NOT NULL,
  subject     TEXT,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL,                  -- SENT, FAILED, LOGGED (no provider configured)
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_msglog_created ON message_log (created_at DESC);
