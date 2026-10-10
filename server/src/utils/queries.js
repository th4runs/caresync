// Shared SELECT fragments so every endpoint returns the same shapes.
export const DOCTOR_SELECT = `
  SELECT d.id, d.user_id, u.name, u.email, u.phone, u.is_active, d.qualification, d.experience, d.fee,
         d.bio, d.languages, d.photo_url, d.slot_duration, d.specialization_id, d.video_enabled,
         s.name AS specialization,
         COALESCE(rv.avg_rating, 0)::float AS rating, COALESCE(rv.review_count, 0)::int AS review_count
    FROM doctors d
    JOIN users u ON u.id = d.user_id
    JOIN specializations s ON s.id = d.specialization_id
    LEFT JOIN (SELECT doctor_id, ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*) AS review_count
                 FROM reviews WHERE NOT is_hidden GROUP BY doctor_id) rv ON rv.doctor_id = d.id`;

export const APPOINTMENT_SELECT = `
  SELECT a.id, a.date, a.time, a.reason, a.status, a.cancelled_by, a.cancel_reason, a.created_at,
         a.mode, a.fee, a.payment_status, a.needs_rebook, a.rebooked_from, a.token_no, a.checked_in_at,
         a.patient_id, pu.name AS patient_name, pu.phone AS patient_phone, pu.email AS patient_email,
         p.age AS patient_age, p.gender AS patient_gender, p.blood_group AS patient_blood_group,
         a.doctor_id, du.name AS doctor_name, d.photo_url AS doctor_photo, d.fee AS doctor_fee,
         CASE WHEN d.delay_date = to_char(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') THEN d.delay_minutes ELSE 0 END AS doctor_delay,
         s.name AS specialization,
         a.transferred_from_doctor_id, tfu.name AS transferred_from_name,
         (cn.id IS NOT NULL) AS has_notes,
         rv.rating AS my_rating
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN users pu ON pu.id = p.user_id
    JOIN doctors d ON d.id = a.doctor_id
    JOIN users du ON du.id = d.user_id
    JOIN specializations s ON s.id = d.specialization_id
    LEFT JOIN doctors tfd ON tfd.id = a.transferred_from_doctor_id
    LEFT JOIN users tfu ON tfu.id = tfd.user_id
    LEFT JOIN consultation_notes cn ON cn.appointment_id = a.id
    LEFT JOIN reviews rv ON rv.appointment_id = a.id`;
