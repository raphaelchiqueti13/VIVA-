import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import QRCode from "qrcode";
import { db } from "./db.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
const PORT = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET;
if (isProduction && (!JWT_SECRET || JWT_SECRET.length < 32)) {
  throw new Error("Em produção, configure JWT_SECRET com pelo menos 32 caracteres aleatórios.");
}
const signingSecret = JWT_SECRET || "local-development-only-secret-change-before-deploying-32";
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",").map(v => v.trim()).filter(Boolean);

app.disable("x-powered-by");
app.use((req,res,next)=>{
  const origin=req.headers.origin;
  if(origin){
    let sameOrigin=false;
    try {const parsed=new URL(origin);sameOrigin=parsed.host===req.headers.host && ["http:","https:"].includes(parsed.protocol);}catch{}
    if(!sameOrigin && allowedOrigins.length && !allowedOrigins.includes(origin)) return res.status(403).json({error:"Origem não autorizada."});
  }
  next();
});
app.use(cors((req,callback)=>{
  const origin=req.headers.origin;
  let same=false;
  try {same=Boolean(origin && new URL(origin).host===req.headers.host);}catch{}
  callback(null,{origin:!origin || same || !allowedOrigins.length || allowedOrigins.includes(origin),methods:["GET","POST","PATCH","PUT","DELETE","OPTIONS"],allowedHeaders:["Content-Type","Authorization"]});
}));
app.use(express.json({ limit: "100kb" }));
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (_req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
  next();
});

// Limitação simples por IP para reduzir tentativas automatizadas. Em produção com
// múltiplas instâncias, substitua por rate limit compartilhado (Redis/gateway).
const attempts = new Map();
const cleanup = setInterval(() => { const now=Date.now(); for (const [key,item] of attempts) if(item.resetAt < now) attempts.delete(key); }, 60000);
cleanup.unref();
function rateLimit({ windowMs = 15 * 60 * 1000, max = 30 } = {}) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const item = attempts.get(key);
    if (!item || now > item.resetAt) attempts.set(key, { count: 1, resetAt: now + windowMs });
    else if (++item.count > max) return res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
    next();
  };
}

const safeUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  bloodType: u.blood_type, bloodTypeVerified: Boolean(u.blood_type_verified),
  region: u.region, lastDonationDate: u.last_donation_date,
  notificationCampaigns: Boolean(u.notification_campaigns),
  notificationEligibility: Boolean(u.notification_eligibility),
  phone: u.phone || "", birthDate: u.birth_date || "", city: u.city || "",
  accessibilityLibras: Boolean(u.accessibility_libras),
  profileCompleted: Boolean(u.profile_completed),
  createdAt: u.created_at,
  hemocenterId: u.hemocenter_id || null
});
const tokenFor = (u) => jwt.sign({ id: u.id, role: u.role }, signingSecret, { expiresIn: "8h", issuer: "viva-plus", audience: "viva-plus-web" });
function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  try {
    if (!token) throw new Error("missing");
    req.auth = jwt.verify(token, signingSecret, { issuer: "viva-plus", audience: "viva-plus-web" });
    req.user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.auth.id);
    if (!req.user) throw new Error("missing user");
    next();
  } catch {
    res.status(401).json({ error: "Sessão inválida ou expirada. Entre novamente." });
  }
}
const only = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Acesso não autorizado." });
  next();
};
const audit = (actor, action, type, id = null) => db.prepare(
  "INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)"
).run(actor || null, action, type, id);
const isDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const validBlood = value => !value || ["A+","A-","B+","B-","AB+","AB-","O+","O-"].includes(value);
const centerScope = user => user.role === "admin" ? null : user.hemocenter_id;
const localDate = () => new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const localTime = () => new Intl.DateTimeFormat("en-GB", {timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());
const dummyHash = bcrypt.hashSync("not-a-real-account-password", 10);


// Estoque não é apresentado como tempo real sem API/autorização oficial.
app.get("/api/blood-stock", (_req,res)=>{
  const rows=db.prepare("SELECT blood_type,level,updated_at FROM blood_stock").all();
  const levels=Object.fromEntries(rows.map(r=>[r.blood_type,r.level]));
  res.json({levels,updatedAt:rows.length?rows[0].updated_at:null,source:"Lançamento administrativo, não integrado à Pró-Sangue"});
});
app.put("/api/admin/blood-stock",auth,only("admin"),(req,res)=>{
  const types=["A+","A-","B+","B-","AB+","AB-","O+","O-"];
  const source=String(req.body.source||"").trim();
  if(source.length<5||source.length>500)return res.status(400).json({error:"Informe fonte e autorização (5 a 500 caracteres)."});
  const levels=req.body.levels||{};
  if(Object.keys(levels).some(k=>!types.includes(k)||!["","Crítico","Baixo","Estável"].includes(levels[k])))return res.status(400).json({error:"Nível inválido."});
  const run=db.transaction(()=>{db.prepare("DELETE FROM blood_stock").run();for(const type of types)if(levels[type])db.prepare("INSERT INTO blood_stock(blood_type,level,source) VALUES(?,?,?)").run(type,levels[type],source);audit(req.user.id,"update_blood_stock","blood_stock");});run();res.json({ok:true});
});
app.get("/api/admin/management",auth,only("admin"),(_req,res)=>res.json({
  users:db.prepare("SELECT id,name FROM users WHERE role='donor' ORDER BY id DESC LIMIT 100").all(),
  campaigns:db.prepare("SELECT id,title FROM campaigns ORDER BY id DESC LIMIT 100").all(),
  donations:db.prepare("SELECT id,user_id AS userId,donation_date AS date FROM donation_records ORDER BY id DESC LIMIT 100").all()
}));
app.delete("/api/admin/management/:kind/:id",auth,only("admin"),(req,res)=>{
  const map={users:"users",campaigns:"campaigns",donations:"donation_records"};const table=map[req.params.kind];const id=Number(req.params.id);
  if(!table||!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:"Registro inválido."});
  try{const result=db.transaction(()=>{const r=db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);if(r.changes)audit(req.user.id,"delete_"+req.params.kind,req.params.kind,id);return r})();
  if(!result.changes)return res.status(404).json({error:"Registro não encontrado."});
  if(req.params.kind==="donations")db.prepare("UPDATE users SET last_donation_date=(SELECT MAX(donation_date) FROM donation_records WHERE user_id=users.id AND status='validated')").run();
  res.json({ok:true});}catch(e){res.status(409).json({error:"Este registro possui vínculos e não pode ser excluído diretamente."})}
});

// Métricas agregadas e anônimas para a página de impacto (sem dados pessoais).
app.get("/api/public/impact", (_req, res) => {
  const one = (sql) => db.prepare(sql).get().n;
  const monthsBack = 6;
  const base = new Date(`${localDate()}T12:00:00`);
  const months = Array.from({ length: monthsBack }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() - (monthsBack - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const perMonth = Object.fromEntries(db.prepare("SELECT strftime('%Y-%m', donation_date) AS m, COUNT(*) AS n FROM donation_records WHERE status='validated' GROUP BY m").all().map(r => [r.m, r.n]));
  const byBlood = Object.fromEntries(db.prepare("SELECT blood_type AS t, COUNT(*) AS n FROM users WHERE role='donor' AND blood_type IS NOT NULL GROUP BY blood_type").all().map(r => [r.t, r.n]));
  const appt = Object.fromEntries(db.prepare("SELECT status, COUNT(*) AS n FROM appointments GROUP BY status").all().map(r => [r.status, r.n]));
  const donors = one("SELECT COUNT(*) AS n FROM users WHERE role='donor'");
  const donations = one("SELECT COUNT(*) AS n FROM donation_records WHERE status='validated'");
  res.json({
    donors,
    donations,
    recurringDonors: one("SELECT COUNT(*) AS n FROM (SELECT user_id FROM donation_records WHERE status='validated' GROUP BY user_id HAVING COUNT(*)>=2)"),
    donorsWithDonation: one("SELECT COUNT(DISTINCT user_id) AS n FROM donation_records WHERE status='validated'"),
    donorsWithAppointment: one("SELECT COUNT(DISTINCT user_id) AS n FROM appointments"),
    appointmentsRequested: Object.values(appt).reduce((a, b) => a + b, 0),
    appointmentsConfirmed: (appt.confirmed || 0) + (appt.completed || 0),
    units: one("SELECT COUNT(*) AS n FROM hemocenters WHERE active=1 AND verified_at IS NOT NULL"),
    activeCampaigns: one("SELECT COUNT(*) AS n FROM campaigns WHERE status='active'"),
    potentialLives: donations * 4,
    monthly: months.map(m => ({ month: m, donations: perMonth[m] || 0 })),
    bloodTypes: ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map(t => ({ type: t, donors: byBlood[t] || 0 })),
    demo: one("SELECT COUNT(*) AS n FROM users WHERE email LIKE '%@demo.viva'") > 0 || one("SELECT COUNT(*) AS n FROM hemocenters WHERE name LIKE '%(teste)%'") > 0,
    generatedAt: new Date().toISOString()
  });
});

app.get("/api/health", (_req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ ok: true, app: "VIVA+", database: "connected", environment: isProduction ? "production" : "development" });
  } catch {
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.post("/api/auth/register", rateLimit({ max: 8 }), (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const bloodType = String(req.body.bloodType || "");
  const phone = String(req.body.phone || "").trim();
  const birthDate = String(req.body.birthDate || "");
  const city = String(req.body.city || "").trim();
  const region = String(req.body.region || "").trim();
  const accessibilityLibras = req.body.accessibilityLibras ? 1 : 0;
  if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180 || password.length < 10 || Buffer.byteLength(password,"utf8") > 72) {
    return res.status(400).json({ error: "Informe nome, e-mail válido e senha com pelo menos 10 caracteres." });
  }
  if (!validBlood(bloodType)) return res.status(400).json({ error: "Selecione um tipo sanguíneo válido ou deixe em branco." });
  if (phone.length > 30 || city.length > 100 || region.length > 80) return res.status(400).json({error:"Dados de contato ou região muito longos."});
  if (birthDate && (!isDate(birthDate) || birthDate > localDate() || Number(localDate().slice(0,4))-Number(birthDate.slice(0,4)) < 16 || (Number(localDate().slice(0,4))-Number(birthDate.slice(0,4)) === 16 && birthDate.slice(5)>localDate().slice(5)))) return res.status(400).json({ error: "Informe uma data de nascimento válida." });
  try {
    const hash = bcrypt.hashSync(password, 12);
    const result = db.prepare("INSERT INTO users (name,email,password_hash,role,blood_type,blood_type_verified,phone,birth_date,city,region,accessibility_libras,profile_completed) VALUES (?,?,?,'donor',?,0,?,?,?,?,?,1)")
      .run(name, email, hash, bloodType || null, phone || null, birthDate || null, city || null, region || null, accessibilityLibras);
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(result.lastInsertRowid);
    audit(user.id, "register", "user", user.id);
    res.status(201).json({ token: tokenFor(user), user: safeUser(user) });
  } catch (e) {
    res.status(e.code === "SQLITE_CONSTRAINT_UNIQUE" ? 409 : 500).json({ error: e.code === "SQLITE_CONSTRAINT_UNIQUE" ? "Este e-mail já está cadastrado." : "Não foi possível criar a conta." });
  }
});

app.post("/api/auth/login", rateLimit({ max: 10 }), (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (Buffer.byteLength(password,"utf8") > 72) return res.status(401).json({error:"E-mail ou senha incorretos."});
  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!bcrypt.compareSync(password, user?.password_hash || dummyHash) || !user) return res.status(401).json({ error: "E-mail ou senha incorretos." });
  audit(user.id, "login", "user", user.id);
  res.json({ token: tokenFor(user), user: safeUser(user) });
});

app.get("/api/me", auth, (req, res) => res.json({ user: safeUser(req.user) }));

// QR temporário: somente uma instituição autenticada pode verificar o token.
// O identificador único é consumido uma única vez para impedir replay.
app.post("/api/wallet-qr/verify", auth, only("hemocenter", "admin"), (req, res) => {
  try {
    const payload = jwt.verify(String(req.body.token || ""), signingSecret, { issuer: "viva-plus", audience: "viva-plus-qr" });
    if (payload.purpose !== "viva-wallet-check" || !payload.sub || !payload.jti) return res.status(400).json({ valid: false, error: "QR inválido." });
    const donor = db.prepare("SELECT id,name,role FROM users WHERE id=?").get(Number(payload.sub));
    if (!donor || donor.role !== "donor") return res.status(404).json({ valid: false, error: "Carteira não encontrada." });
    db.prepare("INSERT INTO qr_verifications (jti, donor_id, institution_user_id) VALUES (?,?,?)").run(payload.jti, donor.id, req.user.id);
    audit(req.user.id, "verify_wallet_qr", "user", donor.id);
    res.json({ valid: true, donor: { id: donor.id, name: donor.name }, verifiedAt: new Date().toISOString(), singleUse: true });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ valid: false, error: "Este QR já foi utilizado. Solicite um novo código ao doador." });
    res.status(401).json({ valid: false, error: "QR expirado ou inválido. Solicite um novo código." });
  }
});

app.get("/api/me/wallet-qr", auth, async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const payload = { purpose: "viva-wallet-check", sub: String(req.user.id), jti: crypto.randomUUID() };
    const signed = jwt.sign(payload, signingSecret, { expiresIn: "20s", issuer: "viva-plus", audience: "viva-plus-qr" });
    const qrData = signed;
    const image = await QRCode.toDataURL(qrData, { errorCorrectionLevel: "M", margin: 1, width: 260, color: { dark: "#351018", light: "#ffffff" } });
    res.json({ image, expiresAt: new Date((now + 20) * 1000).toISOString(), refreshIn: 15 });
  } catch {
    res.status(500).json({ error: "Não foi possível gerar o QR dinâmico." });
  }
});

app.patch("/api/me/preferences", auth, (req, res) => {
  const campaigns = req.body.notificationCampaigns == null ? req.user.notification_campaigns : Number(Boolean(req.body.notificationCampaigns));
  const eligibility = req.body.notificationEligibility == null ? req.user.notification_eligibility : Number(Boolean(req.body.notificationEligibility));
  db.prepare("UPDATE users SET notification_campaigns=?, notification_eligibility=? WHERE id=?").run(campaigns, eligibility, req.user.id);
  audit(req.user.id, "update_preferences", "user", req.user.id);
  res.json({ user: safeUser(db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id)) });
});

app.get("/api/dashboard", auth, (req, res) => {
  const donations = db.prepare(`SELECT d.id,d.donation_date AS date,d.status,h.name AS hemocenter
    FROM donation_records d LEFT JOIN hemocenters h ON h.id=d.hemocenter_id
    WHERE d.user_id=? ORDER BY d.donation_date DESC`).all(req.user.id);
  const count = donations.filter(d => d.status === "validated").length;
  const level = count >= 10 ? "Diamante" : count >= 5 ? "Ouro" : count >= 3 ? "Prata" : count >= 1 ? "Bronze" : "Iniciante";
  const next = count >= 10 ? 10 : count >= 5 ? 10 : count >= 3 ? 5 : count >= 1 ? 3 : 1;
  const appointments = db.prepare(`SELECT a.id,a.appointment_date AS date,a.appointment_time AS time,a.status,
    h.name AS hemocenter,h.address,h.region,h.city,h.state,a.institution_note AS institutionNote
    FROM appointments a JOIN hemocenters h ON h.id=a.hemocenter_id
    WHERE a.user_id=? ORDER BY a.appointment_date,a.appointment_time`).all(req.user.id);
  res.json({ donations, donationCount: count, level, nextLevelAt: next, appointments });
});

app.get("/api/hemocenters", (_req, res) => {
  res.json(db.prepare(`SELECT id,name,region,address,city,state,phone,opening_hours,
    source_url AS sourceUrl, booking_url AS bookingUrl, verified_at AS verifiedAt
    FROM hemocenters WHERE active=1 AND verified_at IS NOT NULL ORDER BY name`).all());
});

app.get("/api/campaigns", auth, (req, res) => {
  const rows = db.prepare(`SELECT c.id,c.title,c.description,c.blood_type AS bloodType,c.region,
    c.start_date AS startDate,c.end_date AS endDate,h.name AS hemocenter
    FROM campaigns c LEFT JOIN hemocenters h ON h.id=c.hemocenter_id
    WHERE c.status='active' AND date(c.start_date)<=date(?) AND date(c.end_date)>=date(?)
    AND (c.region='Nacional' OR c.region=?)
    ORDER BY c.start_date`).all(localDate(),localDate(),req.user.region || "__SEM_REGIAO__");
  res.json(rows);
});

// Solicitação interna: não promete vaga externa. A instituição vinculada precisa confirmar.
app.post("/api/appointments", auth, (req, res) => {
  const hemocenterId = Number(req.body.hemocenterId);
  const date = String(req.body.date || "");
  const time = String(req.body.time || "");
  if (!Number.isInteger(hemocenterId) || !isDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return res.status(400).json({ error: "Informe unidade, data e horário válidos." });
  }
  if (date < localDate() || (date === localDate() && time <= localTime())) return res.status(400).json({ error: "Escolha uma data futura." });
  const pendingCount = db.prepare("SELECT COUNT(*) AS n FROM appointments WHERE user_id=? AND appointment_date=? AND status IN ('pending','confirmed')").get(req.user.id,date).n;
  if(pendingCount >= 2) return res.status(409).json({error:"Limite de duas solicitações ativas por dia."});
  const center = db.prepare("SELECT id,booking_url FROM hemocenters WHERE id=? AND active=1 AND verified_at IS NOT NULL").get(hemocenterId);
  if (!center) return res.status(404).json({ error: "Unidade não encontrada ou ainda não verificada." });
  const exists = db.prepare("SELECT id FROM appointments WHERE hemocenter_id=? AND appointment_date=? AND appointment_time=? AND status IN ('pending','confirmed')").get(hemocenterId,date,time);
  if (exists) return res.status(409).json({ error: "Este horário já recebeu uma solicitação. Escolha outro." });
  const result = db.prepare("INSERT INTO appointments (user_id,hemocenter_id,appointment_date,appointment_time,status) VALUES (?,?,?,?,'pending')").run(req.user.id,hemocenterId,date,time);
  audit(req.user.id, "request_appointment", "appointment", result.lastInsertRowid);
  res.status(201).json({
    id: result.lastInsertRowid,
    status: "pending",
    message: center.booking_url
      ? "Solicitação registrada no VIVA+. Para confirmação oficial, use também o canal de agendamento da instituição."
      : "Solicitação registrada no VIVA+. A unidade precisa confirmar o horário; o registro não reserva vaga no sistema externo."
  });
});

app.patch("/api/appointments/:id/cancel", auth, (req, res) => {
  const appt = db.prepare("SELECT * FROM appointments WHERE id=?").get(Number(req.params.id));
  if (!appt) return res.status(404).json({ error: "Agendamento não encontrado." });
  if (appt.user_id !== req.user.id && !["admin","hemocenter"].includes(req.user.role)) return res.status(403).json({ error: "Acesso não autorizado." });
  if (!["pending","confirmed"].includes(appt.status)) return res.status(400).json({ error: "Este agendamento não pode ser cancelado." });
  if (req.user.role === "hemocenter" && req.user.hemocenter_id !== appt.hemocenter_id) return res.status(403).json({ error: "Agendamento de outra unidade." });
  db.prepare("UPDATE appointments SET status='cancelled' WHERE id=?").run(appt.id);
  audit(req.user.id, "cancel_appointment", "appointment", appt.id);
  res.json({ message: "Solicitação cancelada." });
});

app.get("/api/institution/summary", auth, only("hemocenter","admin"), (req, res) => {
  const scope = centerScope(req.user);
  if (req.user.role === "hemocenter" && !scope) return res.status(403).json({ error: "Perfil institucional sem unidade vinculada." });

  const appointmentWhere = req.user.role === "admin" ? " WHERE status IN ('pending','confirmed')" : " WHERE hemocenter_id=? AND status IN ('pending','confirmed')";
  const campaignWhere = req.user.role === "admin" ? " WHERE status='active'" : " WHERE hemocenter_id=? AND status='active'";
  const donations = db.prepare(`SELECT COUNT(*) AS total FROM donation_records WHERE status='validated' ${req.user.role === "admin" ? "" : "AND hemocenter_id=?"}`).get(...(scope ? [scope] : [])).total;
  const donors = db.prepare(`SELECT COUNT(DISTINCT user_id) AS total FROM donation_records WHERE status='validated' ${req.user.role === "admin" ? "" : "AND hemocenter_id=?"}`).get(...(scope ? [scope] : [])).total;
  const appointments = db.prepare(`SELECT COUNT(*) AS total FROM appointments${appointmentWhere}`).get(...(scope ? [scope] : [])).total;
  const campaigns = db.prepare(`SELECT COUNT(*) AS total FROM campaigns${campaignWhere}`).get(...(scope ? [scope] : [])).total;
  res.json({ donations, donors, appointments, campaigns, scope: req.user.role === "admin" ? "all" : "institution" });
});

app.get("/api/institution/appointments", auth, only("hemocenter","admin"), (req, res) => {
  if (req.user.role === "hemocenter" && !req.user.hemocenter_id) return res.status(403).json({ error: "Perfil institucional sem unidade vinculada." });
  const rows = req.user.role === "admin"
    ? db.prepare(`SELECT a.id,a.appointment_date AS date,a.appointment_time AS time,a.status,u.name AS donor,h.name AS hemocenter
      FROM appointments a JOIN users u ON u.id=a.user_id JOIN hemocenters h ON h.id=a.hemocenter_id
      WHERE a.status IN ('pending','confirmed') ORDER BY a.appointment_date,a.appointment_time`).all()
    : db.prepare(`SELECT a.id,a.appointment_date AS date,a.appointment_time AS time,a.status,u.name AS donor,h.name AS hemocenter
      FROM appointments a JOIN users u ON u.id=a.user_id JOIN hemocenters h ON h.id=a.hemocenter_id
      WHERE a.hemocenter_id=? AND a.status IN ('pending','confirmed') ORDER BY a.appointment_date,a.appointment_time`).all(req.user.hemocenter_id);
  res.json(rows);
});

app.patch("/api/institution/appointments/:id/confirm", auth, only("hemocenter","admin"), (req, res) => {
  const appt = db.prepare("SELECT * FROM appointments WHERE id=?").get(Number(req.params.id));
  if (!appt) return res.status(404).json({ error: "Solicitação não encontrada." });
  if (req.user.role === "hemocenter" && req.user.hemocenter_id !== appt.hemocenter_id) return res.status(403).json({ error: "Solicitação de outra unidade." });
  if (appt.status !== "pending") return res.status(409).json({ error: "Somente solicitações pendentes podem ser confirmadas." });
  db.prepare("UPDATE appointments SET status='confirmed' WHERE id=?").run(appt.id);
  audit(req.user.id, "confirm_appointment", "appointment", appt.id);
  res.json({ message: "Solicitação confirmada no VIVA+. Confirme também no sistema externo, se houver." });
});

app.post("/api/institution/donations", auth, only("hemocenter","admin"), (req, res) => {
  const userId = Number(req.body.userId);
  const date = String(req.body.date || "");
  if (!Number.isInteger(userId) || !isDate(date) || date > localDate()) return res.status(400).json({ error: "Informe doador e data de doação válida, não futura." });
  if (req.user.role === "hemocenter" && !req.user.hemocenter_id) return res.status(403).json({ error: "Perfil institucional sem unidade vinculada." });
  const donor = db.prepare("SELECT id FROM users WHERE id=? AND role='donor'").get(userId);
  if (!donor) return res.status(404).json({ error: "Doador não encontrado." });
  const institutionId = req.user.role === "admin" ? (req.body.hemocenterId ? Number(req.body.hemocenterId) : null) : req.user.hemocenter_id;
  if (institutionId && !db.prepare("SELECT id FROM hemocenters WHERE id=? AND active=1").get(institutionId)) return res.status(400).json({error:"Unidade inválida."});
  if(db.prepare("SELECT id FROM donation_records WHERE user_id=? AND donation_date=? AND status='validated'").get(userId,date)) return res.status(409).json({error:"Já existe uma doação validada nesta data para este doador."});
  try {
    const result = db.prepare("INSERT INTO donation_records (user_id,hemocenter_id,donation_date,status,validated_at) VALUES (?,?,?,'validated',CURRENT_TIMESTAMP)").run(userId,institutionId,date);
    db.prepare("UPDATE users SET last_donation_date=? WHERE id=?").run(date,userId);
    audit(req.user.id, "validate_donation", "donation", result.lastInsertRowid);
    res.status(201).json({ id: result.lastInsertRowid, message: "Registro de doação validado por perfil institucional autenticado." });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "Já existe uma doação validada para este doador nesta data e instituição." });
    throw error;
  }
});

app.get("/api/institution/donors", auth, only("hemocenter","admin"), (_req, res) => {
  res.json(db.prepare("SELECT id,name,role,region,last_donation_date AS lastDonationDate FROM users WHERE role='donor' ORDER BY name LIMIT 200").all());
});

app.post("/api/institution/campaigns", auth, only("hemocenter","admin"), (req,res) => {
  const title = String(req.body.title || "").trim();
  const description = String(req.body.description || "").trim();
  const bloodType = String(req.body.bloodType || "");
  const region = String(req.body.region || "").trim();
  const startDate = String(req.body.startDate || "");
  const endDate = String(req.body.endDate || "");
  let hemocenterId = req.body.hemocenterId ? Number(req.body.hemocenterId) : (req.user.hemocenter_id || null);
  if (req.user.role === "hemocenter") hemocenterId = req.user.hemocenter_id;
  if (!title || title.length > 120 || !description || description.length > 2000 || !region || !isDate(startDate) || !isDate(endDate) || endDate < startDate || !validBlood(bloodType)) {
    return res.status(400).json({error:"Preencha título, descrição, região, tipo sanguíneo e período válido."});
  }
  if (req.user.role === "hemocenter" && !hemocenterId) return res.status(403).json({error:"Perfil institucional sem unidade vinculada."});
  if (hemocenterId && !db.prepare("SELECT id FROM hemocenters WHERE id=? AND verified_at IS NOT NULL AND active=1").get(hemocenterId)) return res.status(400).json({error:"Selecione uma unidade ativa e verificada."});
  const result = db.prepare(`INSERT INTO campaigns (title,description,blood_type,region,start_date,end_date,hemocenter_id)
    VALUES (?,?,?,?,?,?,?)`).run(title,description,bloodType || null,region,startDate,endDate,hemocenterId);
  audit(req.user.id,"create_campaign","campaign",result.lastInsertRowid);
  res.status(201).json({id:result.lastInsertRowid,message:"Campanha publicada no VIVA+."});
});

// Diretório só aceita cadastros inseridos/verificados por administrador com fonte oficial.
app.post("/api/admin/hemocenters", auth, only("admin"), (req,res) => {
  const name = String(req.body.name || "").trim();
  const region = String(req.body.region || "").trim();
  const address = String(req.body.address || "").trim();
  const city = String(req.body.city || "").trim();
  const state = String(req.body.state || "").trim().toUpperCase();
  const sourceUrl = String(req.body.sourceUrl || "").trim();
  const bookingUrl = String(req.body.bookingUrl || "").trim();
  if (!name || !region || !address || !city || !/^[A-Z]{2}$/.test(state) || !sourceUrl.toLowerCase().startsWith("https://")) {
    return res.status(400).json({ error: "Informe unidade, endereço, cidade, UF e URL HTTPS de uma fonte oficial." });
  }
  if (bookingUrl && !bookingUrl.toLowerCase().startsWith("https://")) return res.status(400).json({ error: "O link de agendamento precisa usar HTTPS." });
  const result = db.prepare(`INSERT INTO hemocenters
    (name,region,address,city,state,phone,opening_hours,source_url,booking_url,verified_at,verified_by)
    VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,?)`)
    .run(name,region,address,city,state,String(req.body.phone || ""),String(req.body.openingHours || ""),sourceUrl,bookingUrl || null,req.user.id);
  audit(req.user.id,"create_verified_hemocenter","hemocenter",result.lastInsertRowid);
  res.status(201).json({ id: result.lastInsertRowid, message: "Unidade cadastrada com fonte informada. Confira os dados antes de publicar." });
});

function changeAppointmentStatus(action, allowed, status) {
  app.patch(`/api/institution/appointments/:id/${action}`, auth, only("hemocenter","admin"), (req,res)=>{
    const a=db.prepare("SELECT * FROM appointments WHERE id=?").get(Number(req.params.id));
    if(!a) return res.status(404).json({error:"Solicitação não encontrada."});
    if(req.user.role==="hemocenter" && req.user.hemocenter_id!==a.hemocenter_id) return res.status(403).json({error:"Outra unidade."});
    if(!allowed.includes(a.status)) return res.status(409).json({error:"Estado incompatível."});
    db.prepare("UPDATE appointments SET status=? WHERE id=?").run(status,a.id);
    audit(req.user.id,action+"_appointment","appointment",a.id);
    res.json({message:"Solicitação atualizada."});
  });
}
changeAppointmentStatus("reject",["pending"],"cancelled");
changeAppointmentStatus("complete",["confirmed"],"completed");
app.patch("/api/institution/donors/:id/blood-type", auth, only("hemocenter","admin"), (req,res)=>{
  const bloodType=String(req.body.bloodType||"");
  if(!bloodType || !validBlood(bloodType)) return res.status(400).json({error:"Tipo sanguíneo inválido."});
  const donor=db.prepare("SELECT id FROM users WHERE id=? AND role='donor'").get(Number(req.params.id));
  if(!donor) return res.status(404).json({error:"Doador não encontrado."});
  db.prepare("UPDATE users SET blood_type=?,blood_type_verified=1 WHERE id=?").run(bloodType,donor.id);
  audit(req.user.id,"validate_blood_type","user",donor.id);
  res.json({message:"Tipo sanguíneo validado no VIVA+."});
});
// Em produção, a API e o frontend podem ser publicados no mesmo serviço.
if (isProduction) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(here, "../dist");
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = [400,401,403,404,409,413,429].includes(err.status) ? err.status : 500;
  res.status(status).json({ error: status === 413 ? "Solicitação muito grande." : status === 400 ? "JSON inválido." : "Erro interno. Tente novamente." });
});
app.listen(PORT, () => console.log(`VIVA+ API ouvindo na porta ${PORT}`));
