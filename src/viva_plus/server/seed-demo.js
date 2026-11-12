// Cria contas e uma unidade DE DEMONSTRAÇÃO para a apresentação/homologação.
// Uso: npm run seed:demo   (nunca execute em produção com dados reais)
import bcrypt from "bcryptjs";
import { db } from "./db.js";

if (process.env.NODE_ENV === "production") {
  console.error("seed:demo bloqueado em produção.");
  process.exit(1);
}

const PASSWORD = "Demo@12345678";
const hash = bcrypt.hashSync(PASSWORD, 12);

const upsertUser = (name, email, role) => {
  const found = db.prepare("SELECT id FROM users WHERE email=?").get(email);
  if (found) { db.prepare("UPDATE users SET role=? WHERE id=?").run(role, found.id); return found.id; }
  return db.prepare(
    "INSERT INTO users (name,email,password_hash,role,blood_type,blood_type_verified,city,region,profile_completed) VALUES (?,?,?,?,?,0,?,?,1)"
  ).run(name, email, hash, role, role === "donor" ? "O+" : null, "São Paulo", "Centro").lastInsertRowid;
};

const adminId = upsertUser("Admin Demo", "admin@demo.viva", "admin");
const donorId = upsertUser("Doador Demo", "doador@demo.viva", "donor");
const hcUserId = upsertUser("Hemocentro Demo", "hemocentro@demo.viva", "hemocenter");

let unit = db.prepare("SELECT id FROM hemocenters WHERE name=?").get("Unidade de Demonstração (teste)");
if (!unit) {
  const id = db.prepare(
    `INSERT INTO hemocenters (name,region,address,city,state,phone,opening_hours,source_url,booking_url,verified_at,verified_by)
     VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,?)`
  ).run("Unidade de Demonstração (teste)", "Centro", "Endereço fictício de demonstração", "São Paulo", "SP",
        "", "Dados de teste", "https://example.com", null, adminId).lastInsertRowid;
  unit = { id };
}
db.prepare("UPDATE users SET hemocenter_id=? WHERE id=?").run(unit.id, hcUserId);

console.log(`Contas de demonstração criadas (senha de todas: ${PASSWORD})`);
console.log(" - admin@demo.viva       (admin)");
console.log(" - hemocentro@demo.viva  (instituição, vinculada à unidade de demonstração)");
console.log(" - doador@demo.viva      (doador)");
console.log("AVISO: a unidade é FICTÍCIA e serve só para testes. Apague antes de qualquer uso real.");
