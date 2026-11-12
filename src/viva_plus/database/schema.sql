PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'donor' CHECK(role IN ('donor','hemocenter','admin')),
  blood_type TEXT CHECK(blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-') OR blood_type IS NULL),
  blood_type_verified INTEGER NOT NULL DEFAULT 0 CHECK(blood_type_verified IN (0,1)),
  region TEXT,
  phone TEXT,
  birth_date TEXT,
  city TEXT,
  accessibility_libras INTEGER NOT NULL DEFAULT 0 CHECK(accessibility_libras IN (0,1)),
  profile_completed INTEGER NOT NULL DEFAULT 0 CHECK(profile_completed IN (0,1)),
  hemocenter_id INTEGER REFERENCES hemocenters(id),
  last_donation_date TEXT,
  notification_campaigns INTEGER NOT NULL DEFAULT 1,
  notification_eligibility INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hemocenters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  phone TEXT,
  opening_hours TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  source_url TEXT,
  booking_url TEXT,
  verified_at TEXT,
  verified_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS donation_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hemocenter_id INTEGER REFERENCES users(id),
  donation_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','validated','rejected')),
  notes TEXT,
  validated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hemocenter_id INTEGER NOT NULL REFERENCES hemocenters(id),
  appointment_date TEXT NOT NULL,
  appointment_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','completed')),
  institution_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  blood_type TEXT,
  region TEXT NOT NULL,
  hemocenter_id INTEGER REFERENCES hemocenters(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qr_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jti TEXT NOT NULL UNIQUE,
  donor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_user_id INTEGER NOT NULL REFERENCES users(id),
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_donations_user ON donation_records(user_id, donation_date);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status, region);
CREATE INDEX IF NOT EXISTS idx_qr_verifications_donor ON qr_verifications(donor_id, verified_at);
