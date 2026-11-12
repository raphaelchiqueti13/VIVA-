// Popula o banco LOCAL com dados FICTÍCIOS para a apresentação (gráficos e funil preenchidos).
// Todas as contas usam o domínio @demo.viva e a interface sinaliza "dados de demonstração".
// Uso: npm run seed:demo && npm run seed:apresentacao   (bloqueado em produção)
import bcrypt from "bcryptjs";
import { db } from "./db.js";

if (process.env.NODE_ENV === "production") { console.error("seed:apresentacao bloqueado em produção."); process.exit(1); }

const hcUser = db.prepare("SELECT id, hemocenter_id FROM users WHERE email='hemocentro@demo.viva'").get();
if (!hcUser) { console.error("Rode antes: npm run seed:demo"); process.exit(1); }
const unitId = hcUser.hemocenter_id;

let seed = 20261111;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

const first = ["Ana","Bruno","Carla","Diego","Elisa","Felipe","Gabriela","Heitor","Isabela","João","Karina","Lucas","Marina","Nicolas","Olívia","Pedro","Rafaela","Sérgio","Talita","Vinícius"];
const last = ["Almeida","Barros","Carvalho","Dias","Ferreira","Gomes","Lima","Martins","Nunes","Oliveira","Pereira","Ribeiro","Santos","Teixeira"];
const blood = ["O+","O+","O+","A+","A+","B+","O-","A-","AB+","B-","AB-"]; // proporção aproximada
const regions = ["Centro","Zona Sul","Zona Norte","Zona Leste","Zona Oeste"];
const hash = bcrypt.hashSync("Demo@12345678", 10);

const insUser = db.prepare("INSERT OR IGNORE INTO users (name,email,password_hash,role,blood_type,city,region,profile_completed,created_at) VALUES (?,?,?,'donor',?,?,?,1,?)");
const insDon = db.prepare("INSERT OR IGNORE INTO donation_records (user_id,hemocenter_id,donation_date,status,validated_at) VALUES (?,?,?,'validated',CURRENT_TIMESTAMP)");
const insApp = db.prepare("INSERT INTO appointments (user_id,hemocenter_id,appointment_date,appointment_time,status) VALUES (?,?,?,?,?)");

const run = db.transaction(() => {
  let donations = 0;
  for (let i = 1; i <= 64; i++) {
    const email = `demo${String(i).padStart(2, "0")}@demo.viva`;
    insUser.run(`${pick(first)} ${pick(last)} (demo)`, email, hash, pick(blood), "São Paulo", pick(regions), fmt(daysAgo(Math.floor(rnd() * 200) + 10)));
    const id = db.prepare("SELECT id FROM users WHERE email=?").get(email).id;
    if (rnd() < 0.72) {
      let day = Math.floor(rnd() * 60) + 5;               // última doação recente
      const n = rnd() < 0.4 ? 3 : rnd() < 0.7 ? 2 : 1;    // 1 a 3 doações, com intervalo mínimo de 70 dias
      let lastDate = null;
      for (let k = 0; k < n && day < 190; k++) {
        const d = fmt(daysAgo(day));
        if (insDon.run(id, hcUser.id, d).changes) { donations++; lastDate = lastDate || d; }
        day += 70 + Math.floor(rnd() * 25);
      }
      if (lastDate) db.prepare("UPDATE users SET last_donation_date=? WHERE id=?").run(lastDate, id);
    }
    if (rnd() < 0.35) {
      const st = pick(["confirmed", "confirmed", "pending", "cancelled"]);
      const future = new Date(); future.setDate(future.getDate() + 2 + Math.floor(rnd() * 20));
      insApp.run(id, unitId, fmt(future), pick(["08:00", "09:30", "10:30", "14:00", "15:30"]), st);
    }
  }
  const camp = db.prepare("SELECT COUNT(*) AS n FROM campaigns WHERE title LIKE '%(demo)%'").get().n;
  if (!camp) {
    const end = new Date(); end.setDate(end.getDate() + 25);
    const ins = db.prepare("INSERT INTO campaigns (title,description,blood_type,region,hemocenter_id,start_date,end_date,status) VALUES (?,?,?,?,?,?,?,'active')");
    ins.run("Campanha O- em foco (demo)", "Campanha fictícia de demonstração para doadores do tipo O negativo.", "O-", "Centro", unitId, fmt(new Date()), fmt(end));
    ins.run("Doe antes das férias (demo)", "Campanha fictícia de demonstração para reforçar o estoque antes do recesso.", null, "Zona Sul", unitId, fmt(new Date()), fmt(end));
  }
  return donations;
});
console.log(`Dados fictícios criados: ${run()} doações novas, 64 doadores (demoNN@demo.viva), campanhas (demo).`);
console.log("AVISO: use apenas em ambiente local de apresentação; a interface marca esses números como demonstração.");
