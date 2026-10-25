const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let dbInstance = null;

// ====================================================================
// SQLITE IMPLEMENTATION (Local development / Offline fallback)
// ====================================================================
let initSqlJs = null;
const dbPath = path.join(__dirname, '..', 'attendance.db');

function saveSqliteDB(db) {
  if (!db) return;
  try {
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
  } catch (err) {
    console.error('Error saving SQLite file:', err.message);
  }
}

function wrapSqliteDatabase(sqlDb) {
  return {
    isPostgres: false,
    prepare(sql) {
      return {
        async get(...args) {
          try {
            const params = args.flat();
            const statement = sqlDb.prepare(sql);
            if (params.length) statement.bind(params);

            if (statement.step()) {
              const row = statement.getAsObject();
              statement.free();
              return row;
            }
            statement.free();
            return undefined;
          } catch (error) {
            console.error('SQLite get error:', error.message, 'SQL:', sql);
            return undefined;
          }
        },

        async all(...args) {
          try {
            const params = args.flat();
            const rows = [];
            const statement = sqlDb.prepare(sql);
            if (params.length) statement.bind(params);

            while (statement.step()) {
              rows.push(statement.getAsObject());
            }
            statement.free();
            return rows;
          } catch (error) {
            console.error('SQLite all error:', error.message, 'SQL:', sql);
            return [];
          }
        },

        async run(...args) {
          try {
            const params = args.flat();
            if (params.length) {
              sqlDb.run(sql, params);
            } else {
              sqlDb.run(sql);
            }

            saveSqliteDB(sqlDb);

            const result = sqlDb.exec('SELECT last_insert_rowid()');
            const lastInsertRowid =
              result.length && result[0].values.length
                ? result[0].values[0][0]
                : 0;

            return { lastInsertRowid };
          } catch (error) {
            console.error('SQLite run error:', error.message, 'SQL:', sql);
            return { lastInsertRowid: 0 };
          }
        }
      };
    },

    async exec(sql) {
      try {
        sqlDb.run(sql);
        saveSqliteDB(sqlDb);
      } catch (err) {
        console.error('SQLite exec error:', err.message);
      }
    },

    pragma() {}
  };
}

async function initSqliteDatabase() {
  if (!initSqlJs) {
    try {
      initSqlJs = require('sql.js');
    } catch (err) {
      throw new Error(
        'SQLite (sql.js) is not available in this environment. ' +
        'Please define DATABASE_URL in your Vercel project environment variables to connect to Supabase/PostgreSQL.'
      );
    }
  }

  let SQL;
  try {
    SQL = await initSqlJs();
  } catch (err) {
    throw new Error(
      'Failed to initialize SQLite WebAssembly: ' + err.message + '. ' +
      'On Vercel, please set the DATABASE_URL environment variable to your Supabase PostgreSQL connection string.'
    );
  }

  let sqlDb;

  if (fs.existsSync(dbPath)) {
    sqlDb = new SQL.Database(fs.readFileSync(dbPath));
    console.log('Loaded existing SQLite database');
  } else {
    sqlDb = new SQL.Database();
    console.log('Created new SQLite database');
  }

  // Auto-save SQLite file every 30 seconds
  setInterval(() => saveSqliteDB(sqlDb), 30000);

  // Schema creation
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      student_id INTEGER,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'teacher',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lrn TEXT,
      full_name TEXT NOT NULL,
      sex TEXT,
      guardian_name TEXT,
      guardian_contact TEXT,
      student_phone TEXT,
      email TEXT,
      qr_code TEXT,
      is_enrolled INTEGER DEFAULT 1,
      enrollment_status TEXT DEFAULT 'officially_enrolled',
      teacher_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      date TEXT,
      time_in TEXT,
      status TEXT DEFAULT 'present',
      recorded_by TEXT,
      latitude REAL,
      longitude REAL,
      room TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sms_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      guardian_contact TEXT,
      message TEXT,
      status TEXT DEFAULT 'sent',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sf2_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_year TEXT,
      progress_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notification_events (
      event_key TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS student_absence_days (
      student_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      PRIMARY KEY (student_id, date)
    );
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      user_name TEXT,
      action_type TEXT,
      action_title TEXT NOT NULL,
      details TEXT,
      target_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure columns
  function ensureColumn(table, column, definition) {
    const result = sqlDb.exec('PRAGMA table_info(' + table + ')');
    const cols = result.length ? result[0].values.map(r => r[1]) : [];
    if (!cols.includes(column)) {
      sqlDb.run('ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + definition);
    }
  }

  ensureColumn('users', 'email', 'TEXT');
  ensureColumn('users', 'student_id', 'INTEGER');
  ensureColumn('users', 'face_descriptor', 'TEXT');
  ensureColumn('students', 'student_phone', 'TEXT');
  ensureColumn('students', 'email', 'TEXT');
  ensureColumn('students', 'is_enrolled', 'INTEGER DEFAULT 1');
  ensureColumn('students', 'enrollment_status', "TEXT DEFAULT 'officially_enrolled'");
  ensureColumn('students', 'teacher_id', 'INTEGER');
  ensureColumn('students', 'face_descriptor', 'TEXT');
  ensureColumn('attendance', 'latitude', 'REAL');
  ensureColumn('attendance', 'longitude', 'REAL');
  ensureColumn('attendance', 'room', 'TEXT');
  ensureColumn('attendance', 'face_verified', 'INTEGER DEFAULT 0');

  sqlDb.run("UPDATE students SET is_enrolled = 1 WHERE is_enrolled IS NULL OR is_enrolled = ''");
  sqlDb.run("UPDATE students SET enrollment_status = 'officially_enrolled' WHERE enrollment_status IS NULL OR enrollment_status = ''");
  sqlDb.run("UPDATE students SET teacher_id = (SELECT id FROM users WHERE role = 'teacher' ORDER BY id LIMIT 1) WHERE teacher_id IS NULL OR teacher_id = 0");
  sqlDb.run("UPDATE sms_logs SET status = 'sent' WHERE status = 'queued' AND guardian_contact != '' AND guardian_contact IS NOT NULL");

  // Defaults
  const defaults = {
    gps_enabled: '0',
    attendance_mode: 'onsite',
    room_name: 'Room 101 - Grade 6 Great Geniuses',
    qr_code_type: 'fixed',
    attendance_theme: 'rose',
    block_unenrolled: '1',
    school_latitude: '',
    school_longitude: '',
    geofence_radius_m: '100',
    qr_enabled: '1',
    qr_start: '',
    qr_end: '',
    school_start: '08:00',
    attendance_deadline: '16:00',
    absence_threshold: '5',
    late_after: '08:00',
    sms_enabled: '0',
    sms_notify_present: '1',
    sms_provider: 'textbee',
    textbee_api_key: 'txb_qQDnUgyok84rrtJJ1kG8qkZMwWGt0wNT',
    textbee_device_id: '6ad7fcb9ab534081692d485f',
    student_face_verification: '1',
    scanner_verification_mode: 'both'
  };

  for (const [key, value] of Object.entries(defaults)) {
    sqlDb.run(
      'INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)',
      [key, value]
    );
  }

  // Ensure hardcoded TextBee gateway credentials
  sqlDb.run(
    "UPDATE app_settings SET setting_value = 'txb_qQDnUgyok84rrtJJ1kG8qkZMwWGt0wNT' WHERE setting_key = 'textbee_api_key' AND (setting_value IS NULL OR setting_value = '')"
  );
  sqlDb.run(
    "UPDATE app_settings SET setting_value = '6ad7fcb9ab534081692d485f' WHERE setting_key = 'textbee_device_id' AND (setting_value IS NULL OR setting_value = '')"
  );

  // Default accounts
  const admin = sqlDb.exec("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!admin.length || !admin[0].values.length) {
    sqlDb.run(
      'INSERT INTO users (full_name, username, password, role) VALUES (?, ?, ?, ?)',
      ['Administrator', 'admin', bcrypt.hashSync('admin123', 10), 'admin']
    );
  }

  const teacher = sqlDb.exec("SELECT id FROM users WHERE username = 'teacher'");
  if (!teacher.length || !teacher[0].values.length) {
    sqlDb.run(
      'INSERT INTO users (full_name, username, password, role) VALUES (?, ?, ?, ?)',
      ['Tifanny Martin Aragon', 'teacher', bcrypt.hashSync('teacher123', 10), 'teacher']
    );
  }

  const studentRes = sqlDb.exec("SELECT id, full_name FROM students LIMIT 1");
  const studentUser = sqlDb.exec("SELECT id FROM users WHERE username = 'student'");
  if ((!studentUser.length || !studentUser[0].values.length) && studentRes.length && studentRes[0].values.length) {
    sqlDb.run(
      'INSERT INTO users (full_name, username, password, role, student_id) VALUES (?, ?, ?, ?, ?)',
      [studentRes[0].values[0][1], 'student', bcrypt.hashSync('student123', 10), 'student', studentRes[0].values[0][0]]
    );
  }

  // Seed sample students if empty
  const countRes = sqlDb.exec('SELECT COUNT(*) FROM students');
  if (!countRes.length || !countRes[0].values[0][0]) {
    seedSqliteSampleStudents(sqlDb);
  }

  // Seed sample attendance if empty
  // Seed sample attendance if empty
  const attRes = sqlDb.exec('SELECT COUNT(*) FROM attendance');
  if (!attRes.length || !attRes[0].values[0][0]) {
    seedSqliteSampleAttendance(sqlDb);
  }

  // Seed sample activity logs if empty
  const logRes = sqlDb.exec('SELECT COUNT(*) FROM activity_logs');
  if (!logRes.length || !logRes[0].values[0][0]) {
    seedSqliteSampleActivityLogs(sqlDb);
  }

  // Clean up any zero-attendance duplicate students and orphaned accounts
  cleanupDuplicateStudents(sqlDb);

  saveSqliteDB(sqlDb);
  return wrapSqliteDatabase(sqlDb);
}

function cleanupDuplicateStudents(sqlDb) {
  try {
    // 1. Purge test/junk faculty and admin accounts created during local tests
    sqlDb.run("DELETE FROM users WHERE username IN ('test1', '1234354', 'DI MATIBAG') OR username LIKE 'test.teacher.%' OR username LIKE 'office_admin_%'");
    
    // 2. Remove test students ('LUICHE', 'JASTEN C CABATO') and associated users
    sqlDb.run("DELETE FROM users WHERE username IN ('Luiche', 'CabatoJasten') OR student_id IN (26, 53) OR LOWER(full_name) LIKE '%cabato%' OR LOWER(full_name) LIKE '%jasten%'");
    sqlDb.run("DELETE FROM attendance WHERE student_id IN (26, 53)");
    sqlDb.run("DELETE FROM student_absence_days WHERE student_id IN (26, 53)");
    sqlDb.run("DELETE FROM students WHERE id IN (26, 53) OR LOWER(full_name) LIKE '%cabato%' OR LOWER(full_name) LIKE '%jasten%'");

    // 3. Link orphaned student_id = 13 attendance to student 40 if needed
    sqlDb.run('UPDATE attendance SET student_id = 40 WHERE student_id = 13 AND (SELECT COUNT(*) FROM students WHERE id = 13) = 0 AND (SELECT COUNT(*) FROM students WHERE id = 40) > 0');
    
    // 4. Clean student account usernames
    sqlDb.run("UPDATE users SET student_id = 14, username = 'AnchetaKristine', email = 'AnchetaKristine' WHERE username = 'AnchetaKristine2'");
    sqlDb.run("UPDATE users SET username = 'AgotoMilagros', email = 'AgotoMilagros' WHERE username = 'AgotoMilagros2' AND (SELECT COUNT(*) FROM users WHERE username = 'AgotoMilagros') = 0");
    sqlDb.run("UPDATE users SET full_name = 'School Administrator' WHERE username = 'admin'");

    // 5. Find duplicate students where full_name matches an earlier student ID with attendance, but this duplicate has 0 attendance
    const dups = sqlDb.exec(`
      SELECT s2.id 
      FROM students s1 
      JOIN students s2 ON LOWER(TRIM(s1.full_name)) = LOWER(TRIM(s2.full_name)) AND s1.id < s2.id
      WHERE (SELECT COUNT(*) FROM attendance WHERE student_id = s2.id) = 0
    `);
    if (dups.length && dups[0].values.length) {
      const dupIds = dups[0].values.map(r => r[0]);
      const idList = dupIds.join(',');
      sqlDb.run(`DELETE FROM users WHERE student_id IN (${idList})`);
      sqlDb.run(`DELETE FROM students WHERE id IN (${idList})`);
      console.log(`[Deduplication] Cleaned up ${dupIds.length} duplicate student records (IDs: ${idList})`);
    }
  } catch (err) {
    console.error('[Deduplication] Error cleaning up duplicates:', err.message);
  }
}

function seedSqliteSampleStudents(sqlDb) {
  const teacherRow = sqlDb.exec("SELECT id FROM users WHERE role = 'teacher' ORDER BY id LIMIT 1");
  const teacherId = (teacherRow.length && teacherRow[0].values.length) ? teacherRow[0].values[0][0] : 2;

  const males = [
    'ANIN, ANGELITO LAPITAN', 'CALLENA, KHALED GAYAP', 'DOTIMAS, IVAN VILLAMOR',
    'DOTIMAS, JHON PADILLA', 'GAYAP, JUSTINE BLACE', 'HERANI, ANTHONY JR QUINTERO',
    'LAPITAN, GIDEON NATIVIDAD', 'LAPITAN, YAEL NATIVIDAD', 'LUMONTAD, CHRISTIAN MANIBOY',
    'PACHOCA, JOHN ROBERT DELA CRUZ', 'PULANCO, JERALD GULOY', 'SORIANO, MARK ANGELO GAYAP'
  ];
  const females = [
    'AGOTO, MILAGROS RINGOR', 'ANCHETA, KRISTINE HALOG', 'CARIAGA, ANGEL BESTROLLO',
    'DELOS TRINOS, JANNAH ROSE ROBRIGADO', 'ESTRADA, RHIAN VIERNES', 'GAYAP, DARLYN FAITH CANAS',
    'GAYAP, JOHANNA BLACE', 'LAUREANO, PRINCESS GAYAP', 'LINDE, ERICA MAY GARBON',
    'NATIVIDAD, ALEXIES UDARBE', 'SINGH, NAMI SHANAIAH OBEDOZA', 'VILLANUEVA, KIESHA FAITH PULANCO',
    'VILORIA, JHAIREEN ANTHONET DELA CRUZ'
  ];

  males.forEach((name, index) => {
    const qr = 'QR-' + name.replace(/[^A-Z]/g, '').substring(0, 12) + '-M' + (index + 1);
    sqlDb.run('INSERT INTO students (full_name, sex, qr_code, is_enrolled, enrollment_status, teacher_id) VALUES (?, ?, ?, 1, ?, ?)', [name, 'M', qr, 'officially_enrolled', teacherId]);
  });
  females.forEach((name, index) => {
    const qr = 'QR-' + name.replace(/[^A-Z]/g, '').substring(0, 12) + '-F' + (index + 1);
    sqlDb.run('INSERT INTO students (full_name, sex, qr_code, is_enrolled, enrollment_status, teacher_id) VALUES (?, ?, ?, 1, ?, ?)', [name, 'F', qr, 'officially_enrolled', teacherId]);
  });
}

function seedSqliteSampleAttendance(sqlDb) {
  const studentsResult = sqlDb.exec('SELECT id FROM students');
  if (!studentsResult.length || !studentsResult[0].values.length) return;
  const ids = studentsResult[0].values.map(r => r[0]);
  const sampleDates = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'];
  const room = 'Room 101 - Grade 6 Great Geniuses';

  sampleDates.forEach((dateStr, dayIdx) => {
    ids.forEach((id, stIdx) => {
      const rand = (stIdx * 7 + dayIdx * 13) % 100;
      if (rand < 6 && dayIdx < 5) return;
      const isLate = rand >= 85;
      const timeIn = isLate ? `08:${String((stIdx * 3) % 40).padStart(2, '0')} AM` : `07:${String(20 + ((stIdx * 5) % 35)).padStart(2, '0')} AM`;
      const status = isLate ? 'late' : 'present';
      sqlDb.run(
        'INSERT INTO attendance (student_id, date, time_in, status, recorded_by, room) VALUES (?, ?, ?, ?, ?, ?)',
        [id, dateStr, timeIn, status, 'teacher', room]
      );
    });
  });
}

function seedSqliteSampleActivityLogs(sqlDb) {
  const logs = [
    // Admin historical updates
    ['admin', 'admin', 'settings_update', 'System Initialized & Attendance Parameters Configured', 'Configured S.Y. 2026-2027 Sta. Rosa ES attendance rules, 08:00 AM cutoff, and onsite geofence radius.', 'System Config', '2026-10-01 07:30:00'],
    ['admin', 'admin', 'teacher_management', 'Registered Class Adviser Account', 'Added faculty adviser Tifanny Martin Aragon (@teacher) for Grade 6 Great Geniuses.', 'Tifanny Martin Aragon', '2026-10-01 07:35:00'],
    ['admin', 'admin', 'sf2_update', 'SF2 Submission Matrix Initialized', 'Created S.Y. 2026-2027 monthly monitoring tracker for Grade 6 Great Geniuses.', 'SF2 S.Y. 2026-2027', '2026-10-05 09:15:00'],
    ['admin', 'admin', 'sf2_update', 'SF2 Monthly Review: Approved September 2026', 'Reviewed and approved September 2026 School Form 2 monthly attendance summary.', 'Grade 6 Great Geniuses', '2026-10-06 14:20:00'],
    ['admin', 'admin', 'settings_update', 'Attendance Theme Set to Rose', 'Updated default system theme to Rose / Sta. Rosa ES maroon palette.', 'Appearance Settings', '2026-10-08 10:00:00'],

    // Teacher historical updates
    ['teacher', 'teacher', 'student_update', 'Verified Grade 6 Class Roster', 'Confirmed 25 officially enrolled learners (12 Male, 13 Female) in Grade 6 Great Geniuses.', 'Grade 6 Class Roster', '2026-10-01 07:45:00'],
    ['teacher', 'teacher', 'attendance_record', 'Morning Attendance Check-In (Oct 02)', 'Recorded attendance check-in for 24 learners in Room 101 via QR scanner.', 'Room 101', '2026-10-02 08:05:00'],
    ['teacher', 'teacher', 'attendance_record', 'Late Arrival Scanned: DOTIMAS, JHON PADILLA', 'Learner checked in at 08:12 AM in Room 101 (Late status marked).', 'DOTIMAS, JHON PADILLA', '2026-10-06 08:12:00'],
    ['teacher', 'teacher', 'sms_alert', 'Dispatched Guardian SMS Notification', 'Sent SMS attendance notice to guardian regarding late arrival in Room 101.', 'PACHOCA, JOHN ROBERT DELA CRUZ', '2026-10-07 08:18:00'],
    ['teacher', 'teacher', 'attendance_record', 'Morning Attendance Check-In (Oct 08)', 'Completed morning attendance scan for Grade 6 Great Geniuses in Room 101.', 'Room 101', '2026-10-08 07:55:00']
  ];

  logs.forEach(log => {
    sqlDb.run(
      'INSERT INTO activity_logs (role, user_name, action_type, action_title, details, target_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      log
    );
  });
}


// ====================================================================
// POSTGRESQL / SUPABASE IMPLEMENTATION
// ====================================================================
let poolInstance = null;

function sanitizeRow(row) {
  if (!row) return row;
  const copy = { ...row };
  for (const key of Object.keys(copy)) {
    if (['count', 'total_recorded', 'late_count', 'on_time_count', 'total_enrolled', 'is_enrolled'].includes(key)) {
      if (copy[key] !== null && copy[key] !== undefined) {
        copy[key] = Number(copy[key]);
      }
    }
  }
  return copy;
}

function toPgSql(sql) {
  let paramIdx = 1;
  let s = sql.replace(/\?/g, () => `$${paramIdx++}`);
  // Handle SQLite INSERT OR IGNORE
  s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
  if (/INSERT\s+INTO/i.test(sql) && /INSERT\s+OR\s+IGNORE/i.test(sql) && !/ON\s+CONFLICT/i.test(s)) {
    s += ' ON CONFLICT DO NOTHING';
  }
  return s;
}

function wrapPgDatabase(pool) {
  return {
    isPostgres: true,
    prepare(sql) {
      return {
        async get(...args) {
          if (/PRAGMA\s+table_info/i.test(sql)) {
            return [
              { name: 'student_phone' },
              { name: 'email' },
              { name: 'is_enrolled' },
              { name: 'enrollment_status' },
              { name: 'room' },
              { name: 'teacher_id' },
              { name: 'face_descriptor' },
              { name: 'face_verified' }
            ];
          }
          try {
            const params = args.flat();
            const pgSql = toPgSql(sql);
            const res = await pool.query(pgSql, params);
            return sanitizeRow(res.rows[0]);
          } catch (err) {
            console.error('Supabase/PostgreSQL get error:', err.message, 'SQL:', sql);
            return undefined;
          }
        },

        async all(...args) {
          if (/PRAGMA\s+table_info/i.test(sql)) {
            return [
              { name: 'student_phone' },
              { name: 'email' },
              { name: 'is_enrolled' },
              { name: 'enrollment_status' },
              { name: 'room' },
              { name: 'teacher_id' },
              { name: 'face_descriptor' },
              { name: 'face_verified' }
            ];
          }
          try {
            const params = args.flat();
            const pgSql = toPgSql(sql);
            const res = await pool.query(pgSql, params);
            return (res.rows || []).map(sanitizeRow);
          } catch (err) {
            console.error('Supabase/PostgreSQL all error:', err.message, 'SQL:', sql);
            return [];
          }
        },

        async run(...args) {
          try {
            const params = args.flat();
            let pgSql = toPgSql(sql);
            const isInsert = /^\s*INSERT\s+INTO/i.test(pgSql);
            if (isInsert && !/RETURNING/i.test(pgSql)) {
              pgSql += ' RETURNING id';
            }
            const res = await pool.query(pgSql, params);
            const lastInsertRowid = res.rows && res.rows[0] && res.rows[0].id ? res.rows[0].id : 0;
            return { lastInsertRowid, rowCount: res.rowCount };
          } catch (err) {
            console.error('Supabase/PostgreSQL run error:', err.message, 'SQL:', sql);
            throw err;
          }
        }
      };
    },

    async exec(sql) {
      try {
        await pool.query(sql);
      } catch (err) {
        console.error('Supabase/PostgreSQL exec error:', err.message);
      }
    },

    pragma() {}
  };
}

async function initPgDatabase(connectionString) {
  const { Pool } = require('pg');
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false }
    });
  }

  const pool = poolInstance;

  // Auto-create schema on first run
  await pool.query(`
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
      teacher_id INTEGER,
      face_descriptor TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE students ADD COLUMN IF NOT EXISTS teacher_id INTEGER;
    ALTER TABLE students ADD COLUMN IF NOT EXISTS face_descriptor TEXT;
    ALTER TABLE students ADD COLUMN IF NOT EXISTS student_phone TEXT;
    ALTER TABLE students ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE students ADD COLUMN IF NOT EXISTS is_enrolled INTEGER DEFAULT 1;
    ALTER TABLE students ADD COLUMN IF NOT EXISTS enrollment_status TEXT DEFAULT 'officially_enrolled';
    UPDATE students SET teacher_id = (SELECT id FROM users WHERE role = 'teacher' ORDER BY id LIMIT 1) WHERE teacher_id IS NULL;
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
    ALTER TABLE attendance ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
    ALTER TABLE attendance ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
    ALTER TABLE attendance ADD COLUMN IF NOT EXISTS room TEXT DEFAULT 'Room 101 - Grade 6 Great Geniuses';
    CREATE TABLE IF NOT EXISTS sms_logs (
      id SERIAL PRIMARY KEY,
      student_id INTEGER,
      guardian_contact TEXT,
      message TEXT,
      status TEXT DEFAULT 'sent',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sf2_progress (
      id SERIAL PRIMARY KEY,
      school_year TEXT UNIQUE,
      progress_data TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notification_events (
      event_key TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS student_absence_days (
      student_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      PRIMARY KEY (student_id, date)
    );
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
  `);

  await pool.query("UPDATE sms_logs SET status = 'sent' WHERE status = 'queued' AND guardian_contact != '' AND guardian_contact IS NOT NULL");

  // Ensure default settings exist
  const defaults = [
    ['gps_enabled', '0'],
    ['attendance_mode', 'onsite'],
    ['room_name', 'Room 101 - Grade 6 Great Geniuses'],
    ['qr_code_type', 'fixed'],
    ['attendance_theme', 'rose'],
    ['block_unenrolled', '1'],
    ['school_latitude', ''],
    ['school_longitude', ''],
    ['geofence_radius_m', '100'],
    ['qr_enabled', '1'],
    ['qr_start', ''],
    ['qr_end', ''],
    ['school_start', '08:00'],
    ['attendance_deadline', '16:00'],
    ['absence_threshold', '5'],
    ['late_after', '08:00'],
    ['sms_enabled', '0'],
    ['sms_notify_present', '1'],
    ['sms_provider', 'textbee'],
    ['textbee_api_key', 'txb_qQDnUgyok84rrtJJ1kG8qkZMwWGt0wNT'],
    ['textbee_device_id', '6ad7fcb9ab534081692d485f']
  ];

  for (const [key, val] of defaults) {
    await pool.query(
      'INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2) ON CONFLICT (setting_key) DO NOTHING',
      [key, val]
    );
  }

  // Ensure hardcoded TextBee gateway credentials
  await pool.query(
    "UPDATE app_settings SET setting_value = 'txb_qQDnUgyok84rrtJJ1kG8qkZMwWGt0wNT' WHERE setting_key = 'textbee_api_key' AND (setting_value IS NULL OR setting_value = '')"
  );
  await pool.query(
    "UPDATE app_settings SET setting_value = '6ad7fcb9ab534081692d485f' WHERE setting_key = 'textbee_device_id' AND (setting_value IS NULL OR setting_value = '')"
  );

  // Ensure default accounts exist
  const existingAdmin = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!existingAdmin.rows || !existingAdmin.rows.length) {
    await pool.query(`
      INSERT INTO users (full_name, username, password, role) VALUES
        ('Administrator', 'admin', '$2a$10$J.kDWnvBMpZJZJETuHwKS.vqUgRP.s7TRasHgQmugQk14Zsg4yYd2', 'admin')
      ON CONFLICT (username) DO NOTHING
    `);
  }
  const existingTeacher = await pool.query("SELECT id FROM users WHERE role = 'teacher' LIMIT 1");
  if (!existingTeacher.rows || !existingTeacher.rows.length) {
    await pool.query(`
      INSERT INTO users (full_name, username, password, role) VALUES
        ('Tifanny Martin Aragon', 'teacher', '$2a$10$xeNt6VgpFeO.cC1d8U7y/.fM7LYJ7UhUZhrDr0hDZPqCPITBku9eq', 'teacher')
      ON CONFLICT (username) DO NOTHING
    `);
  }

  console.log('Connected to Supabase PostgreSQL database');
  return wrapPgDatabase(pool);
}

// ====================================================================
// MAIN INITIALIZATION DISPATCHER
// ====================================================================
async function initDatabase() {
  if (dbInstance) return dbInstance;

  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

  if (connectionString) {
    console.log('Initializing database connection using Supabase/PostgreSQL...');
    dbInstance = await initPgDatabase(connectionString);
  } else {
    console.log('No DATABASE_URL configured. Using local SQLite database...');
    dbInstance = await initSqliteDatabase();
  }

  return dbInstance;
}

module.exports = { initDatabase };