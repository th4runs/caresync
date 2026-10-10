// Creates all tables and loads sample data. Run with: npm run db:setup
// WARNING: this drops and recreates every CareSync table.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool, one } from '../src/utils/db.js';
import { addDays, dayOfWeek, todayIST, toMinutes, toTime } from '../src/utils/time.js';

const dir = path.dirname(fileURLToPath(import.meta.url));

// Small deterministic random generator so every setup gives the same data
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const pickFor = (doctor, list) => pick(list.filter((p) => suits(p, doctor.spec)));

const SPECIALIZATIONS = [
  ['General Medicine', 'Fever, infections, diabetes, blood pressure and everyday health concerns.'],
  ['Dermatology', 'Skin, hair and nail conditions including acne, allergies and pigmentation.'],
  ['Pediatrics', 'Healthcare for infants, children and teenagers, including vaccinations.'],
  ['Orthopedics', 'Bones, joints, back pain, sports injuries and fractures.'],
  ['Gynecology', "Women's health, pregnancy care and menstrual concerns."],
  ['Cardiology', 'Heart health, chest pain, ECG review and blood pressure management.'],
  ['ENT', 'Ear, nose and throat problems including sinusitis and hearing issues.'],
  ['Neurology', 'Headaches, migraines, nerve pain, seizures and memory concerns.'],
];

const DOCTORS = [
  ['Dr. Ananya Sharma', 'doctor@caresync.in', 'General Medicine', 'MBBS, MD (General Medicine)', 8, 400, 'Tamil, English, Hindi',
    'Dr. Ananya Sharma is a general physician focused on preventive care, lifestyle conditions such as diabetes and hypertension, and treating common infections. She believes in explaining every diagnosis clearly.'],
  ['Dr. Rahul Menon', 'rahul.menon@caresync.in', 'Dermatology', 'MBBS, MD (Dermatology)', 6, 500, 'Malayalam, English, Tamil',
    'Dr. Rahul Menon treats acne, eczema, hair fall and pigmentation, and has a special interest in skin allergies.'],
  ['Dr. Meera Iyer', 'meera.iyer@caresync.in', 'Pediatrics', 'MBBS, DCH, MD (Pediatrics)', 10, 450, 'Tamil, English',
    'Dr. Meera Iyer cares for newborns through teenagers, with a focus on growth, nutrition and the vaccination schedule.'],
  ['Dr. Arjun Kumar', 'arjun.kumar@caresync.in', 'Orthopedics', 'MBBS, MS (Orthopedics)', 12, 600, 'Tamil, English, Telugu',
    'Dr. Arjun Kumar treats joint pain, back problems and sports injuries, preferring physiotherapy-first treatment plans.'],
  ['Dr. Nisha Rao', 'nisha.rao@caresync.in', 'Gynecology', 'MBBS, MS (OBG)', 9, 550, 'Kannada, English, Tamil',
    "Dr. Nisha Rao provides pregnancy care and treats PCOS, menstrual disorders and other women's health concerns."],
  ['Dr. Karthik S', 'karthik.s@caresync.in', 'Cardiology', 'MBBS, MD, DM (Cardiology)', 14, 800, 'Tamil, English',
    'Dr. Karthik S manages hypertension, chest pain evaluation, heart rhythm problems and cardiac rehabilitation.'],
  ['Dr. Lakshmi Narayanan', 'lakshmi.n@caresync.in', 'ENT', 'MBBS, MS (ENT)', 7, 450, 'Tamil, English',
    'Dr. Lakshmi Narayanan treats sinusitis, tonsillitis, ear infections and hearing problems in adults and children.'],
  ['Dr. Vikram Reddy', 'vikram.reddy@caresync.in', 'Neurology', 'MBBS, MD, DM (Neurology)', 11, 750, 'Telugu, English, Hindi',
    'Dr. Vikram Reddy treats migraines, seizures, nerve pain and sleep-related neurological conditions.'],
  ['Dr. Priya Venkatesh', 'priya.v@caresync.in', 'General Medicine', 'MBBS, DNB (Family Medicine)', 5, 350, 'Tamil, English',
    'Dr. Priya Venkatesh is a family physician who looks after the whole family, from seasonal illness to routine check-ups.'],
  ['Dr. Sanjay Pillai', 'sanjay.pillai@caresync.in', 'Dermatology', 'MBBS, DVL', 4, 400, 'Malayalam, English',
    'Dr. Sanjay Pillai treats common skin infections, fungal conditions and scalp problems.'],
];

const PATIENTS = [
  ['Kavya Raman', 'patient@caresync.in', '9876543210', 28, 'Female', 'B+', '12, Mission Street, Puducherry'],
  ['Rahul Kumar', 'rahul.kumar@example.com', '9840012345', 26, 'Male', 'O+', 'Lawspet, Puducherry'],
  ['Anitha R', 'anitha.r@example.com', '9789012345', 34, 'Female', 'A+', 'Muthialpet, Puducherry'],
  ['Kavin S', 'kavin.s@example.com', '9944123456', 8, 'Male', 'O+', 'Reddiarpalayam, Puducherry'],
  ['Sneha P', 'sneha.p@example.com', '9003123456', 22, 'Female', 'AB+', 'White Town, Puducherry'],
  ['Vishnu V', 'vishnu.v@example.com', '9677123456', 41, 'Male', 'B+', 'Villianur, Puducherry'],
  ['Divya Krishnan', 'divya.k@example.com', '9566123456', 30, 'Female', 'O-', 'Ariyankuppam, Puducherry'],
  ['Arun Prakash', 'arun.p@example.com', '9884123456', 52, 'Male', 'A-', 'Cuddalore'],
  ['Harini M', 'harini.m@example.com', '9500123456', 19, 'Female', 'B-', 'Saram, Puducherry'],
  ['Suresh Babu', 'suresh.b@example.com', '9443123456', 63, 'Male', 'O+', 'Mudaliarpet, Puducherry'],
  ['Lavanya T', 'lavanya.t@example.com', '9360123456', 37, 'Female', 'A+', 'Ellaipillaichavady, Puducherry'],
  ['Mohammed Irfan', 'irfan.m@example.com', '9791123456', 45, 'Male', 'B+', 'Kalapet, Puducherry'],
  ['Deepa Natarajan', 'deepa.n@example.com', '9629123456', 29, 'Female', 'O+', 'Thattanchavady, Puducherry'],
  ['Gokul Raj', 'gokul.r@example.com', '9952123456', 33, 'Male', 'AB-', 'Villupuram'],
];

// More patients so visit history is spread out realistically
const FIRST_F = ['Nandhini', 'Keerthana', 'Meenakshi', 'Swathi', 'Revathi', 'Pooja', 'Janani', 'Bhavani', 'Sowmya', 'Aishwarya', 'Gayathri', 'Shalini', 'Ramya', 'Uma'];
const FIRST_M = ['Karthikeyan', 'Prakash', 'Saravanan', 'Dinesh', 'Hari', 'Manoj', 'Ajith', 'Balaji', 'Senthil', 'Naveen', 'Vignesh', 'Ravi', 'Ashwin', 'Siddharth'];
const LAST = ['Murugan', 'Subramanian', 'Rajan', 'Selvam', 'Krishnan', 'Babu', 'Kumar', 'Pandian', 'Shankar', 'Ganesan'];
const AREAS = ['Lawspet', 'Muthialpet', 'Kurinjipadi', 'Villianur', 'Bahour', 'Karuvadikuppam', 'Gorimedu', 'Nellithope', 'Cuddalore', 'Auroville'];
const BLOOD = ['O+', 'B+', 'A+', 'AB+', 'O-', 'B-'];
for (let i = 0; i < 36; i++) {
  const female = i % 2 === 0;
  const first = (female ? FIRST_F : FIRST_M)[Math.floor(i / 2) % 14];
  const last = LAST[i % LAST.length];
  const age = i % 9 === 0 ? 4 + (i % 9) : 18 + ((i * 7) % 55);
  PATIENTS.push([`${first} ${last}`, `${first}.${last}${i}@example.com`.toLowerCase(), `9${String(700000000 + i * 1234567).slice(0, 9)}`, age, female ? 'Female' : 'Male', BLOOD[i % BLOOD.length], `${AREAS[i % AREAS.length]}, Puducherry`]);
}

// Which patients can sensibly see which speciality
function suits(patient, spec) {
  if (spec === 'Pediatrics') return patient.age <= 16;
  if (patient.age <= 16) return ['General Medicine', 'ENT', 'Dermatology'].includes(spec);
  if (spec === 'Gynecology') return patient.gender === 'Female';
  if (spec === 'Cardiology') return patient.age >= 30;
  return true;
}

const NOTES = {
  'General Medicine': [
    ['Fever and body ache for 3 days', 'Viral fever', 'Tab. Paracetamol 650 mg – 1-1-1 after food × 3 days\nORS sachets as needed\nPlenty of fluids and rest'],
    ['Routine sugar check, mild fatigue', 'Type 2 diabetes – stable', 'Tab. Metformin 500 mg – 1-0-1 after food × 30 days\nCheck fasting sugar in 1 month'],
    ['Sore throat and cough', 'Upper respiratory tract infection', 'Tab. Azithromycin 500 mg – 1-0-0 × 3 days\nSteam inhalation twice daily\nWarm salt water gargles'],
  ],
  Dermatology: [
    ['Acne on face for 2 months', 'Acne vulgaris (mild)', 'Adapalene 0.1% gel – apply at night\nGentle face wash twice daily\nAvoid oily cosmetics'],
    ['Itchy rash on arms', 'Allergic contact dermatitis', 'Tab. Cetirizine 10 mg – 0-0-1 × 5 days\nMometasone cream – twice daily × 7 days'],
  ],
  Pediatrics: [
    ['Cold and mild fever', 'Common cold', 'Syp. Paracetamol 250 mg/5 ml – 5 ml if fever above 100°F\nSaline nasal drops\nContinue normal diet'],
    ['Routine growth check', 'Normal growth and development', 'Continue balanced diet\nNext vaccination as per schedule'],
  ],
  Orthopedics: [
    ['Lower back pain for 2 weeks', 'Mechanical low back pain', 'Tab. Aceclofenac 100 mg – 1-0-1 after food × 5 days\nPhysiotherapy – back strengthening exercises\nAvoid lifting heavy weights'],
    ['Knee pain while climbing stairs', 'Early osteoarthritis of knee', 'Quadriceps exercises daily\nTab. Calcium + Vitamin D3 – 0-1-0 × 30 days'],
  ],
  Gynecology: [
    ['Irregular periods', 'PCOS – under evaluation', 'USG pelvis advised\nRegular exercise and balanced diet\nReview with reports'],
  ],
  Cardiology: [
    ['High BP readings at home', 'Essential hypertension', 'Tab. Amlodipine 5 mg – 1-0-0 × 30 days\nReduce salt intake\nDaily 30 min walk'],
    ['Occasional palpitations', 'Sinus tachycardia – benign', 'ECG normal\nReduce caffeine\nReview if symptoms increase'],
  ],
  ENT: [
    ['Blocked nose and headache', 'Acute sinusitis', 'Tab. Amoxicillin-Clavulanate 625 mg – 1-0-1 × 5 days\nSteam inhalation\nNasal spray – twice daily × 7 days'],
  ],
  Neurology: [
    ['Recurring headaches', 'Migraine without aura', 'Tab. Naproxen 500 mg at onset of headache\nMaintain regular sleep\nKeep a headache diary'],
  ],
};

const REASONS = ['Fever and cold', 'Follow-up visit', 'Routine check-up', 'Skin rash', 'Back pain', 'Headache', 'Review reports', 'Cough', 'Joint pain', ''];

async function main() {
  console.log('Creating tables…');
  await pool.query(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8'));

  const pw = (p) => bcrypt.hash(p, 10);
  const specIds = {};
  for (const [name, description] of SPECIALIZATIONS) {
    specIds[name] = (await one('INSERT INTO specializations (name, description) VALUES ($1, $2) RETURNING id', [name, description])).id;
  }

  await one(`INSERT INTO users (name, email, password, phone, role) VALUES ('Clinic Admin', 'admin@caresync.in', $1, '9000000001', 'ADMIN') RETURNING id`, [await pw('Admin@123')]);

  console.log('Adding doctors…');
  const doctorPw = await pw('Doctor@123');
  const doctors = [];
  for (const [i, [name, email, spec, qual, exp, fee, langs, bio]] of DOCTORS.entries()) {
    const u = await one(`INSERT INTO users (name, email, password, phone, role) VALUES ($1, $2, $3, $4, 'DOCTOR') RETURNING id`, [
      name, email, doctorPw, `98${String(40000000 + i * 1111111).slice(0, 8)}`,
    ]);
    const d = await one(
      `INSERT INTO doctors (user_id, specialization_id, qualification, experience, fee, bio, languages, photo_url, slot_duration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 30) RETURNING id`,
      [u.id, specIds[spec], qual, exp, fee, bio, langs, `/doctors/dr-${name.replace(/^Dr\.\s*/, '').toLowerCase().replace(/\s+/g, '-')}.jpg`],
    );
    // Mon–Sat morning; most doctors also have an evening session, Saturday morning only
    for (let day = 1; day <= 6; day++) {
      await pool.query(`INSERT INTO availability (doctor_id, day_of_week, start_time, end_time) VALUES ($1, $2, '10:00', '13:00')`, [d.id, day]);
      if (day !== 6 && i % 3 !== 2) {
        await pool.query(`INSERT INTO availability (doctor_id, day_of_week, start_time, end_time) VALUES ($1, $2, '17:00', '20:00')`, [d.id, day]);
      }
    }
    doctors.push({ id: d.id, spec, userId: u.id, name, fee });
  }

  console.log('Adding patients…');
  const patientPw = await pw('Patient@123');
  const patients = [];
  for (const [i, [name, email, phone, age, gender, blood, address]] of PATIENTS.entries()) {
    const u = await one(
      `INSERT INTO users (name, email, password, phone, role, created_at) VALUES ($1, $2, $3, $4, 'PATIENT', NOW() - ($5 || ' days')::interval) RETURNING id`,
      [name, email, patientPw, phone, String(60 - i * 4)],
    );
    const p = await one('INSERT INTO patients (user_id, age, gender, blood_group, address) VALUES ($1, $2, $3, $4, $5) RETURNING id', [
      u.id, age, gender, blood, address,
    ]);
    patients.push({ id: p.id, userId: u.id, name, age, gender });
  }

  console.log('Adding appointments…');
  const today = todayIST();
  const used = new Set();
  const slotsFor = async (doctorId, date) => {
    const r = await pool.query('SELECT start_time, end_time FROM availability WHERE doctor_id = $1 AND day_of_week = $2', [doctorId, dayOfWeek(date)]);
    const out = [];
    for (const row of r.rows) for (let m = toMinutes(row.start_time); m + 30 <= toMinutes(row.end_time); m += 30) out.push(toTime(m));
    return out;
  };
  const COMMENTS = {
    5: ['Very patient and explained everything clearly.', 'Excellent doctor. Felt better within two days.', 'Listened carefully and did not rush. Highly recommend.', 'Clear diagnosis and the medicines worked well.', ''],
    4: ['Good consultation, slight wait at the clinic.', 'Helpful and friendly. Booking was easy.', 'Knowledgeable doctor, would visit again.', ''],
    3: ['Consultation was okay, but I had to wait 30 minutes.', 'Treatment helped, explanation could be better.'],
    2: ['Felt a bit rushed during the visit.'],
  };
  const pickRating = () => { const r = rand(); return r < 0.55 ? 5 : r < 0.85 ? 4 : r < 0.96 ? 3 : 2; };

  async function book(doctor, patient, date, time, status, opts = {}) {
    const withNote = opts.withNote ?? status === 'COMPLETED';
    const key = `${doctor.id}|${date}|${time}`;
    const pkey = `p${patient.id}|${date}|${time}`;
    const pday = `p${patient.id}|${date}`;
    // A doctor can't have two patients in one slot, and a patient sees at most one doctor a day
    if (used.has(key) || used.has(pkey) || (status !== 'CANCELLED' && used.has(pday))) return null;
    used.add(key);
    used.add(pkey);
    if (status !== 'CANCELLED') used.add(pday);
    const mode = opts.mode || (rand() < 0.15 ? 'VIDEO' : 'CLINIC');
    const paidOnline = opts.paid ?? (mode === 'VIDEO' || rand() < 0.35);
    const payStatus = paidOnline ? (status === 'CANCELLED' ? 'REFUNDED' : 'PAID') : 'PAY_AT_CLINIC';
    const a = await one(
      `INSERT INTO appointments (patient_id, doctor_id, date, time, reason, status, cancelled_by, cancel_reason, mode, fee, payment_status,
                                 needs_rebook, token_no, checked_in_at, reminder_sent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CASE WHEN $13::int IS NULL THEN NULL ELSE NOW() END, $14, ($15::date - INTERVAL '3 days')) RETURNING id`,
      [patient.id, doctor.id, date, time, opts.reason ?? (pick(REASONS) || null), status,
        status === 'CANCELLED' ? (opts.cancelledBy || 'PATIENT') : null,
        status === 'CANCELLED' ? (opts.cancelReason || 'Cancelled by patient') : null,
        mode, doctor.fee, payStatus, !!opts.needsRebook, opts.token ?? null, date <= today, date],
    );
    if (paidOnline) {
      await pool.query(
        `INSERT INTO payments (appointment_id, amount, provider, order_id, payment_id, refund_id, status, created_at)
         VALUES ($1, $2, 'DEMO', $3, $4, $5, $6, ($7::date - INTERVAL '3 days'))`,
        [a.id, doctor.fee, `demo_order_${a.id}`, `demo_pay_${a.id}`, payStatus === 'REFUNDED' ? `demo_rfnd_${a.id}` : null, payStatus === 'REFUNDED' ? 'REFUNDED' : 'PAID', date],
      );
    }
    if (status === 'COMPLETED' && opts.review !== false && rand() < 0.55) {
      const rating = pickRating();
      await pool.query(
        `INSERT INTO reviews (appointment_id, patient_id, doctor_id, rating, comment, created_at) VALUES ($1, $2, $3, $4, $5, ($6::date + INTERVAL '1 day'))`,
        [a.id, patient.id, doctor.id, rating, pick(COMMENTS[rating]) || null, date],
      );
    }
    if (withNote) {
      const [symptoms, diagnosis, prescription] = pick(NOTES[doctor.spec]);
      await pool.query(
        `INSERT INTO consultation_notes (appointment_id, symptoms, diagnosis, notes, prescription, follow_up_date) VALUES ($1, $2, $3, $4, $5, $6)`,
        [a.id, symptoms, diagnosis, 'Patient advised to return if symptoms worsen.', prescription, rand() < 0.4 ? addDays(date, 7) : null],
      );
    }
    return a;
  }

  // Past 30 days
  for (let back = 30; back >= 1; back--) {
    const date = addDays(today, -back);
    if (dayOfWeek(date) === 0) continue;
    for (const doctor of doctors) {
      const slots = await slotsFor(doctor.id, date);
      const n = Math.floor(rand() * 4);
      for (let k = 0; k < n && slots.length; k++) {
        const r = rand();
        const status = r < 0.8 ? 'COMPLETED' : r < 0.93 ? 'CANCELLED' : 'NO_SHOW';
        await book(doctor, pickFor(doctor, patients.slice(1)), date, pick(slots), status);
      }
    }
  }

  // Today: a full morning for Dr. Ananya (the demo doctor) and a few for others
  if (dayOfWeek(today) !== 0) {
    const ananya = doctors[0];
    const todaySlots = await slotsFor(ananya.id, today);
    // Clinic queue: tokens 1–2 done, 3 with the doctor, 4–5 checked in and waiting, rest not arrived yet
    const plan = ['COMPLETED', 'COMPLETED', 'IN_PROGRESS', 'SCHEDULED', 'SCHEDULED', 'SCHEDULED', 'SCHEDULED'];
    for (const [i, status] of plan.entries()) {
      const token = i < 5 ? i + 1 : null;
      if (todaySlots[i * 2]) await book(ananya, patients[[1, 2, 5, 4, 6, 7, 10][i]], today, todaySlots[i * 2], status, { mode: 'CLINIC', token, review: false });
    }
    if (todaySlots[1]) await book(ananya, patients[12], today, todaySlots[1], 'COMPLETED', { mode: 'VIDEO', review: false });
    for (const doctor of doctors.slice(1)) {
      const slots = (await slotsFor(doctor.id, today)).slice().sort();
      const n = 1 + Math.floor(rand() * 2);
      for (let k = 0; k < n && slots.length; k++) {
        const done = k === 0 && rand() < 0.6;
        await book(doctor, pickFor(doctor, patients.slice(1)), today, slots[k * 3] || pick(slots), done ? 'COMPLETED' : 'SCHEDULED', { mode: 'CLINIC', token: done ? 1 : null, review: false });
      }
    }
  }

  // Next 14 days
  for (let ahead = 1; ahead <= 14; ahead++) {
    const date = addDays(today, ahead);
    if (dayOfWeek(date) === 0) continue;
    for (const doctor of doctors) {
      const slots = await slotsFor(doctor.id, date);
      const n = Math.floor(rand() * 3);
      for (let k = 0; k < n && slots.length; k++) await book(doctor, pickFor(doctor, patients.slice(1)), date, pick(slots), rand() < 0.9 ? 'SCHEDULED' : 'CANCELLED');
    }
  }

  // Demo patient history: completed visits with prescriptions, one cancelled, two upcoming
  const demo = patients[0];
  const nextWorkday = (start) => {
    let d = start;
    while (dayOfWeek(d) === 0) d = addDays(d, 1);
    return d;
  };
  const visits = [
    [doctors[0], -20, 'COMPLETED', { mode: 'CLINIC', paid: false, review: false }],
    [doctors[1], -12, 'COMPLETED', { mode: 'VIDEO', review: false }],
    [doctors[3], -5, 'COMPLETED', { mode: 'CLINIC', paid: true, review: false }],
    [doctors[2], -3, 'CANCELLED', { mode: 'CLINIC', paid: false }],
    [doctors[0], 2, 'SCHEDULED', { mode: 'VIDEO', reason: 'Follow-up for blood sugar report' }],
    [doctors[6], 6, 'SCHEDULED', { mode: 'CLINIC', paid: false, reason: 'Ear pain' }],
  ];
  for (const [doctor, offset, status, opts] of visits) {
    const date = nextWorkday(addDays(today, offset));
    const slots = await slotsFor(doctor.id, date);
    for (const time of slots) if (await book(doctor, demo, date, time, status, opts)) break;
  }
  // The demo patient already reviewed one visit
  const firstVisit = await one(`SELECT id, doctor_id FROM appointments WHERE patient_id = $1 AND status = 'COMPLETED' ORDER BY date LIMIT 1`, [demo.id]);
  await pool.query(`INSERT INTO reviews (appointment_id, patient_id, doctor_id, rating, comment) VALUES ($1, $2, $3, 5, 'Dr. Ananya explained my sugar report patiently. Very reassuring.')`, [firstVisit.id, demo.id, firstVisit.doctorId]);

  // Doctor's planned leave next week (demo doctor)
  await pool.query(`INSERT INTO unavailability (doctor_id, date, kind, reason) VALUES ($1, $2, 'LEAVE', 'Medical conference')`, [
    doctors[0].id, nextWorkday(addDays(today, 9)),
  ]);

  // Emergency: Dr. Rahul Menon blocked a morning, so the demo patient must pick a new time
  const emergencyDay = nextWorkday(addDays(today, 3));
  await pool.query(`INSERT INTO unavailability (doctor_id, date, start_time, end_time, kind, reason) VALUES ($1, $2, '10:00', '13:00', 'EMERGENCY', 'Called in for emergency surgery')`, [
    doctors[1].id, emergencyDay,
  ]);
  await pool.query(`DELETE FROM appointments WHERE doctor_id = $1 AND date = $2 AND time >= '10:00' AND time < '13:00'`, [doctors[1].id, emergencyDay]);
  const disrupted = await book(doctors[1], demo, emergencyDay, '11:00', 'CANCELLED', {
    mode: 'CLINIC', paid: true, cancelledBy: 'DOCTOR', cancelReason: 'Doctor emergency', needsRebook: true, reason: 'Skin rash follow-up',
  });

  // A fully booked day with the demo patient on the waitlist (Dr. Priya Venkatesh, General Medicine)
  const fullDay = nextWorkday(addDays(today, 5));
  const priya = doctors[8];
  const fillers = patients.slice(1);
  const activeAt = async (time) =>
    (await pool.query(`SELECT 1 FROM appointments WHERE doctor_id = $1 AND date = $2 AND time = $3 AND status <> 'CANCELLED'`, [priya.id, fullDay, time])).rowCount > 0;
  for (const time of await slotsFor(priya.id, fullDay)) {
    used.delete(`${priya.id}|${fullDay}|${time}`); // a cancelled booking may have freed this slot
    for (const p of fillers) {
      if (await activeAt(time)) break;
      await book(priya, p, fullDay, time, 'SCHEDULED', { mode: 'CLINIC' });
    }
  }
  await pool.query(`INSERT INTO waitlist (patient_id, doctor_id, date) VALUES ($1, $2, $3)`, [demo.id, priya.id, fullDay]);

  if (disrupted) {
    await pool.query(`INSERT INTO notifications (user_id, message, link) VALUES ($1, $2, $3)`, [
      demo.userId,
      `We're sorry. Dr. Rahul Menon had to attend to a medical emergency, so your appointment on ${emergencyDay} can't go ahead. Your payment of ₹${doctors[1].fee} has been refunded. Please pick a new time.`,
      `/patient/appointments?rebook=${disrupted.id}`,
    ]);
  }

  // A few notifications so the bell isn't empty
  await pool.query(`INSERT INTO notifications (user_id, message, link) VALUES
    ($1, 'Welcome to CareSync! Find a doctor and book your first appointment in under a minute.', '/patient/doctors'),
    ($2, 'Your weekly schedule is live. Patients can now book your available slots.', '/doctor/profile')`, [demo.userId, doctors[0].userId]);

  const count = await one('SELECT COUNT(*)::int AS n FROM appointments');
  console.log(`Done. ${doctors.length} doctors, ${patients.length} patients, ${count.n} appointments.`);
  console.log('\nDemo logins:\n  Patient  patient@caresync.in / Patient@123\n  Doctor   doctor@caresync.in  / Doctor@123\n  Admin    admin@caresync.in   / Admin@123');
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
