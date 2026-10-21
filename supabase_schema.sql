-- ====================================================================
-- STA. ROSA ELEMENTARY SCHOOL - GRADE 6 GREAT GENIUSES
-- QR Code Attendance System - Supabase PostgreSQL Schema
-- ====================================================================
-- Run this complete script in your Supabase project's SQL Editor:
-- 1. Log in to https://supabase.com
-- 2. Open your project -> Click "SQL Editor" in the left sidebar
-- 3. Click "New query" -> Paste this entire script -> Click "Run"
-- ====================================================================

-- 1. USERS TABLE (Admin, Teachers, Students)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  student_id INTEGER,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'teacher',
  face_descriptor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS face_descriptor TEXT;

-- 2. STUDENTS TABLE (Grade 6 Great Geniuses Roster)
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  lrn TEXT,
  full_name TEXT NOT NULL,
  sex TEXT,
  guardian_name TEXT,
  guardian_contact TEXT,
  student_phone TEXT,
  email TEXT,
  qr_code TEXT UNIQUE,
  is_enrolled INTEGER DEFAULT 1,
  enrollment_status TEXT DEFAULT 'officially_enrolled',
  face_descriptor TEXT,
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE students ADD COLUMN IF NOT EXISTS face_descriptor TEXT;

-- 3. ATTENDANCE TABLE (Daily records with GPS, Room, and Status)
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  time_in TEXT NOT NULL,
  status TEXT DEFAULT 'present',
  recorded_by TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  room TEXT DEFAULT 'Room 101 - Grade 6 Great Geniuses',
  face_verified INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS face_verified INTEGER DEFAULT 0;

-- 4. SMS LOGS TABLE
CREATE TABLE IF NOT EXISTS sms_logs (
  id SERIAL PRIMARY KEY,
  student_id INTEGER,
  guardian_contact TEXT,
  message TEXT,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SF2 PROGRESS TABLE
CREATE TABLE IF NOT EXISTS sf2_progress (
  id SERIAL PRIMARY KEY,
  school_year TEXT UNIQUE,
  progress_data TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. APP SETTINGS TABLE
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL
);

-- 7. NOTIFICATION EVENTS TABLE
CREATE TABLE IF NOT EXISTS notification_events (
  event_key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. STUDENT ABSENCE DAYS TABLE
CREATE TABLE IF NOT EXISTS student_absence_days (
  student_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  PRIMARY KEY (student_id, date)
);

-- 9. ACTIVITY LOGS TABLE (Historical Data tracking for Admin and Teacher)
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL,
  user_name TEXT,
  action_type TEXT,
  action_title TEXT NOT NULL,
  details TEXT,
  target_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- SEED DEFAULT SETTINGS
-- ====================================================================
INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('gps_enabled', '0'),
  ('attendance_mode', 'onsite'),
  ('room_name', 'Room 101 - Grade 6 Great Geniuses'),
  ('qr_code_type', 'fixed'),
  ('attendance_theme', 'rose'),
  ('block_unenrolled', '1'),
  ('school_latitude', ''),
  ('school_longitude', ''),
  ('geofence_radius_m', '100'),
  ('qr_enabled', '1'),
  ('qr_start', ''),
  ('qr_end', ''),
  ('school_start', '08:00'),
  ('attendance_deadline', '16:00'),
  ('absence_threshold', '5'),
  ('late_after', '08:00'),
  ('sms_enabled', '0'),
  ('student_face_verification', '1'),
  ('scanner_verification_mode', 'both')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- ====================================================================
-- SEED DEFAULT ACCOUNTS (admin / teacher / student)
-- Passwords:
--   admin    -> admin123
--   teacher  -> teacher123
--   student  -> student123
-- ====================================================================
INSERT INTO users (full_name, username, password, role) VALUES
  ('Administrator', 'admin', '$2a$10$J.kDWnvBMpZJZJETuHwKS.vqUgRP.s7TRasHgQmugQk14Zsg4yYd2', 'admin'),
  ('Tifanny Martin Aragon', 'teacher', '$2a$10$xeNt6VgpFeO.cC1d8U7y/.fM7LYJ7UhUZhrDr0hDZPqCPITBku9eq', 'teacher')
ON CONFLICT (username) DO NOTHING;

-- ====================================================================
-- SEED GRADE 6 GREAT GENIUSES CLASS ROSTER (25 Students)
-- ====================================================================
INSERT INTO students (full_name, sex, qr_code, is_enrolled, enrollment_status) VALUES
  -- Male Students
  ('ANIN, ANGELITO LAPITAN', 'M', 'QR-ANINANGELITO-M1', 1, 'officially_enrolled'),
  ('CALLENA, KHALED GAYAP', 'M', 'QR-CALLENAKHALE-M2', 1, 'officially_enrolled'),
  ('DOTIMAS, IVAN VILLAMOR', 'M', 'QR-DOTIMASIVANV-M3', 1, 'officially_enrolled'),
  ('DOTIMAS, JHON PADILLA', 'M', 'QR-DOTIMASJHONP-M4', 1, 'officially_enrolled'),
  ('GAYAP, JUSTINE BLACE', 'M', 'QR-GAYAPJUSTINE-M5', 1, 'officially_enrolled'),
  ('HERANI, ANTHONY JR QUINTERO', 'M', 'QR-HERANIANTHON-M6', 1, 'officially_enrolled'),
  ('LAPITAN, GIDEON NATIVIDAD', 'M', 'QR-LAPITANGIDEO-M7', 1, 'officially_enrolled'),
  ('LAPITAN, YAEL NATIVIDAD', 'M', 'QR-LAPITANYAELN-M8', 1, 'officially_enrolled'),
  ('LUMONTAD, CHRISTIAN MANIBOY', 'M', 'QR-LUMONTADCHRI-M9', 1, 'officially_enrolled'),
  ('PACHOCA, JOHN ROBERT DELA CRUZ', 'M', 'QR-PACHOCAJOHNR-M10', 1, 'officially_enrolled'),
  ('PULANCO, JERALD GULOY', 'M', 'QR-PULANCOJERAL-M11', 1, 'officially_enrolled'),
  ('SORIANO, MARK ANGELO GAYAP', 'M', 'QR-SORIANOMARKA-M12', 1, 'officially_enrolled'),
  -- Female Students
  ('AGOTO, MILAGROS RINGOR', 'F', 'QR-AGOTOMILAGRO-F1', 1, 'officially_enrolled'),
  ('ANCHETA, KRISTINE HALOG', 'F', 'QR-ANCHETAKRIST-F2', 1, 'officially_enrolled'),
  ('CARIAGA, ANGEL BESTROLLO', 'F', 'QR-CARIAGAANGEL-F3', 1, 'officially_enrolled'),
  ('DELOS TRINOS, JANNAH ROSE ROBRIGADO', 'F', 'QR-DELOSTRINOSJ-F4', 1, 'officially_enrolled'),
  ('ESTRADA, RHIAN VIERNES', 'F', 'QR-ESTRADARHIAN-F5', 1, 'officially_enrolled'),
  ('GAYAP, DARLYN FAITH CANAS', 'F', 'QR-GAYAPDARLYNF-F6', 1, 'officially_enrolled'),
  ('GAYAP, JOHANNA BLACE', 'F', 'QR-GAYAPJOHANNA-F7', 1, 'officially_enrolled'),
  ('LAUREANO, PRINCESS GAYAP', 'F', 'QR-LAUREANOPRIN-F8', 1, 'officially_enrolled'),
  ('LINDE, ERICA MAY GARBON', 'F', 'QR-LINDEERICAMA-F9', 1, 'officially_enrolled'),
  ('NATIVIDAD, ALEXIES UDARBE', 'F', 'QR-NATIVIDADALE-F10', 1, 'officially_enrolled'),
  ('SINGH, NAMI SHANAIAH OBEDOZA', 'F', 'QR-SINGHNAMISHA-F11', 1, 'officially_enrolled'),
  ('VILLANUEVA, KIESHA FAITH PULANCO', 'F', 'QR-VILLANUEVAKI-F12', 1, 'officially_enrolled'),
  ('VILORIA, JHAIREEN ANTHONET DELA CRUZ', 'F', 'QR-VILORIAJHAIR-F13', 1, 'officially_enrolled')
ON CONFLICT (qr_code) DO NOTHING;

-- Assign teacher_id to class roster
UPDATE students SET teacher_id = (SELECT id FROM users WHERE role = 'teacher' ORDER BY id LIMIT 1) WHERE teacher_id IS NULL;

-- Link default student account to the first student (ANIN, ANGELITO LAPITAN)
DO $$
DECLARE
  first_student_id INTEGER;
  first_student_name TEXT;
BEGIN
  SELECT id, full_name INTO first_student_id, first_student_name FROM students ORDER BY id ASC LIMIT 1;
  IF first_student_id IS NOT NULL THEN
    INSERT INTO users (full_name, username, password, role, student_id)
    VALUES (first_student_name, 'student', '$2a$10$t.Wo3EjUrfOUj4WO/JplGeg3tubCrHe1hluSo1V5.XDBf45dZaCru', 'student', first_student_id)
    ON CONFLICT (username) DO NOTHING;
  END IF;
END $$;

-- ====================================================================
-- SEED SAMPLE HISTORICAL ATTENDANCE (Past School Days)
-- ====================================================================
INSERT INTO attendance (student_id, date, time_in, status, recorded_by, room)
SELECT 
  s.id,
  d.day_date,
  CASE 
    WHEN (s.id * 7 + d.day_idx * 13) % 100 >= 85 THEN '08:' || LPAD(((s.id * 3) % 40)::TEXT, 2, '0') || ' AM'
    ELSE '07:' || LPAD((20 + ((s.id * 5) % 35))::TEXT, 2, '0') || ' AM'
  END,
  CASE 
    WHEN (s.id * 7 + d.day_idx * 13) % 100 >= 85 THEN 'late'
    ELSE 'present'
  END,
  'teacher',
  'Room 101 - Grade 6 Great Geniuses'
FROM students s
CROSS JOIN (
  VALUES 
    ('2026-10-01', 0),
    ('2026-10-02', 1),
    ('2026-10-05', 2),
    ('2026-10-06', 3),
    ('2026-10-07', 4),
    ('2026-10-08', 5)
) AS d(day_date, day_idx)
WHERE ((s.id * 7 + d.day_idx * 13) % 100) >= 6
ON CONFLICT DO NOTHING;

-- Schema setup complete!
