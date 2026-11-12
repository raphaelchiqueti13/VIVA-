import "dotenv/config";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(here, "../database/viva.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
const schema = fs.readFileSync(path.resolve(here, "../database/schema.sql"), "utf8");
db.exec(schema);

// Migrações aditivas: preservam os cadastros existentes.
function addColumn(table, name, definition) {
  const columns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));
  if (!columns.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}
addColumn("users", "phone", "TEXT");
addColumn("users", "birth_date", "TEXT");
addColumn("users", "city", "TEXT");
addColumn("users", "accessibility_libras", "INTEGER NOT NULL DEFAULT 0");
addColumn("users", "profile_completed", "INTEGER NOT NULL DEFAULT 0");
addColumn("users", "hemocenter_id", "INTEGER REFERENCES hemocenters(id)");
addColumn("hemocenters", "source_url", "TEXT");
addColumn("hemocenters", "booking_url", "TEXT");
addColumn("hemocenters", "verified_at", "TEXT");
addColumn("hemocenters", "verified_by", "INTEGER REFERENCES users(id)");
addColumn("appointments", "institution_note", "TEXT");

// A versão anterior não aceitava solicitações pendentes. Recria a tabela
// preservando os registros para suportar aprovação pela unidade.
const appointmentSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='appointments'").get()?.sql || "";
if (!appointmentSql.includes("'pending'")) {
  db.pragma("foreign_keys = OFF");
  db.exec(`
    ALTER TABLE appointments RENAME TO appointments_legacy;
    CREATE TABLE appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hemocenter_id INTEGER NOT NULL REFERENCES hemocenters(id),
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','completed')),
      institution_note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO appointments (id,user_id,hemocenter_id,appointment_date,appointment_time,status,created_at)
      SELECT id,user_id,hemocenter_id,appointment_date,appointment_time,status,created_at FROM appointments_legacy;
    DROP TABLE appointments_legacy;
  `);
  db.pragma("foreign_keys = ON");
}

db.exec(`CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date,status);`);
db.exec(`
  CREATE TABLE IF NOT EXISTS qr_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jti TEXT NOT NULL UNIQUE,
    donor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    institution_user_id INTEGER NOT NULL REFERENCES users(id),
    verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_qr_verifications_donor ON qr_verifications(donor_id, verified_at);
  CREATE INDEX IF NOT EXISTS idx_appointments_center_date
    ON appointments(hemocenter_id, appointment_date, appointment_time, status);
`);
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_donation_unique_validated
    ON donation_records(user_id, donation_date, hemocenter_id) WHERE status='validated'`);
} catch (error) {
  console.warn("Índice de unicidade de doações não foi criado; revise possíveis registros duplicados:", error.message);
}

// Não inserir unidades fictícias: somente unidades verificadas por um administrador
// aparecem no diretório público.

// Estoque administrado manualmente; nunca inferir valores clínicos.
db.exec(`CREATE TABLE IF NOT EXISTS blood_stock (blood_type TEXT PRIMARY KEY, level TEXT NOT NULL, source TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
