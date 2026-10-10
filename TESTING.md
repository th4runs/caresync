# CareSync test report

Tested on 10 October 2026 from a fresh install of this project: unzipped into an empty folder, `npm run install:all`,
a new database, `npm run db:setup`, then the app run both in development (`dev:server` + `dev:client`) and production
(`npm run build` + `npm start`). Browser tests used Chromium with simulated camera and microphone.

**Result: 32/32 API checks and 33/33 browser flows passed, no page errors, all 26 pages fit desktop and mobile.**

## API, security and data checks (32)
- Demo logins work; wrong password, invalid email and short password are rejected
- Missing token → 401; patients can't use doctor/admin APIs; doctors can't use admin APIs
- A patient can't view, cancel, review or pay for another patient's appointment
- Past dates and dates more than 60 days ahead can't be booked
- Two patients booking the same slot at the same moment → exactly one succeeds
- SQL-injection style search input returns nothing
- Online booking starts as "payment pending"; demo payment marks it paid; cancelling ≥ 2 h before refunds it
- Unavailability in the past, end time before start, and invalid delays are rejected
- Reviews only for completed visits, rating must be 1–5, one review per visit
- Waitlist only allowed for fully booked days
- Doctors with history and specialities with doctors can't be deleted
- Non-image uploads are rejected
- Video room: strangers can't join, the room opens only on the day, fake socket tokens are refused

## Browser flows (33)
**Patient**: register → dashboard · filter doctors by speciality · book, reschedule, cancel · book with online payment
(failure, then success) · close payment window → pay later from My Appointments · rebook from the "Action needed" card ·
check in → live token → "It's your turn" · write a review · join a waitlist → live alert when a slot opens → "Book now" ·
mobile booking with the sticky confirm bar · notification bell

**Doctor**: consultation notes and complete visit · running-late alert · emergency for a whole day → transfer to a colleague
(patient sees the notice) · personal work for specific hours → patients asked to rebook (patient sees the card) ·
call next patient · reviews tab · video consults on/off

**Video call**: patient and doctor connect with two-way video · in-call chat · mute · leave (tested via the Vite dev proxy and in production)

**Admin**: add speciality · add doctor · schedule editor · mark a doctor on leave · reception check-in with token ·
cancel a paid appointment → refund + rebook request · needs-attention panel · hide a review · email/SMS log ·
needs-rebooking filter · waiting-room TV display

**Resilience**: server stopped while logged in → "Can't reach CareSync" screen, login kept → server restarted → page recovers on its own

## Issues found and fixed during testing
1. Bookings beyond 60 days were accepted if made directly through the API → now rejected
2. "Action needed" and "Rate your visit" cards were missing from the patient dashboard → added
3. A network error while loading the page could log the user out → now the login is kept and the app retries
4. The sample "fully booked" day wasn't actually full → sample data fixed
5. Waiting-room screen showed doctors with no queue → now only active queues are shown
6. Client dependencies upgraded (Vite 8, React Router 7) to clear npm audit warnings

## Known notes
- `npm audit` still lists `braces` (used only by Tailwind while building CSS). No fixed version exists yet, and it never ships to the browser.
- Without SMTP/Twilio/Razorpay keys, email and SMS are logged (Admin → Email & SMS log) and payments use the test gateway.
- Video calls connect peer-to-peer using public STUN servers. Very strict networks (some offices/colleges) may need a TURN server.
