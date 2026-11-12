import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check,
  ChevronDown, ChevronRight, CircleHelp, Clock3, Droplet, Heart, HeartPulse,
  Home, LogIn, MapPin, Menu, ShieldCheck, Sparkles, Users, X, QrCode, Award,
  Building2, BarChart3, HandHeart, Bus, GraduationCap, Stethoscope, University, Ticket, LogOut, Settings, LockKeyhole, ClipboardCheck, Sun, Moon, Accessibility, Type, Contrast, Eye, RotateCcw, Copy, BadgeCheck, Lock
} from "lucide-react";
import RequirementsPage from "./Requirements";
import ImpactPage from "./Impact";
import { levels, benefits, benefitsFor, isUnlocked, levelByName } from "./benefits";
import { api, clearSession, getSavedUser, getToken, setSession, safeGet, safeSet } from "./api";
import "./style.css";

const fmtDate = (s) => s ? new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR") : "Não informado";
const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
})();
const bloodTypes = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];
const iconMap = { Bus, GraduationCap, HeartPulse, Stethoscope, University, Ticket, BadgeCheck };
function App() {
  const [user, setUser] = useState(getSavedUser());
  const [page, setPage] = useState("inicio");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modal, setModal] = useState("");
  const [toast, setToast] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", bloodType: "", phone: "", birthDate: "", city: "", region: "", accessibilityLibras: false });
  const [dashboard, setDashboard] = useState({ donations: [], donationCount: 0, level: "Iniciante", nextLevelAt: 1, appointments: [] });
  const [centers, setCenters] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [summary, setSummary] = useState(null);
  const [donors, setDonors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [apptForm, setApptForm] = useState({ hemocenterId: "", date: "", time: "09:00" });
  const [campaignForm, setCampaignForm] = useState({ title: "", description: "", bloodType: "", region: "Nacional", startDate: today, endDate: today, hemocenterId: "" });
  const [donationForm, setDonationForm] = useState({ userId: "", date: today });
  const [search, setSearch] = useState("");
  const [preferences, setPreferences] = useState({ notificationCampaigns: true, notificationEligibility: true });
  const [theme, setTheme] = useState(() => safeGet("viva_theme") || "light");
  const [fontScale, setFontScale] = useState(() => safeGet("viva_font_scale") || "100");
  const [highContrast, setHighContrast] = useState(() => safeGet("viva_high_contrast") === "true");
  const [reduceMotion, setReduceMotion] = useState(() => {
    const saved = safeGet("viva_reduce_motion");
    return saved === null ? window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false : saved === "true";
  });
  const [underlineLinks, setUnderlineLinks] = useState(() => safeGet("viva_underline_links") === "true");

  const notify = (msg) => { setToast(msg); window.setTimeout(() => setToast(""), 3500); };
  async function loadData(activeUser = user) {
    try {
      const c = await api("/hemocenters"); setCenters(c);
      if(getToken()){ const me=await api("/me"); setUser(me.user); setSession(getToken(),me.user); activeUser=me.user; }
      if (getToken()) {
        const d = await api("/dashboard"); setDashboard(d);
        setPreferences({ notificationCampaigns: activeUser?.notificationCampaigns ?? true, notificationEligibility: activeUser?.notificationEligibility ?? true });
        const cs = await api("/campaigns"); setCampaigns(cs);
        if (["admin","hemocenter"].includes(activeUser?.role)) {
          const [s, ds] = await Promise.all([api("/institution/summary"), api("/institution/donors")]);
          setSummary(s); setDonors(ds);
        }
      }
    } catch (e) {
      if (/Sessão inválida|expirada/.test(e.message)) { clearSession(); setUser(null); notify("Sua sessão expirou. Faça login novamente."); }
      else notify(e.message);
    }
  }
  useEffect(() => { loadData(user); }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.fontScale = fontScale;
    root.dataset.highContrast = String(highContrast);
    root.dataset.reduceMotion = String(reduceMotion);
    root.dataset.underlineLinks = String(underlineLinks);
    safeSet("viva_theme", theme);
    safeSet("viva_font_scale", fontScale);
    safeSet("viva_high_contrast", String(highContrast));
    safeSet("viva_reduce_motion", String(reduceMotion));
    safeSet("viva_underline_links", String(underlineLinks));
  }, [theme, fontScale, highContrast, reduceMotion, underlineLinks]);
  useEffect(() => {
    const handleShortcut = (event) => {
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setModal(current => current === "accessibility" ? "" : "accessibility");
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3500); return () => clearTimeout(t); }, [toast]);

  async function submitAuth(e) {
    e.preventDefault(); setBusy(true);
    try {
      const result = await api(authMode === "login" ? "/auth/login" : "/auth/register", { method: "POST", body: JSON.stringify(authForm) });
      setSession(result.token, result.user); setUser(result.user); setAuthForm({name:"",email:"",password:"",bloodType:"",phone:"",birthDate:"",city:"",region:"",accessibilityLibras:false}); setPage("inicio"); setModal("");
      await loadData(result.user); notify(`Bem-vindo${result.user.name ? ", " + result.user.name.split(" ")[0] : ""}!`);
    } catch (e) { notify(e.message); }
    finally { setBusy(false); }
  }
  function logout() { setAuthForm({name:"",email:"",password:"",bloodType:"",phone:"",birthDate:"",city:"",region:"",accessibilityLibras:false}); setCampaigns([]); setDonors([]); clearSession(); setUser(null); setPage("inicio"); setDashboard({ donations: [], donationCount: 0, level: "Iniciante", nextLevelAt: 1, appointments: [] }); setSummary(null); notify("Você saiu da sua conta."); }
  function go(next) { setPage(next); setMobileOpen(false); if (next === "agendar") setModal("appointment"); }
  async function book(e) {
    e.preventDefault(); setBusy(true);
    try {
      await api("/appointments", { method: "POST", body: JSON.stringify(apptForm) });
      await loadData(); setModal(""); notify("Solicitação registrada no VIVA+. Aguarde a confirmação da unidade.");
    } catch (e) { notify(e.message); } finally { setBusy(false); }
  }
  async function cancelAppointment(id) {
    try { await api(`/appointments/${id}/cancel`, { method: "PATCH" }); await loadData(); notify("Agendamento cancelado."); }
    catch(e) { notify(e.message); }
  }
  async function savePreferences(e) {
    e.preventDefault();
    try {
      const r = await api("/me/preferences", { method:"PATCH", body: JSON.stringify(preferences) });
      setUser(r.user); setSession(getToken(),r.user); notify("Preferências atualizadas.");
    } catch(e) { notify(e.message); }
  }
  async function createCampaign(e) {
    e.preventDefault(); setBusy(true);
    try { await api("/institution/campaigns",{method:"POST",body:JSON.stringify(campaignForm)}); await loadData(); notify("Campanha criada."); setCampaignForm({...campaignForm,title:"",description:""}); }
    catch(e) { notify(e.message); } finally { setBusy(false); }
  }
  async function validateDonation(e) {
    e.preventDefault(); setBusy(true);
    try { await api("/institution/donations",{method:"POST",body:JSON.stringify(donationForm)}); await loadData(); notify("Doação validada."); }
    catch(e) { notify(e.message); } finally { setBusy(false); }
  }

  const nav = [
    { id:"inicio", label:"Visão geral", icon:Home },
    { id:"impacto", label:"Impacto", icon:BarChart3 },
    { id:"carteira", label:"Minha carteira", icon:QrCode },
    { id:"campanhas", label:"Campanhas", icon:HeartPulse },
    { id:"propostas", label:"Propostas e benefícios", icon:HandHeart },
    { id:"requisitos", label:"Requisitos para doar", icon:ClipboardCheck },
    { id:"hemocentros", label:"Hemocentros", icon:MapPin },
    { id:"agendamentos", label:"Agendamentos", icon:CalendarDays },
    { id:"selos", label:"Meus selos", icon:Award },
  ];
  const filteredCenters = centers.filter(c => `${c.name} ${c.region} ${c.address}`.toLowerCase().includes(search.toLowerCase()));
  const count = dashboard.donationCount || 0;
  const nextLevel = levels.find(l => count < l.count) || null;
  const progress = nextLevel ? Math.min(100, count / nextLevel.count * 100) : 100;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Pular para o conteúdo principal</a>
    <button className="libras-shortcut" type="button" onClick={()=>setModal("accessibility")} aria-label="Abrir opções de acessibilidade"><Accessibility size={24}/></button>
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <button className="brand" type="button" onClick={() => go("inicio")}><span className="brand-mark"><Droplet size={23} fill="currentColor"/></span><span>VIVA<span className="brand-plus">+</span><small>CARTEIRA DO DOADOR</small></span></button>
      <div className="side-label">MENU PRINCIPAL</div>
      <nav>{nav.map(n => <button key={n.id} className={`nav-item ${page===n.id ? "active" : ""}`} aria-current={page===n.id ? "page" : undefined} onClick={() => go(n.id)}><n.icon size={18}/><span>{n.label}</span>{page===n.id && <ChevronRight size={15} className="nav-arrow"/>}</button>)}</nav>
      {user?.role === "admin" && <button className={`nav-item ${page==="administracao"?"active":""}`} onClick={()=>go("administracao")}><Settings size={18}/><span>Administração</span></button>}
      {user && ["admin","hemocenter"].includes(user.role) && <><div className="side-label side-label-spaced">INSTITUCIONAL</div><button className={`nav-item ${page==="institucional"?"active":""}`} onClick={()=>go("institucional")}><BarChart3 size={18}/><span>Painel institucional</span></button></>}
      <div className="sidebar-bottom"><div className="help-card"><span className="help-icon"><Heart size={17}/></span><strong>Uma doação pode salvar até 4 vidas.</strong><p>Obrigado por fazer parte dessa corrente.</p><button onClick={() => setModal("about")}>Conheça o VIVA+ <ArrowRight size={14}/></button></div><div className="side-footer"><ShieldCheck size={14}/> Seus dados merecem cuidado</div></div>
    </aside>
    {mobileOpen && <div className="mobile-scrim" onClick={() => setMobileOpen(false)} />}
    <main className="main-area" id="main-content" tabIndex="-1">
      <header className="topbar">
        <button className="mobile-menu icon-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={mobileOpen}>{mobileOpen?<X/>:<Menu/>}</button>
        <div className="breadcrumb">VIVA+ <ChevronRight size={14}/> <span>{nav.find(n=>n.id===page)?.label || (page==="institucional"?"Painel institucional":"Configurações")}</span></div>
        <div className="top-actions"><span className="secure-chip"><ShieldCheck size={14}/> Conexão protegida</span>
          <button className="icon-button theme-switch" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-pressed={theme === "dark"} aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"} title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}>{theme === "dark" ? <Sun size={18}/> : <Moon size={18}/>}</button>
          <button className="btn btn-secondary accessibility-button" onClick={() => setModal("accessibility")} aria-haspopup="dialog"><Accessibility size={16}/><span>Acessibilidade</span></button>
          {user ? <><button className="icon-button notification" title="Notificações" onClick={()=>go("campanhas")}><Bell size={18}/><i/></button><button className="profile-button" onClick={()=>setModal("profile")}><span className="avatar">{user.name?.charAt(0).toUpperCase()}</span><span className="profile-text"><b>{user.name?.split(" ")[0]}</b><small>{user.role==="donor"?"Doador":user.role==="admin"?"Administrador":"Hemocentro"}</small></span><ChevronDown size={15}/></button></> : <button className="btn btn-primary btn-small" onClick={()=>{setAuthMode("login");setModal("auth")}}><LogIn size={16}/> Entrar</button>}
        </div>
      </header>
      <div className="page-content">
        {!user && <div className="demo-banner"><span><Sparkles size={17}/></span><div><b>Bem-vindo ao VIVA+</b><p>Crie sua conta para acompanhar sua carteira, campanhas e solicitações de agendamento.</p></div><button onClick={()=>{setAuthMode("register");setModal("auth")}}>Criar conta <ArrowRight size={15}/></button></div>}
        {page==="administracao" && user?.role==="admin" && <AdminManagement/>}
        {page==="inicio" && <HomePage user={user} dashboard={dashboard} count={count} nextLevel={nextLevel} progress={progress} campaigns={campaigns} centers={centers} onNavigate={go} onAuth={()=>{setAuthMode("register");setModal("auth")}} onBook={()=>user?setModal("appointment"):(setAuthMode("login"),setModal("auth"))}  onAccessibility={()=>setModal("accessibility")}/>}
        {page==="carteira" && <WalletPage user={user} dashboard={dashboard} count={count} onAuth={()=>{setAuthMode("login");setModal("auth")}}/>}
        {page==="campanhas" && <CampaignPage user={user} campaigns={campaigns} onAuth={()=>{setAuthMode("login");setModal("auth")}} onBook={()=>user?setModal("appointment"):(setAuthMode("login"),setModal("auth"))}/> }
        {page==="propostas" && <ProposalsPage user={user} count={count} dashboard={dashboard} onAuth={()=>{setAuthMode("register");setModal("auth")}} onNavigate={go}/>}
        {page==="impacto" && <ImpactPage onAuth={()=>{setAuthMode("register");setModal("auth")}} onNavigate={go}/>}
        {page==="requisitos" && <RequirementsPage onBook={()=>user?setModal("appointment"):(setAuthMode("login"),setModal("auth"))}/>}
        {page==="hemocentros" && <CentersPage centers={filteredCenters} search={search} setSearch={setSearch} notify={notify}/>}
        {page==="agendamentos" && <AppointmentsPage user={user} appointments={dashboard.appointments} onBook={()=>user?setModal("appointment"):(setAuthMode("login"),setModal("auth"))} onCancel={cancelAppointment} onAuth={()=>{setAuthMode("login");setModal("auth")}}/>}
        {page==="selos" && <BadgesPage count={count} onNavigate={go}/>}
        {page==="institucional" && <InstitutionPage user={user} summary={summary} donors={donors} centers={centers} campaignForm={campaignForm} setCampaignForm={setCampaignForm} createCampaign={createCampaign} donationForm={donationForm} setDonationForm={setDonationForm} validateDonation={validateDonation} busy={busy}/>}
        {page==="configuracoes" && <SettingsPage user={user} preferences={preferences} setPreferences={setPreferences} onSubmit={savePreferences} onAuth={()=>{setAuthMode("login");setModal("auth")}}/>}
        <footer className="page-footer"><span>© 2026 VIVA+ · Tecnologia que transforma solidariedade em impacto.</span><span><LockKeyhole size={13}/> Privacidade em primeiro lugar</span></footer>
      </div>
    </main>
    {toast && <div className="toast" role="status" aria-live="polite" aria-atomic="true"><span><Check size={16}/></span>{toast}</div>}
    {modal==="accessibility" && <Modal title="Acessibilidade" subtitle="Personalize a leitura e a aparência do VIVA+. Atalho: Alt + Shift + A." onClose={()=>setModal("")}>
      <div className="a11y-settings">
        <section className="a11y-setting" aria-labelledby="a11y-theme-label">
          <div className="a11y-label-row"><Sun size={17}/><div><h3 id="a11y-theme-label">Aparência</h3><p>Escolha o tema mais confortável para você.</p></div></div>
          <div className="a11y-segmented" role="group" aria-label="Tema de cores">
            <button type="button" aria-pressed={theme==="light"} className={theme==="light"?"selected":""} onClick={()=>setTheme("light")}><Sun size={16}/> Claro</button>
            <button type="button" aria-pressed={theme==="dark"} className={theme==="dark"?"selected":""} onClick={()=>setTheme("dark")}><Moon size={16}/> Escuro</button>
          </div>
        </section>
        <section className="a11y-setting" aria-labelledby="a11y-font-label">
          <div className="a11y-label-row"><Type size={17}/><div><h3 id="a11y-font-label">Tamanho do texto</h3><p>Amplie os textos e controles da interface.</p></div></div>
          <div className="a11y-font-controls"><button type="button" className="font-step" disabled={fontScale==="100"} onClick={()=>setFontScale(v=>({"150":"125","125":"110","110":"100","100":"100"}[v]||"100"))} aria-label="Diminuir tamanho do texto">A−</button><output aria-live="polite">{fontScale}%</output><button type="button" className="font-step" disabled={fontScale==="150"} onClick={()=>setFontScale(v=>({"100":"110","110":"125","125":"150","150":"150"}[v]||"110"))} aria-label="Aumentar tamanho do texto">A+</button></div>
        </section>
        <section className="a11y-setting" aria-labelledby="a11y-visual-label">
          <div className="a11y-label-row"><Contrast size={17}/><div><h3 id="a11y-visual-label">Preferências visuais</h3><p>As escolhas são guardadas neste navegador.</p></div></div>
          <label className="a11y-toggle"><span><b>Alto contraste</b><small>Reforça bordas, textos e estados de foco.</small></span><input type="checkbox" checked={highContrast} onChange={e=>setHighContrast(e.target.checked)}/></label>
          <label className="a11y-toggle"><span><b>Reduzir animações</b><small>Minimiza transições e movimento na interface.</small></span><input type="checkbox" checked={reduceMotion} onChange={e=>setReduceMotion(e.target.checked)}/></label>
          <label className="a11y-toggle"><span><b>Sublinhar links</b><small>Ajuda a diferenciar links do texto comum.</small></span><input type="checkbox" checked={underlineLinks} onChange={e=>setUnderlineLinks(e.target.checked)}/></label>
        </section>
        <div className="a11y-help"><Eye size={16}/><p>Também é possível navegar usando a tecla Tab, ativar controles com Enter ou Espaço e usar um leitor de tela. O atalho <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd> abre este painel.</p></div>
        <button className="btn btn-secondary btn-full" type="button" onClick={()=>{setTheme("light");setFontScale("100");setHighContrast(false);setReduceMotion(false);setUnderlineLinks(false);}}> <RotateCcw size={15}/> Restaurar preferências padrão</button>
      </div>
    </Modal>}
    {modal==="auth" && <Modal title={authMode==="login"?"Que bom ter você de volta":"Crie sua conta VIVA+"} subtitle={authMode==="login"?"Entre para acessar sua carteira digital.":"Comece sua jornada de solidariedade."} onClose={()=>setModal("")}>
      <form className="form-stack" onSubmit={submitAuth}>
        {authMode==="register" && <>
          <Field label="Nome completo"><input required minLength="2" autoComplete="name" placeholder="Nome e sobrenome" value={authForm.name} onChange={e=>setAuthForm({...authForm,name:e.target.value})}/></Field>
          <div className="form-row">
            <Field label="Data de nascimento"><input type="date" autoComplete="bday" max={today} value={authForm.birthDate} onChange={e=>setAuthForm({...authForm,birthDate:e.target.value})}/></Field>
            <Field label="Telefone (opcional)"><input type="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={authForm.phone} onChange={e=>setAuthForm({...authForm,phone:e.target.value})}/></Field>
          </div>
          <Field label="Tipo sanguíneo (opcional)"><select value={authForm.bloodType} onChange={e=>setAuthForm({...authForm,bloodType:e.target.value})}><option value="">Não sei / prefiro não informar</option>{bloodTypes.map(t=><option key={t} value={t}>{t}</option>)}</select></Field>
          <p className="form-note"><ShieldCheck size={15}/> O tipo sanguíneo é autodeclarado no cadastro e não será exibido como validado até confirmação por instituição parceira.</p>
          <div className="form-row">
            <Field label="Cidade"><input autoComplete="address-level2" placeholder="Sua cidade" value={authForm.city} onChange={e=>setAuthForm({...authForm,city:e.target.value})}/></Field>
            <Field label="Região de atendimento"><select value={authForm.region} onChange={e=>setAuthForm({...authForm,region:e.target.value})}><option value="">Selecione</option>{["Centro","Zona Leste","Zona Norte","Zona Sul","Zona Oeste","Nacional","Outra região"].map(r=><option key={r}>{r}</option>)}</select></Field>
          </div>
          <label className="libras-consent"><input type="checkbox" checked={authForm.accessibilityLibras} onChange={e=>setAuthForm({...authForm,accessibilityLibras:e.target.checked})}/><span><b>Quero receber recursos de acessibilidade</b><small>Você pode personalizar contraste, fonte e animações pelo botão de acessibilidade.</small></span></label>
        </>}
        <Field label="E-mail"><input required type="email" autoComplete="email" placeholder="voce@exemplo.com" value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})}/></Field>
        <Field label="Senha"><input required type="password" minLength={authMode==="login"?1:10} autoComplete={authMode==="login"?"current-password":"new-password"} placeholder={authMode==="login"?"Sua senha":"Mínimo de 10 caracteres"} value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})}/></Field>
        <button className="btn btn-primary btn-full" disabled={busy}>{busy?"Aguarde…":authMode==="login"?"Entrar na minha conta":"Criar minha conta"} <ArrowRight size={16}/></button>
        <p className="switch-auth">{authMode==="login"?"Ainda não tem uma conta?":"Já tem uma conta?"} <button type="button" onClick={()=>setAuthMode(authMode==="login"?"register":"login")}>{authMode==="login"?"Cadastre-se":"Entrar"}</button></p>
      </form>
    </Modal>}
    {modal==="appointment" && <Modal title="Agendar doação" subtitle="Escolha a unidade e o horário desejado." onClose={()=>setModal("")}>
      {!user ? <div className="empty-state"><LockKeyhole/><p>Entre na sua conta para criar um agendamento.</p><button className="btn btn-primary" onClick={()=>{setModal("auth");setAuthMode("login")}}>Entrar</button></div> : <form className="form-stack" onSubmit={book}>
        {centers.length===0&&<div className="notice-box"><b>Nenhuma unidade verificada disponível</b><p>O administrador precisa cadastrar uma unidade com fonte oficial antes de receber solicitações.</p></div>}<Field label="Hemocentro"><select required value={apptForm.hemocenterId} onChange={e=>setApptForm({...apptForm,hemocenterId:e.target.value})}><option value="">Selecione uma unidade</option>{centers.map(c=><option value={c.id} key={c.id}>{c.name} — {c.region}</option>)}</select></Field>
        <div className="form-row"><Field label="Data"><input type="date" required min={today} value={apptForm.date} onChange={e=>setApptForm({...apptForm,date:e.target.value})}/></Field><Field label="Horário"><select value={apptForm.time} onChange={e=>setApptForm({...apptForm,time:e.target.value})}>{["08:00","08:30","09:00","09:30","10:00","10:30","11:00","13:00","13:30","14:00","14:30","15:00"].map(t=><option key={t}>{t}</option>)}</select></Field></div>
        <p className="form-note"><CircleHelp size={15}/> Sua solicitação será enviada à fila interna da unidade. O horário só estará confirmado após aprovação da instituição; isso não substitui a triagem de saúde.</p>
        <button className="btn btn-primary btn-full" disabled={busy||centers.length===0}>{busy?"Enviando…":"Enviar solicitação"} <ArrowRight size={16}/></button>
      </form>}
    </Modal>}
    {modal==="profile" && <Modal title="Sua conta" subtitle="Informações de acesso e atalhos." onClose={()=>setModal("")}>
      <div className="profile-modal"><div className="avatar avatar-large">{user?.name?.charAt(0).toUpperCase()}</div><h3>{user?.name}</h3><p>{user?.email}</p><span className="role-tag">{user?.role==="donor"?"Doador":user?.role==="admin"?"Administrador":"Hemocentro"}</span></div>
      <button className="settings-link" onClick={()=>{setModal("");go("configuracoes")}}><Settings size={17}/> Preferências e notificações <ChevronRight size={16}/></button>
      <button className="settings-link logout-link" onClick={()=>{setModal("");logout()}}><LogOut size={17}/> Sair da conta <ChevronRight size={16}/></button>
    </Modal>}
    {modal==="about" && <Modal title="Tecnologia que transforma solidariedade" subtitle="Conheça a proposta VIVA+." onClose={()=>{setModal("");setAuthForm(f=>({...f,email:"",password:""}));}}><p className="about-copy">O VIVA+ propõe uma infraestrutura digital para mobilizar, reconhecer e medir a participação cidadã em torno da doação de sangue. Reúne carteira digital, histórico validado por hemocentros, campanhas, agendamento e dados agregados para planejamento.</p><div className="about-points"><span><ShieldCheck/> Segurança e privacidade</span><span><Heart/> Selos que desbloqueiam propostas de benefício</span><span><Users/> Parceria com instituições de saúde</span></div><div className="notice-box">O VIVA+ é uma plataforma acadêmica independente. As unidades exibidas precisam ter fonte oficial cadastrada; campanhas, solicitações e indicadores são registros internos. Os benefícios ligados aos selos são propostas: não há integração automática com sistemas clínicos, Gov.br, transporte ou benefícios públicos.</div></Modal>}
  </div>;
}

function Field({label,children}) { return <label className="field"><span>{label}</span>{children}</label>; }
function Modal({title,subtitle,onClose,children}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = React.useId();
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector("button, input, select, textarea, [href], [tabindex]:not([tabindex='-1'])");
    first?.focus();
    const keyHandler = (event) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); }
      if (event.key === "Tab" && dialog) {
        const focusables = [...dialog.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex='-1'])")].filter(el => !el.hasAttribute("hidden"));
        if (!focusables.length) return;
        const firstEl = focusables[0], lastEl = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === firstEl) { event.preventDefault(); lastEl.focus(); }
        else if (!event.shiftKey && document.activeElement === lastEl) { event.preventDefault(); firstEl.focus(); }
      }
    };
    document.addEventListener("keydown", keyHandler);
    return () => { document.removeEventListener("keydown", keyHandler); previous?.focus?.(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal-card" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}><button className="modal-close icon-button" onClick={onClose} aria-label="Fechar janela"><X size={19}/></button><div className="modal-head"><span className="modal-mark"><Droplet fill="currentColor"/></span><h2 id={titleId}>{title}</h2><p>{subtitle}</p></div>{children}</section></div>;
}

function HomePage({user,dashboard,count,nextLevel,progress,campaigns,centers,onNavigate,onAuth,onBook,onAccessibility}) {
  
  return <div className="page-stack">
    <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> SUA SOLIDARIEDADE FAZ A DIFERENÇA</div><h1>{user?<>Olá, {user.name.split(" ")[0]} <span className="wave">✦</span></> : <>Cada gesto conta.<br/><span className="heading-muted">Cada vida importa.</span></>}</h1><p className="welcome-copy">{user?"Sua jornada de solidariedade está aqui. Acompanhe seu histórico e encontre novas formas de ajudar.":"Uma plataforma para conectar doadores, hemocentros e campanhas que salvam vidas."}</p><div className="hero-actions"><button className="btn btn-primary" onClick={onBook}><CalendarDays size={17}/> Agendar doação <ArrowRight size={16}/></button><button className="btn btn-secondary" onClick={()=>onNavigate("carteira")}>Minha carteira <ChevronRight size={16}/></button><button className="btn btn-secondary" onClick={()=>onNavigate("impacto")}><BarChart3 size={16}/> Ver impacto</button></div></div><div className="hero-art"><div className="hero-circle circle-one"/><div className="hero-circle circle-two"/><div className="hero-heart"><HeartPulse size={76} strokeWidth={1.3}/></div><div className="float-card float-top"><span className="float-icon"><Heart size={15} fill="currentColor"/></span><span><b>Um ato de amor</b><small>que faz a diferença</small></span></div><div className="float-card float-bottom"><span className="float-check"><Check size={16}/></span><span><b>Solidariedade em ação</b><small>Uma jornada, muitas vidas</small></span></div><div className="art-dot dot-one"/><div className="art-dot dot-two"/></div></section>
    <section className="pitch" aria-labelledby="pitch-title">
      <div className="pitch-head"><span className="section-kicker">PROBLEMA · SOLUÇÃO · PRÓXIMOS PASSOS</span><h2 id="pitch-title">Doar sangue depende de gente que volta. O VIVA+ cuida disso.</h2><p>Uma carteira digital que reconhece, lembra e retém o doador, e que dá aos hemocentros uma forma simples de validar doações e mobilizar campanhas.</p></div>
      <div className="pitch-flow">
        <article className="panel pitch-card"><span className="pitch-tag">O PROBLEMA</span><h3>Pouca gente doa, e poucos voltam</h3><p>Hoje não há um reconhecimento contínuo nem um lembrete simples para quem já doou.</p><div className="pitch-nums"><div><b>1,6%</b><span>da população doou no SUS em 2023</span></div><div><b>3,2 mi</b><span>de bolsas coletadas no ano</span></div><div><b>até 4</b><span>pessoas ajudadas por doação*</span></div></div><small className="pitch-note">Fonte: Ministério da Saúde (2023). *Estimativa informativa.</small></article>
        <article className="panel pitch-card"><span className="pitch-tag">A SOLUÇÃO</span><h3>Carteira, selos e campanhas</h3><p>O doador tem carteira com QR temporário. Cada doação validada pelo hemocentro sobe o selo (Bronze a Diamante), e cada selo desbloqueia propostas de benefício. Campanhas direcionadas por região e tipo sanguíneo trazem o doador de volta.</p></article>
        <article className="panel pitch-card"><span className="pitch-tag">O QUE JÁ FUNCIONA</span><h3>Protótipo acadêmico completo</h3><p>Cadastro e login seguros, carteira com QR de uso único, painel do hemocentro, agendamento por solicitação, página de impacto com dados agregados e recursos de acessibilidade.</p><button className="text-link" onClick={()=>onNavigate("impacto")}>Ver o impacto <ArrowRight size={14}/></button></article>
      </div>
      <div className="pitch-road">
        <div className="panel road-step"><small>FASE 1 · HOJE</small><b>Protótipo validado</b><ul><li>Carteira, selos, campanhas e agendamento interno</li><li>Painel institucional e métricas anônimas</li></ul></div>
        <div className="panel road-step later"><small>FASE 2 · PILOTO</small><b>Um hemocentro parceiro</b><ul><li>Revisão jurídica e de privacidade (LGPD)</li><li>Medir retorno de doadores com e sem VIVA+</li></ul></div>
        <div className="panel road-step later"><small>FASE 3 · ESCALA</small><b>Integrações e parcerias</b><ul><li>Agendamento nos sistemas dos hemocentros</li><li>Parceiros de benefícios; Gov.br e transporte dependem de acordo e lei</li></ul></div>
      </div>
      <small className="pitch-note">Modelo de sustentação em avaliação: convênios com hemocentros e secretarias de saúde e parcerias para os benefícios. As fases 2 e 3 são planos, não funcionalidades prontas.</small>
    </section>
    <section className="inclusive-hub" aria-labelledby="inclusive-title">
      <div className="inclusive-copy">
        <span className="inclusive-kicker"><Accessibility size={15}/> VIVA+ PARA TODAS AS PESSOAS</span>
        <h2 id="inclusive-title">Acessibilidade que aproxima.</h2>
        <p>Personalize o tamanho da fonte, contraste e outras opções de leitura.</p>
        <div className="inclusive-actions">
          
          <button className="btn btn-secondary" onClick={onAccessibility}><Accessibility size={16}/> Personalizar acessibilidade</button>
        </div>
        <small className="inclusive-note">Use o botão de acessibilidade ou o atalho Alt + Shift + A para ajustar a experiência.</small>
      </div>
      <div className="inclusive-tools" aria-label="Atalhos do VIVA+">
        <button className="inclusive-tool" onClick={()=>onNavigate("campanhas")}><span className="inclusive-tool-icon"><HeartPulse size={20}/></span><b>Explorar campanhas</b><small>Veja ações de mobilização</small><ArrowRight size={15}/></button>
        <button className="inclusive-tool" onClick={()=>onNavigate("requisitos")}><span className="inclusive-tool-icon"><ClipboardCheck size={20}/></span><b>Requisitos para doar</b><small>Veja se você pode doar</small><ArrowRight size={15}/></button>
        <button className="inclusive-tool" onClick={()=>onNavigate("hemocentros")}><span className="inclusive-tool-icon"><MapPin size={20}/></span><b>Encontrar unidades</b><small>Consulte hemocentros</small><ArrowRight size={15}/></button>
        <button className="inclusive-tool" onClick={()=>onNavigate("carteira")}><span className="inclusive-tool-icon"><QrCode size={20}/></span><b>Abrir minha carteira</b><small>Consulte sua identidade digital</small><ArrowRight size={15}/></button>
      </div>
    </section>
    <BloodStockPanel/>
    <section className="stats-grid">
      <StatCard icon={Droplet} label="Doações validadas" value={user?count:"—"} detail={user?"No seu histórico":"Entre para acompanhar"} color="green"/>
      <StatCard icon={Award} label="Seu nível" value={user?dashboard.level:"—"} detail={user?"Reconhecimento cidadão":"Conquiste selos ao doar"} color="gold"/>
      <StatCard icon={CalendarDays} label="Agendamentos" value={user?dashboard.appointments.filter(a=>a.status==="confirmed").length:"—"} detail="Horários confirmados" color="blue"/>
      <StatCard icon={HeartPulse} label="Impacto potencial" value={user?`${count*4}`:"—"} detail="Vidas que podem ser ajudadas*" color="rose"/>
    </section>
    <section className="content-grid">
      <div className="panel progress-panel"><div className="panel-head"><div><span className="section-kicker">SUA JORNADA</span><h2>Seu próximo marco</h2></div><span className="icon-soft"><Award size={19}/></span></div>
        {user ? <><div className="level-track"><div className="level-emblem" style={{"--level-color":nextLevel?.color || "#5b9fa6"}}><Award size={28}/></div><div className="level-main"><div className="level-labels"><b>{dashboard.level}</b><span>{nextLevel?`${count} de ${nextLevel.count} doações`:"Nível máximo alcançado"}</span></div><div className="progress-bar"><div style={{width:`${progress}%`}}/></div><small>{nextLevel?`Mais ${nextLevel.count-count} ${nextLevel.count-count===1?"doação":"doações"} validada(s) para o próximo selo`:"Parabéns pela sua jornada!"}</small></div></div><div className="milestone-row">{levels.map((l,i)=><div className={`milestone ${count>=l.count?"earned":""}`} key={l.name}><span style={{"--level-color":l.color}}><Award size={17}/></span><small>{l.name}</small></div>)}</div></> : <div className="empty-inline"><div className="empty-illustration"><Award size={30}/></div><div><b>Construa sua jornada de doação</b><p>Crie sua conta para acompanhar doações validadas e desbloquear selos.</p><button className="text-link" onClick={onAuth}>Criar conta gratuita <ArrowRight size={14}/></button></div></div>}
      </div>
      <div className="panel campaign-panel"><div className="panel-head"><div><span className="section-kicker">MOBILIZAÇÃO</span><h2>Campanhas em destaque</h2></div><button className="text-link" onClick={()=>onNavigate("campanhas")}>Ver todas <ArrowRight size={14}/></button></div>
        {campaigns.length?campaigns.slice(0,2).map((c,i)=><CampaignMini key={c.id} campaign={c} index={i}/>):<div className="campaign-feature"><div className="campaign-symbol"><HeartPulse size={24}/></div><div><span className="campaign-status"><i/> {user?"SEM CAMPANHAS ATIVAS":"CONHEÇA O PROJETO"}</span><h3>{user?"Novas campanhas em breve":"Sua presença pode mudar tudo"}</h3><p>{user?"As campanhas disponíveis para sua região aparecerão aqui.":"Acompanhe campanhas e encontre uma unidade de coleta para planejar sua doação."}</p><button className="text-link" onClick={()=>onNavigate("hemocentros")}>Explorar unidades <ArrowRight size={14}/></button></div></div>}
      </div>
    </section>
    <section className="lower-grid"><div className="panel centers-panel"><div className="panel-head"><div><span className="section-kicker">PERTO DE VOCÊ</span><h2>Encontre um hemocentro</h2></div><span className="icon-soft"><MapPin size={18}/></span></div><div className="center-list">{centers.slice(0,3).map(c=><div className="center-row" key={c.id}><span className="center-pin"><MapPin size={17}/></span><div className="center-info"><b>{c.name}</b><small>{c.region} · {c.city}/{c.state}</small></div><ChevronRight size={16}/></div>)}</div><button className="btn btn-secondary btn-full" onClick={()=>onNavigate("hemocentros")}>Ver todas as unidades <ArrowRight size={15}/></button></div>
      <div className="panel impact-panel"><div className="impact-glow"/><div className="impact-content"><span className="impact-label"><Sparkles size={14}/> NOSSO PROPÓSITO</span><h2>Pequenos gestos.<br/>Grandes transformações.</h2><p>Uma doação de sangue pode ajudar até quatro pessoas. O VIVA+ existe para tornar a solidariedade mais simples, conectada e recorrente.</p><div className="impact-stat"><span><Heart size={17} fill="currentColor"/></span><b>Até 4 vidas</b><small>podem ser ajudadas por doação*</small></div><small className="disclaimer">*Estimativa informativa citada no documento conceitual, não resultado do VIVA+.</small></div><div className="impact-art"><HeartPulse size={100} strokeWidth={1}/></div></div>
    </section>
  </div>;
}
function StatCard({icon:Icon,label,value,detail,color}) { return <div className="stat-card"><span className={`stat-icon ${color}`}><Icon size={20}/></span><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>; }
function CampaignMini({campaign,index}) { return <div className={`campaign-mini mini-${index}`}><span className="mini-icon"><Droplet size={19}/></span><div className="mini-copy"><span className="campaign-status"><i/> CAMPANHA ATIVA</span><h3>{campaign.title}</h3><p>{campaign.region} {campaign.bloodType?`· Tipo ${campaign.bloodType}`:""} </p></div><span className="mini-date">{fmtDate(campaign.endDate)}</span></div>; }

function PageHeading({eyebrow,title,description,action}) { return <div className="page-heading"><div><span className="section-kicker">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>; }
function WalletPage({user,dashboard,count,onAuth}) {
  if(!user) return <><PageHeading eyebrow="SUA IDENTIDADE DIGITAL" title="Minha carteira" description="Sua jornada de solidariedade, em um só lugar."/><LockedPanel onAuth={onAuth}/></>;
  const nextLevel = levels.find(level => count < level.count);
  const progress = nextLevel ? Math.min(100, (count / nextLevel.count) * 100) : 100;
  return <div className="page-stack">
    <PageHeading eyebrow="SUA IDENTIDADE DIGITAL" title="Minha carteira" description="Sua identidade digital reúne os dados essenciais da sua jornada de doação." />
    <div className="wallet-layout">
      <div className="wallet-card">
        <div className="wallet-card-bg"><div className="wallet-orb orb-a"/><div className="wallet-orb orb-b"/></div>
        <div className="wallet-top"><div className="wallet-brand"><Droplet fill="currentColor"/> VIVA<span>+</span></div><span className="wallet-status"><i/> CARTEIRA DIGITAL</span></div>
        <div className="wallet-title">CARTEIRA NACIONAL DO DOADOR</div>
        <div className="wallet-person"><div className="wallet-avatar">{user.name.charAt(0).toUpperCase()}</div><div><h2>{user.name}</h2><p>Membro VIVA+ · Desde {user.createdAt ? new Date(user.createdAt.replace(" ","T")+"Z").getFullYear() : "—"}</p></div></div>
        <div className="wallet-data">
          <div><small>TIPO SANGUÍNEO</small><strong>{user.bloodTypeVerified?user.bloodType:"—"}</strong><em>{user.bloodTypeVerified?"Validado por instituição":"Aguardando validação"}</em></div>
          <div><small>DOAÇÕES VALIDADAS</small><strong>{count.toString().padStart(2,"0")}</strong><em>Registros institucionais</em></div>
          <div><small>NÍVEL ATUAL</small><strong className="wallet-level">{dashboard.level}</strong><em>Selo cidadão solidário</em></div>
        </div>
        <div className="wallet-bottom"><div><small>ÚLTIMA DOAÇÃO</small><b>{fmtDate(user.lastDonationDate)}</b></div><div className="wallet-qr"><DynamicWalletQR userId={user.id}/><small>VIVA+ ID {String(user.id).padStart(6,"0")}</small></div></div>
        <div className="wallet-watermark">VIVA+</div>
      </div>
      <div className="wallet-side">
        <div className="panel wallet-info"><span className="icon-soft"><ShieldCheck/></span><h3>Seu progresso de reconhecimento</h3>
          <p>Os selos evoluem somente com doações registradas e validadas por uma instituição parceira.</p>
          <div className="wallet-progress-head"><b>{nextLevel ? `Próximo nível: ${nextLevel.name}` : "Todos os níveis conquistados"}</b><span>{nextLevel ? `${count} de ${nextLevel.count}` : "10+ doações"}</span></div>
          <div className="progress-bar"><div style={{width:`${progress}%`}}/></div>
          <div className="info-divider"/>
          <div className="info-line"><Check/> Histórico de doações validadas</div><div className="info-line"><Award/> {benefits.filter(b=>isUnlocked(b,count)).length} de {benefits.length} propostas de benefício valem para o seu selo</div><div className="info-line"><Check/> Reconhecimento calculado automaticamente</div><div className="info-line"><LockKeyhole/> Dados exibidos conforme seu perfil de acesso</div>
        </div>
        <div className="panel wallet-info wallet-eligibility"><span className="icon-soft"><CalendarDays/></span><h3>Próxima data para consultar</h3><p>{user.lastDonationDate ? `Sua última doação registrada foi em ${fmtDate(user.lastDonationDate)}.` : "Ainda não há uma doação registrada na sua carteira."}</p><div className="eligibility-callout">Consulte o hemocentro para confirmar quando poderá doar novamente. O VIVA+ não determina aptidão clínica nem substitui a avaliação presencial.</div></div>
        <div className="notice-box"><b>Sobre o QR Code</b><p>Apresente o código temporário à equipe autorizada do hemocentro para verificação da identidade VIVA+. Ele é atualizado automaticamente e não substitui documento oficial nem sistemas clínicos externos.</p></div>
      </div>
    </div>
    <div className="panel table-panel"><div className="panel-head"><div><span className="section-kicker">SEU REGISTRO</span><h2>Histórico de doações</h2></div><span className="table-count">{dashboard.donations.length} registro(s)</span></div>{dashboard.donations.length?<div className="table-wrap"><table><thead><tr><th>Data</th><th>Instituição</th><th>Status</th></tr></thead><tbody>{dashboard.donations.map(d=><tr key={d.id}><td>{fmtDate(d.date)}</td><td>{d.hemocenter||"Instituição parceira"}</td><td><span className={`status-pill ${d.status}`}>{d.status==="validated"?"Validada":d.status==="pending"?"Pendente":"Recusada"}</span></td></tr>)}</tbody></table></div>:<div className="empty-table"><Droplet size={26}/><b>Seu histórico está começando</b><p>As doações aparecem aqui depois de validadas por um hemocentro parceiro.</p></div>}</div>
  </div>;
}
function DynamicWalletQR({userId}) {
  const [qr, setQr] = useState(null);
  const [seconds, setSeconds] = useState(15);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let refreshTimer;
    const refresh = async () => {
      try {
        const data = await api("/me/wallet-qr");
        if (!active) return;
        setQr(data.image); setSeconds(15); setError("");
        refreshTimer = window.setTimeout(refresh, 15000);
      } catch (e) { if (active) { setError("QR temporariamente indisponível"); refreshTimer = window.setTimeout(refresh, 5000); } }
    };
    refresh();
    const ticker = window.setInterval(() => setSeconds(v => v <= 1 ? 15 : v - 1), 1000);
    return () => { active = false; window.clearTimeout(refreshTimer); window.clearInterval(ticker); };
  }, [userId]);
  return <div className="dynamic-qr-wrap" aria-live="polite">{qr ? <img src={qr} alt="QR Code temporário da carteira VIVA+, atualizado a cada 20 segundos" width="180" height="180"/> : <QrCode size={43} aria-hidden="true"/>}<small>{error || `Atualiza em ${seconds}s`}</small></div>;
}

function LockedPanel({onAuth}) { return <div className="panel locked-panel"><span className="locked-icon"><LockKeyhole size={28}/></span><h2>Entre para acessar sua carteira</h2><p>Crie uma conta gratuita para acompanhar seu histórico, seus selos e seus agendamentos.</p><button className="btn btn-primary" onClick={onAuth}>Entrar ou criar conta <ArrowRight size={16}/></button></div>; }

function CampaignPage({user,campaigns,onAuth,onBook}) {
  const [region,setRegion] = useState("Todas");
  const [bloodType,setBloodType] = useState("Todos");
  const todayKey = today;
  const visibleCampaigns = campaigns.filter(c => {
    const active = (!c.startDate || c.startDate <= todayKey) && (!c.endDate || c.endDate >= todayKey);
    return active && (region === "Todas" || c.region === region) && (bloodType === "Todos" || !c.bloodType || c.bloodType === bloodType);
  });
  const regions = [...new Set(campaigns.map(c=>c.region).filter(Boolean))];
  return <div className="page-stack">
    <PageHeading eyebrow="MOBILIZAÇÃO INTELIGENTE" title="Campanhas" description="Acompanhe ações de mobilização e descubra como participar." action={!user&&<button className="btn btn-primary" onClick={onAuth}>Entrar <ArrowRight size={15}/></button>}/>
    <div className="campaign-hero"><div><span className="impact-label"><HeartPulse size={14}/> SOLIDARIEDADE EM MOVIMENTO</span><h2>Uma corrente que<br/>não pode parar.</h2><p>Campanhas podem ser direcionadas por região, tipo sanguíneo e período, conforme a necessidade informada pelo hemocentro.</p></div><div className="campaign-hero-icon"><HeartPulse size={80}/><span><Droplet fill="currentColor"/></span></div></div>
    <div className="campaign-filter-panel panel"><div><span className="section-kicker">ENCONTRE UMA AÇÃO</span><h3>Filtrar campanhas</h3><p>As campanhas exibidas respeitam o período cadastrado pela instituição.</p></div><div className="campaign-filters"><label>Região<select value={region} onChange={e=>setRegion(e.target.value)}><option>Todas</option>{regions.map(r=><option key={r}>{r}</option>)}</select></label><label>Tipo sanguíneo<select value={bloodType} onChange={e=>setBloodType(e.target.value)}><option>Todos</option>{bloodTypes.map(t=><option key={t}>{t}</option>)}</select></label></div></div>
    {visibleCampaigns.length?<div className="campaign-grid">{visibleCampaigns.map((c,i)=>{const starts = c.startDate && c.startDate > todayKey; const status = starts ? "Programada" : "Ativa"; return <article className="campaign-card" key={c.id}><div className={`campaign-card-top cc-${i%3}`}><span><HeartPulse size={23}/></span><small><i/> {status.toUpperCase()}</small></div><div className="campaign-card-body"><span className="section-kicker">{c.region}{c.bloodType?` · Tipo ${c.bloodType}`:" · Todos os tipos"}</span><h3>{c.title}</h3><p>{c.description}</p><div className="campaign-meta"><span><CalendarDays size={15}/> {starts?`Início: ${fmtDate(c.startDate)}`:`Até ${fmtDate(c.endDate)}`}</span><span><MapPin size={15}/> {c.hemocenter||"Campanha da rede VIVA+"}</span></div><button className="btn btn-secondary btn-full" onClick={onBook}>Quero participar <ArrowRight size={15}/></button></div></article>})}</div>:<div className="panel empty-campaigns"><span><HeartPulse size={27}/></span><h2>{campaigns.length?"Nenhuma campanha corresponde aos filtros":"Nenhuma campanha disponível no momento"}</h2><p>{campaigns.length?"Altere a região ou o tipo sanguíneo para consultar outras campanhas ativas.":user?"Quando uma instituição cadastrar campanhas para o período atual, elas aparecerão aqui.":"Crie sua conta para acompanhar campanhas e agendar uma visita a um ponto de coleta."}</p>{campaigns.length>0&&<button className="btn btn-secondary" onClick={()=>{setRegion("Todas");setBloodType("Todos")}}>Limpar filtros</button>}{!user&&<button className="btn btn-primary" onClick={onAuth}>Criar conta gratuita</button>}</div>}
    <div className="notice-box"><b>Mobilização responsável</b><p>As campanhas são cadastradas por instituições e podem ser segmentadas por região e tipo sanguíneo. A existência de uma campanha não significa que qualquer pessoa esteja apta a doar: a avaliação é sempre presencial pela equipe de saúde.</p></div>
  </div>;
}
function CentersPage({centers,search,setSearch,notify}) { return <div className="page-stack"><PageHeading eyebrow="REDE DE COLETA" title="Encontre um hemocentro" description="Consulte unidades verificadas e confirme os detalhes diretamente com o serviço de hemoterapia."/><div className="searchbar"><MapPin size={19}/><input aria-label="Buscar hemocentros por unidade, região ou endereço" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por unidade, região ou endereço…"/>{search&&<button onClick={()=>setSearch("")}><X size={16}/></button>}</div><div className="center-grid">{centers.map((c,i)=><article className="panel center-card" key={c.id}><div className={`center-card-art art-${i%3}`}><div className="center-art-icon"><Building2 size={31}/></div><span className="demo-tag">FONTE CADASTRADA</span><div className="art-line"/></div><div className="center-card-body"><span className="section-kicker">{c.region} · {c.city}/{c.state}</span><h3>{c.name}</h3><p><MapPin size={15}/>{c.address}</p><p><Clock3 size={15}/>{c.opening_hours || "Consulte a instituição"}</p><div className="center-card-footer"><span><i/> Fonte oficial informada</span><div className="row-actions">{c.sourceUrl&&<a href={c.sourceUrl} target="_blank" rel="noreferrer">Ver fonte</a>}{c.bookingUrl&&<a href={c.bookingUrl} target="_blank" rel="noreferrer">Agendar na instituição</a>}<button className="icon-button" title="Copiar endereço" onClick={async()=>{try {await navigator.clipboard.writeText(c.address);notify("Endereço copiado.")}catch{notify("Não foi possível copiar o endereço.")}}}><Copy size={17}/></button></div></div></div></article>)}</div>{centers.length===0&&<div className="panel empty-campaigns"><h3>Nenhuma unidade verificada encontrada</h3><p>O diretório do VIVA+ ainda não tem unidades cadastradas. Enquanto isso, consulte diretamente o diretório oficial da Fundação Pró-Sangue para unidades em São Paulo.</p><p><a href="https://prosangue.sp.gov.br/hemocentros/Default.html" target="_blank" rel="noreferrer">Consultar hemocentros oficiais da Pró-Sangue</a> · <a href="https://prosangue.sp.gov.br/doacao/agende.html?Idioma=pt-BR" target="_blank" rel="noreferrer">Agendar diretamente na Pró-Sangue</a></p></div>}<div className="notice-box"><b>Antes de se deslocar</b><p>O VIVA+ exibe somente unidades cadastradas com uma fonte oficial informada. Confira a fonte, horários e condições diretamente com a instituição antes de se deslocar.</p></div></div>; }

function AppointmentsPage({user,appointments,onBook,onCancel,onAuth}) { return <div className="page-stack"><PageHeading eyebrow="ORGANIZE SUA VISITA" title="Agendamentos" description="Gerencie seus horários de doação registrados no VIVA+." action={<button className="btn btn-primary" onClick={onBook}><CalendarDays size={16}/> Novo agendamento</button>}/>{!user?<LockedPanel onAuth={onAuth}/>:appointments.length?<div className="appointment-list">{appointments.map(a=><div className="panel appointment-card" key={a.id}><div className="appointment-date"><span>{new Date(`${a.date}T12:00:00`).toLocaleDateString("pt-BR",{month:"short"}).replace(".","").toUpperCase()}</span><b>{new Date(`${a.date}T12:00:00`).getDate()}</b><small>{new Date(`${a.date}T12:00:00`).getFullYear()}</small></div><div className="appointment-details"><span className={`status-pill ${a.status}`}>{a.status==="pending"?"Aguardando unidade":a.status==="confirmed"?"Confirmado":a.status==="cancelled"?"Cancelado":"Concluído"}</span><h3>{a.hemocenter}</h3><p><MapPin size={15}/>{a.region} · {a.address}</p><p><Clock3 size={15}/>{a.time}</p></div>{["pending","confirmed"].includes(a.status)&&<button className="btn btn-quiet-danger" onClick={()=>onCancel(a.id)}>Cancelar</button>}</div>)}</div>:<div className="panel empty-campaigns"><span><CalendarDays size={27}/></span><h2>Você ainda não tem agendamentos</h2><p>Escolha uma unidade verificada para enviar uma solicitação de horário. A unidade precisa confirmar o pedido.</p><button className="btn btn-primary" onClick={onBook}>Agendar agora <ArrowRight size={15}/></button></div>}<div className="notice-box"><b>Solicitação sujeita à confirmação da unidade</b><p>O pedido fica registrado no VIVA+ e aguarda confirmação da unidade. Ele não reserva automaticamente uma vaga no sistema externo do hemocentro. A triagem presencial determina se a doação pode ser realizada.</p></div></div>; }

function BadgesPage({count,onNavigate}) { return <div className="page-stack"><PageHeading eyebrow="RECONHECIMENTO CIDADÃO" title="Meus selos" description="Cada selo desbloqueia propostas de benefício. O selo cresce com o histórico de doações validado por instituições."/><div className="badge-intro"><div className="badge-intro-symbol"><Award size={46}/></div><div><span className="section-kicker">SELO CIDADÃO SOLIDÁRIO</span><h2>Solidariedade que deixa marcas.</h2><p>O selo é um reconhecimento e não é pagamento: a doação continua voluntária. Os benefícios abaixo são propostas do projeto, que dependem de lei e de parceiros, e só valem para quem alcança o selo exigido.</p></div></div><div className="badge-grid">{levels.map(l=>{const list=benefitsFor(l.name);const earned=count>=l.count;return <div className={`panel badge-card ${earned?"badge-earned":""}`} key={l.name}><div className="badge-medal" style={{"--level-color":l.color}}><Award size={36}/>{earned&&<span><Check size={13}/></span>}</div><span className={`badge-state ${earned?"state-earned":""}`}>{earned?"CONQUISTADO":"PRÓXIMO MARCO"}</span><h3>{l.name}</h3><b>{l.count} {l.count===1?"doação validada":"doações validadas"}</b><p>{l.text}</p><ul className="badge-benefits">{list.map(b=><li key={b.id} className={earned?"on":""}>{earned?<Check size={11}/>:<Lock size={11}/>}<span>{b.title}</span></li>)}</ul><div className="badge-progress"><span style={{width:`${Math.min(100,count/l.count*100)}%`,background:l.color}}/></div><small>{Math.min(count,l.count)} de {l.count}</small></div>})}</div><button className="btn btn-secondary" onClick={()=>onNavigate("propostas")}><HandHeart size={16}/> Ver todas as propostas de benefício <ArrowRight size={15}/></button><div className="notice-box"><b>Como os selos funcionam</b><p>O nível é calculado automaticamente a partir das doações registradas e validadas por hemocentros parceiros. Autodeclarações não contam para a progressão. Os benefícios são cumulativos: quem é Diamante também alcança os de Bronze, Prata e Ouro.</p></div></div>; }

function ProposalsPage({user,count,dashboard,onAuth,onNavigate}) {
  const current = levelByName[dashboard.level];
  const next = levels.find(l => count < l.count) || null;
  const unlockedCount = user ? benefits.filter(b => isUnlocked(b, count)).length : 0;
  return <div className="page-stack proposals-page">
    <PageHeading eyebrow="RECONHECIMENTO CIDADÃO" title="Propostas e benefícios" description="Quanto mais doações validadas, maior o selo e mais propostas de benefício ele desbloqueia."/>
    <div className="proposal-intro"><span className="proposal-intro-icon"><HandHeart size={25}/></span><div><b>O selo é a chave dos benefícios</b><p>Os benefícios são vinculados ao selo da sua carteira. O transporte com 70% de desconto e o reforço do nível Gov.br só valem para o selo Diamante, com 10 ou mais doações validadas.</p></div><span className="proposal-status">PROPOSTAS CONCEITUAIS</span></div>
    <div className="tier-ladder" role="list" aria-label="Benefícios por selo">{levels.map(l=>{const list=benefitsFor(l.name);const earned=user&&count>=l.count;return <div role="listitem" className={`tier-step ${earned?"earned":""}`} key={l.name} style={{"--level-color":l.color}}><span className="tier-medal"><Award size={20}/></span><b>{l.name}</b><small>{l.count} {l.count===1?"doação":"doações"}</small><em>{list.length} {list.length===1?"proposta":"propostas"}</em></div>})}</div>
    {user ? <div className="proposal-me"><span className="tier-medal" style={{"--level-color":current?.color||"#9aa8a0"}}><Award size={22}/></span><div><b>Seu selo: {dashboard.level} · {count} {count===1?"doação validada":"doações validadas"}</b><p>{next?`Faltam ${next.count-count} ${next.count-count===1?"doação validada":"doações validadas"} para o selo ${next.name}, que desbloqueia ${benefitsFor(next.name).length} ${benefitsFor(next.name).length===1?"proposta":"propostas"}.`:"Você alcançou o selo máximo e todas as propostas valem para você."} {unlockedCount} de {benefits.length} propostas valem para o seu selo.</p></div><button className="text-link" onClick={()=>onNavigate("selos")}>Meus selos <ArrowRight size={14}/></button></div> : <div className="proposal-me"><span className="tier-medal"><Lock size={20}/></span><div><b>Entre para ver o que o seu selo desbloqueia</b><p>Crie sua conta e acompanhe quantas doações faltam para cada benefício.</p></div><button className="text-link" onClick={onAuth}>Criar conta <ArrowRight size={14}/></button></div>}
    <div className="proposal-grid">{benefits.map((item,index)=>{const Icon=iconMap[item.icon]||HandHeart;const tier=levelByName[item.tier];const open=user&&isUnlocked(item,count);const missing=Math.max(0,tier.count-count);return <article className={`panel proposal-card ${open?"proposal-open":"proposal-locked"}`} key={item.id}><div className="proposal-card-top"><span className="proposal-icon"><Icon size={21}/></span><span className="proposal-req" style={{"--level-color":tier.color}}><Award size={12}/> {item.tier} · {tier.count}+ {tier.count===1?"doação":"doações"}</span></div><span className="proposal-category">{item.category}</span><h2>{item.title}</h2><p>{item.description}</p><div className="proposal-detail"><b>Como poderia funcionar</b><span>{item.detail}</span></div><div className="proposal-foot"><span className={`proposal-state ${open?"ok":""}`}>{open?<><Check size={13}/> Vale para o seu selo</>:<><Lock size={13}/> {user?`Faltam ${missing} ${missing===1?"doação validada":"doações validadas"}`:`Exige selo ${item.tier}`}</>}</span><span className="proposal-tag">Em discussão · não é benefício garantido</span></div></article>})}</div>
    <div className="proposal-legal"><ShieldCheck size={19}/><p><b>Transparência:</b> estas são propostas do projeto, não benefícios concedidos hoje. A doação de sangue no Brasil é voluntária e não remunerada (Constituição Federal, art. 199, §4º); o selo é reconhecimento, não pagamento. A implementação depende de lei, orçamento e adesão das instituições. Hoje o VIVA+ não tem integração com o Gov.br nem com operadores de transporte, e a carteira não substitui documentos oficiais.</p></div>
  </div>;
}

function SettingsPage({user,preferences,setPreferences,onSubmit,onAuth}) { if(!user)return <div className="page-stack"><PageHeading eyebrow="CONTROLE DE DADOS" title="Preferências" description="Escolha como deseja receber comunicações do VIVA+."/><LockedPanel onAuth={onAuth}/></div>; return <div className="page-stack"><PageHeading eyebrow="CONTROLE DE DADOS" title="Preferências" description="Você controla quais comunicações deseja receber."/><form className="panel settings-panel" onSubmit={onSubmit}><div className="settings-intro"><span className="icon-soft"><Bell/></span><div><h2>Notificações</h2><p>Suas escolhas podem ser alteradas a qualquer momento.</p></div></div><label className="toggle-row"><span><b>Campanhas para meu perfil</b><small>Receber avisos sobre campanhas de mobilização.</small></span><input type="checkbox" checked={preferences.notificationCampaigns} onChange={e=>setPreferences({...preferences,notificationCampaigns:e.target.checked})}/></label><label className="toggle-row"><span><b>Lembretes de elegibilidade</b><small>Receber lembretes para consultar quando pode doar novamente.</small></span><input type="checkbox" checked={preferences.notificationEligibility} onChange={e=>setPreferences({...preferences,notificationEligibility:e.target.checked})}/></label><button className="btn btn-primary">Salvar preferências <Check size={16}/></button><div className="notice-box"><b>Privacidade em primeiro lugar</b><p>As preferências são armazenadas na conta. O envio de e-mails ou mensagens ainda depende da configuração de um provedor de comunicação.</p></div></form></div>; }

function AdminCenterForm({onCreated}) {
  const [form,setForm] = useState({name:"",region:"",address:"",city:"",state:"SP",phone:"",openingHours:"",sourceUrl:"",bookingUrl:""});
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  async function submit(e) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      await api("/admin/hemocenters",{method:"POST",body:JSON.stringify(form)});
      setMessage("Unidade cadastrada. Revise a fonte oficial.");
      await onCreated?.();
      setForm({name:"",region:"",address:"",city:"",state:"SP",phone:"",openingHours:"",sourceUrl:"",bookingUrl:""});
    } catch(error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <form className="panel institution-form" onSubmit={submit}>
    <div className="panel-head"><div><span className="section-kicker">DIRETÓRIO VERIFICADO</span><h2>Cadastrar unidade real</h2></div><Building2/></div>
    <p className="form-description">Cadastre somente dados conferidos em uma fonte oficial da própria instituição ou do órgão público responsável.</p>
    <Field label="Nome da unidade"><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
    <Field label="Região"><input required value={form.region} onChange={e=>setForm({...form,region:e.target.value})} placeholder="Ex.: Centro"/></Field>
    <Field label="Endereço completo"><input required value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></Field>
    <div className="form-row"><Field label="Cidade"><input required value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></Field><Field label="UF"><input required maxLength="2" value={form.state} onChange={e=>setForm({...form,state:e.target.value.toUpperCase()})}/></Field></div>
    <div className="form-row"><Field label="Telefone"><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></Field><Field label="Horário informado"><input value={form.openingHours} onChange={e=>setForm({...form,openingHours:e.target.value})}/></Field></div>
    <Field label="Fonte oficial (URL HTTPS)"><input type="url" required placeholder="https://..." value={form.sourceUrl} onChange={e=>setForm({...form,sourceUrl:e.target.value})}/></Field>
    <Field label="Link oficial de agendamento (opcional)"><input type="url" placeholder="https://..." value={form.bookingUrl} onChange={e=>setForm({...form,bookingUrl:e.target.value})}/></Field>
    {message&&<p className="form-note" role="status">{message}</p>}
    <button className="btn btn-primary btn-full" disabled={busy}>{busy?"Cadastrando…":"Cadastrar unidade verificada"} <ArrowRight size={15}/></button>
  </form>;
}

function QRVerificationPanel() {
  const [value,setValue] = useState("");
  const [result,setResult] = useState(null);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [confirmed,setConfirmed] = useState(false);
  async function verify(e) {
    e.preventDefault(); setBusy(true); setError(""); setResult(null);
    try {
      let token = value.trim();
      if (token.startsWith("{")) token = JSON.parse(token).token || "";
      if (!token) throw new Error("Cole o conteúdo do QR Code.");
      const data = await api("/wallet-qr/verify",{method:"POST",body:JSON.stringify({token})});
      setResult(data.donor); setConfirmed(false); setValue("");
    } catch(err) { setError(err.message || "Não foi possível verificar o QR."); }
    finally { setBusy(false); }
  }
  return <form className="panel institution-form" onSubmit={verify}>
    <div className="panel-head"><div><span className="section-kicker">IDENTIDADE DIGITAL</span><h2>Verificar QR da carteira</h2></div><QrCode/></div>
    <p className="form-description">Use um leitor de QR conectado ao computador ou cole o conteúdo lido. O código expira em 20 segundos e só pode ser utilizado uma vez.</p>
    <Field label="Conteúdo do QR Code"><textarea required rows="3" value={value} onChange={e=>setValue(e.target.value)} placeholder="Cole aqui o texto lido pelo leitor de QR…"/></Field>
    {error&&<p className="form-note" role="alert">{error}</p>}
    {result&&<div className="notice-box" role="status"><b>Carteira VIVA+ verificada</b><p>Doador: {result.name} · ID #{result.id}. A verificação confirma a autenticidade do token VIVA+, não substitui triagem clínica ou documento oficial.</p></div>}
    <button className="btn btn-primary btn-full" disabled={busy}>{busy?"Verificando…":"Verificar código"}</button>
    {result && !confirmed && <button type="button" className="btn btn-secondary btn-full" onClick={async()=>{if(!window.confirm("Confirma que a doação ocorreu hoje e foi conferida pela instituição?"))return;try{await api("/institution/donations",{method:"POST",body:JSON.stringify({userId:result.id,date:today})});setConfirmed(true);setError("");}catch(e){setError(e.message)}}}>Confirmar doação realizada hoje</button>}
    {confirmed&&<p role="status">Doação registrada. A contagem será atualizada quando o doador recarregar sua carteira.</p>}
  </form>;
}

function InstitutionAppointmentQueue() {
  const [items,setItems] = useState([]);
  const [error,setError] = useState("");
  const [busyId,setBusyId] = useState(null);
  async function refresh() {
    try { setItems(await api("/institution/appointments")); setError(""); }
    catch(err) { setError(err.message); }
  }
  useEffect(()=>{ refresh(); },[]);
  async function confirm(id) {
    setBusyId(id); setError("");
    try { await api(`/institution/appointments/${id}/confirm`,{method:"PATCH"}); await refresh(); }
    catch(err) { setError(err.message); }
    finally { setBusyId(null); }
  }
  async function change(id,action){ setBusyId(id);try{await api(`/institution/appointments/${id}/${action}`,{method:"PATCH"});await refresh()}catch(e){setError(e.message)}finally{setBusyId(null)} }
  return <div className="panel table-panel">
    <div className="panel-head"><div><span className="section-kicker">ATENDIMENTO</span><h2>Solicitações de agendamento</h2></div><button className="btn btn-secondary" type="button" onClick={refresh}>Atualizar</button></div>
    {error&&<p className="form-note" role="alert">{error}</p>}
    {items.length===0?<div className="empty-table"><CalendarDays size={24}/><b>Nenhuma solicitação pendente ou confirmada</b><p>Novas solicitações aparecerão aqui.</p></div>:<div className="table-wrap"><table><thead><tr><th>Doador</th><th>Unidade</th><th>Data</th><th>Horário</th><th>Status</th><th>Ação</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{item.donor}</td><td>{item.hemocenter}</td><td>{fmtDate(item.date)}</td><td>{item.time}</td><td><span className={`status-pill ${item.status}`}>{item.status==="pending"?"Pendente":"Confirmado"}</span></td><td>{item.status==="pending"&&<><button className="btn btn-secondary" type="button" disabled={busyId===item.id} onClick={()=>confirm(item.id)}>Confirmar</button><button className="btn btn-quiet-danger" type="button" disabled={busyId===item.id} onClick={()=>change(item.id,"reject")}>Recusar</button></>}{item.status==="confirmed"&&<button className="btn btn-secondary" type="button" disabled={busyId===item.id} onClick={()=>change(item.id,"complete")}>Concluir</button>}</td></tr>)}</tbody></table></div>}
  </div>;
}

function InstitutionPage({user,summary,donors,centers,campaignForm,setCampaignForm,createCampaign,donationForm,setDonationForm,validateDonation,busy}) {
  if(!user||!["admin","hemocenter"].includes(user.role))return <div className="page-stack"><PageHeading eyebrow="ÁREA RESTRITA" title="Painel institucional" description="Ferramentas internas para perfis institucionais autorizados."/><div className="notice-box"><b>Acesso restrito</b><p>Esta área exige um perfil institucional criado e autorizado pelo responsável técnico. O cadastro público não cria contas institucionais.</p></div></div>;
  return <div className="page-stack"><PageHeading eyebrow="DADOS AGREGADOS" title="Painel institucional" description="Indicadores calculados a partir dos registros desta plataforma. Eles não são dados oficiais consolidados do sistema público de saúde."/><div className="institution-warning"><ShieldCheck size={18}/><span><b>Dados internos do VIVA+</b> · Indicadores calculados a partir do banco local, não representam resultados reais do projeto.</span></div><div className="stats-grid institution-stats"><StatCard icon={Droplet} label="Doações validadas" value={summary?.donations??0} detail="Registros no VIVA+" color="green"/><StatCard icon={Users} label="Doadores únicos" value={summary?.donors??0} detail="Com doação validada" color="blue"/><StatCard icon={CalendarDays} label="Agendamentos ativos" value={summary?.appointments??0} detail="Solicitações e confirmações" color="gold"/><StatCard icon={Activity} label="Campanhas ativas" value={summary?.campaigns??0} detail="Mobilização cadastrada" color="rose"/></div><div className="panel institution-overview"><div className="panel-head"><div><span className="section-kicker">VISÃO OPERACIONAL</span><h2>Resumo da mobilização</h2></div><span className="table-count">Base VIVA+</span></div><div className="overview-metrics"><div><span>Doações validadas</span><b>{summary?.donations??0}</b><div className="overview-track"><i style={{width:`${summary?.donations?100:0}%`}}/></div></div><div><span>Doadores com registro</span><b>{summary?.donors??0}</b><div className="overview-track"><i style={{width:`${summary?.donors?100:0}%`}}/></div></div><div><span>Agendamentos em aberto/confirmados</span><b>{summary?.appointments??0}</b><div className="overview-track"><i style={{width:`${summary?.appointments?100:0}%`}}/></div></div><div><span>Campanhas ativas</span><b>{summary?.campaigns??0}</b><div className="overview-track"><i style={{width:`${summary?.campaigns?100:0}%`}}/></div></div></div><p className="overview-note">Os indicadores representam apenas registros disponíveis no VIVA+. Não são estoque oficial, previsão de demanda nem dados consolidados de hemocentros externos.</p></div><div className="institution-forms"><form className="panel institution-form" onSubmit={createCampaign}><div className="panel-head"><div><span className="section-kicker">MOBILIZAÇÃO</span><h2>Criar campanha</h2></div><HeartPulse/></div><Field label="Título"><input required value={campaignForm.title} onChange={e=>setCampaignForm({...campaignForm,title:e.target.value})} placeholder="Ex.: Junho Vermelho"/></Field><Field label="Descrição"><textarea required rows="3" value={campaignForm.description} onChange={e=>setCampaignForm({...campaignForm,description:e.target.value})} placeholder="Explique a campanha…"/></Field><div className="form-row"><Field label="Tipo sanguíneo (opcional)"><select value={campaignForm.bloodType} onChange={e=>setCampaignForm({...campaignForm,bloodType:e.target.value})}><option value="">Todos os tipos</option>{bloodTypes.map(t=><option key={t}>{t}</option>)}</select></Field><Field label="Região"><select value={campaignForm.region} onChange={e=>setCampaignForm({...campaignForm,region:e.target.value})}>{["Nacional","Centro","Zona Leste","Zona Sul","Zona Norte","Zona Oeste"].map(t=><option key={t}>{t}</option>)}</select></Field></div><div className="form-row"><Field label="Início"><input type="date" required value={campaignForm.startDate} onChange={e=>setCampaignForm({...campaignForm,startDate:e.target.value})}/></Field><Field label="Fim"><input type="date" required min={campaignForm.startDate} value={campaignForm.endDate} onChange={e=>setCampaignForm({...campaignForm,endDate:e.target.value})}/></Field></div><Field label="Hemocentro associado"><select value={campaignForm.hemocenterId} onChange={e=>setCampaignForm({...campaignForm,hemocenterId:e.target.value})}><option value="">Rede VIVA+</option>{centers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><button className="btn btn-primary btn-full" disabled={busy}>Publicar campanha <ArrowRight size={15}/></button></form><form className="panel institution-form" onSubmit={validateDonation}><div className="panel-head"><div><span className="section-kicker">VALIDAÇÃO OFICIAL</span><h2>Registrar doação</h2></div><ShieldCheck/></div><p className="form-description">Registre uma doação somente após conferência no fluxo institucional autorizado.</p><Field label="Doador"><select required value={donationForm.userId} onChange={e=>setDonationForm({...donationForm,userId:e.target.value})}><option value="">Selecione o doador</option>{donors.map(d=><option key={d.id} value={d.id}>#{d.id} · {d.name}</option>)}</select></Field><Field label="Data da doação"><input type="date" required max={today} value={donationForm.date} onChange={e=>setDonationForm({...donationForm,date:e.target.value})}/></Field><div className="notice-box"><b>Controle de acesso</b><p>Somente perfis institucionais autorizados podem validar doações. O VIVA+ registra a validação interna; isso não substitui o prontuário ou sistema oficial da instituição.</p></div><button className="btn btn-primary btn-full" disabled={busy}>Validar doação <Check size={16}/></button></form></div><div className="institution-forms"><QRVerificationPanel/></div><InstitutionAppointmentQueue/>{user.role==="admin"&&<AdminCenterForm onCreated={async()=>{await loadData();}}/>}<div className="panel table-panel"><div className="panel-head"><div><span className="section-kicker">CADASTROS</span><h2>Doadores registrados</h2></div><span className="table-count">{donors.length} doador(es)</span></div><div className="table-wrap"><table><thead><tr><th>ID</th><th>Nome</th><th>Região</th><th>Última doação</th></tr></thead><tbody>{donors.map(d=><tr key={d.id}><td>#{d.id}</td><td>{d.name}</td><td>{d.region||"Não informada"}</td><td>{fmtDate(d.lastDonationDate)}</td></tr>)}</tbody></table></div></div></div>;
}


function BloodStockPanel() {
  const [stock,setStock]=useState(null);
  useEffect(()=>{let live=true;const load=()=>api("/blood-stock").then(d=>{if(live)setStock(d)}).catch(()=>{});load();const t=setInterval(load,60000);return()=>{live=false;clearInterval(t)}},[]);
  return <section className="panel stock-panel" aria-labelledby="stock-title"><div className="panel-head"><div><span className="section-kicker">FUNDAÇÃO PRÓ-SANGUE</span><h2 id="stock-title">Estoque de sangue</h2></div><Droplet/></div>
    <p>Consulte a situação dos oito tipos sanguíneos. Valores indisponíveis não são estimados.</p>
    <div className="stock-grid">{bloodTypes.map(type=><div className="stock-type" key={type}><b>{type}</b><span>{stock?.levels?.[type] || "Não informado"}</span></div>)}</div>
    <small>{stock?.updatedAt?`Atualizado em ${new Date(stock.updatedAt).toLocaleString("pt-BR")}. Dados informados por administrador, não sincronizados automaticamente com a Pró-Sangue.`:"Sem integração oficial de estoque em tempo real. Não há dados verificados disponíveis."}</small>
    <p><a href="https://www.prosangue.sp.gov.br/" target="_blank" rel="noreferrer">Consultar informações oficiais da Pró-Sangue</a></p>
  </section>
}
function AdminManagement(){
  const [data,setData]=useState(null),[error,setError]=useState(""),[levels,setLevels]=useState({}),[source,setSource]=useState("");
  const refresh=()=>api("/admin/management").then(setData).catch(e=>setError(e.message));
  useEffect(()=>{refresh()},[]);
  async function remove(kind,id){if(!window.confirm(`Excluir o registro ${id}? Esta operação será auditada e não poderá ser desfeita.`))return;try{await api(`/admin/management/${kind}/${id}`,{method:"DELETE"});refresh()}catch(e){setError(e.message)}}
  async function save(e){e.preventDefault();try{await api("/admin/blood-stock",{method:"PUT",body:JSON.stringify({levels,source})});setError("Estoque salvo como informação administrativa, sem vínculo automático com a Pró-Sangue.")}catch(e){setError(e.message)}}
  return <div className="page-stack"><PageHeading eyebrow="ACESSO RESTRITO" title="Administração VIVA+" description="Gerencie registros com autenticação, auditoria e confirmação de exclusão."/>{error&&<p role="status" className="notice-box">{error}</p>}
    <form className="panel institution-form" onSubmit={save}><h2>Estoque de sangue — lançamento manual</h2><p>Não informe níveis como oficiais sem autorização e fonte verificável da instituição.</p><div className="stock-grid">{bloodTypes.map(t=><label key={t}>{t}<select value={levels[t]||""} onChange={e=>setLevels({...levels,[t]:e.target.value})}><option value="">Não informado</option><option>Crítico</option><option>Baixo</option><option>Estável</option></select></label>)}</div><Field label="Fonte e autorização institucional"><input required value={source} onChange={e=>setSource(e.target.value)} placeholder="Referência oficial e data"/></Field><button className="btn btn-primary">Salvar atualização</button></form>
    {data && [["users","Usuários"],["campaigns","Campanhas"],["donations","Doações"]].map(([kind,title])=><section className="panel table-panel" key={kind}><div className="panel-head"><h2>{title}</h2></div><div className="table-wrap"><table><thead><tr><th>ID</th><th>Descrição</th><th>Ação</th></tr></thead><tbody>{data[kind].map(item=><tr key={item.id}><td>#{item.id}</td><td>{item.name||item.title||`Doação ${item.date} — doador #${item.userId}`}</td><td><button className="btn btn-quiet-danger" onClick={()=>remove(kind,item.id)}>Excluir</button></td></tr>)}</tbody></table></div></section>)}
  </div>
}

createRoot(document.getElementById("root")).render(<App/>);
