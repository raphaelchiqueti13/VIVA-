import React, { useEffect, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, ArrowRight, Building2, CalendarDays, Droplet, HeartPulse, QrCode, ShieldCheck, Sparkles, Users, Wallet } from "lucide-react";
import { api } from "./api";

const monthLabel = (m) => new Date(`${m}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

function useCountUp(target, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reduceMotion === "true";
    if (reduce || !target) { setV(target || 0); return; }
    let raf, start;
    const tick = (t) => { start ??= t; const p = Math.min(1, (t - start) / ms); setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Metric({ icon: Icon, label, value, detail }) {
  const n = useCountUp(value);
  return <div className="imp-metric"><span className="imp-metric-icon"><Icon size={20}/></span><b aria-label={`${value} ${label}`}>{n.toLocaleString("pt-BR")}</b><span>{label}</span><small>{detail}</small></div>;
}

function Tip({ active, payload, label, suffix }) {
  if (!active || !payload?.length) return null;
  return <div className="imp-tip"><b>{label}</b><span>{payload[0].value} {suffix}</span></div>;
}

export default function ImpactPage({ onAuth, onNavigate }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const ref = useRef(null);
  useEffect(() => { api("/public/impact").then(setD).catch(e => setError(e.message)); }, []);

  if (error) return <div className="panel empty-campaigns"><h2>Não foi possível carregar o impacto</h2><p>{error}</p></div>;
  if (!d) return <div className="panel empty-campaigns" role="status"><h2>Carregando indicadores…</h2></div>;

  const monthly = d.monthly.map(m => ({ ...m, label: monthLabel(m.month) }));
  const funnel = [
    { label: "Doadores cadastrados", value: d.donors },
    { label: "Doaram ao menos uma vez", value: d.donorsWithDonation },
    { label: "Doaram duas vezes ou mais", value: d.recurringDonors },
  ];
  const top = Math.max(1, ...funnel.map(f => f.value));
  const retention = d.donors ? Math.round((d.recurringDonors / d.donors) * 100) : 0;

  return <div className="page-stack imp" ref={ref}>
    <section className="imp-hero">
      <div className="imp-hero-copy">
        <span className="imp-kicker"><Sparkles size={14}/> VIVA+ · CARTEIRA NACIONAL DO DOADOR</span>
        <h1>Transformar o gesto de doar em um hábito.</h1>
        <p>A doação de sangue depende de pessoas voltando. O VIVA+ conecta doadores, hemocentros e campanhas em uma carteira digital que reconhece, lembra e retém.</p>
        <div className="imp-hero-actions"><button className="btn imp-btn-light" onClick={() => onNavigate("carteira")}>Ver a carteira do doador <ArrowRight size={15}/></button><button className="btn imp-btn-ghost" onClick={onAuth}>Criar conta de teste</button></div>
      </div>
      <div className="imp-context" aria-label="Contexto nacional">
        <div><b>1,6%</b><span>da população brasileira doou sangue no SUS em 2023</span></div>
        <div><b>3,2 mi</b><span>de bolsas coletadas no mesmo ano</span></div>
        <div><b>até 4</b><span>pessoas podem ser ajudadas por doação*</span></div>
        <small>Fonte: Ministério da Saúde, dados de 2023. *Estimativa informativa amplamente citada, não resultado do VIVA+.</small>
      </div>
    </section>

    {d.demo && <div className="imp-demo" role="note"><ShieldCheck size={16}/><span><b>Ambiente de demonstração.</b> Os números abaixo vêm de contas fictícias (@demo.viva) geradas para esta apresentação. Não representam doadores, unidades ou doações reais.</span></div>}

    <section aria-labelledby="imp-num"><h2 id="imp-num" className="req-title">A plataforma em números</h2>
      <div className="imp-metrics">
        <Metric icon={Users} label="Doadores cadastrados" value={d.donors} detail="Contas de doador ativas"/>
        <Metric icon={Droplet} label="Doações validadas" value={d.donations} detail="Confirmadas por perfil institucional"/>
        <Metric icon={HeartPulse} label="Vidas potencialmente ajudadas" value={d.potentialLives} detail="Estimativa: 4 por doação"/>
        <Metric icon={Activity} label="Doadores recorrentes" value={d.recurringDonors} detail={`${retention}% dos cadastrados doaram 2x ou mais`}/>
      </div>
    </section>

    <section className="imp-two">
      <div className="panel imp-chart"><div className="panel-head"><div><span className="section-kicker">TRAÇÃO</span><h2>Doações validadas por mês</h2></div><span className="icon-soft"><CalendarDays size={18}/></span></div>
        <div className="imp-chart-box" role="img" aria-label="Gráfico de doações validadas nos últimos seis meses">
          <ResponsiveContainer width="100%" height={240}><AreaChart data={monthly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs><linearGradient id="impArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c51f3a" stopOpacity={0.45}/><stop offset="100%" stopColor="#c51f3a" stopOpacity={0.02}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8d8dc"/><XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11}/><YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11}/>
            <Tooltip content={<Tip suffix="doações"/>}/><Area type="monotone" dataKey="donations" stroke="#c51f3a" strokeWidth={3} fill="url(#impArea)" dot={{ r: 4, fill: "#c51f3a" }}/>
          </AreaChart></ResponsiveContainer>
        </div>
      </div>
      <div className="panel imp-chart"><div className="panel-head"><div><span className="section-kicker">PERFIL</span><h2>Doadores por tipo sanguíneo</h2></div><span className="icon-soft"><Droplet size={18}/></span></div>
        <div className="imp-chart-box" role="img" aria-label="Gráfico de doadores por tipo sanguíneo">
          <ResponsiveContainer width="100%" height={240}><BarChart data={d.bloodTypes} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8d8dc"/><XAxis dataKey="type" tickLine={false} axisLine={false} fontSize={11}/><YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11}/>
            <Tooltip content={<Tip suffix="doadores"/>} cursor={{ fill: "#fdecef" }}/><Bar dataKey="donors" fill="#c51f3a" radius={[8, 8, 0, 0]}/>
          </BarChart></ResponsiveContainer>
        </div>
      </div>
    </section>

    <section className="panel imp-funnel"><div className="panel-head"><div><span className="section-kicker">CONVERSÃO</span><h2>Do cadastro à doação recorrente</h2></div><span className="icon-soft"><Wallet size={18}/></span></div>
      {funnel.map((f, i) => <div className="imp-fun-row" key={f.label}><span>{f.label}</span><div className="imp-fun-track"><div style={{ width: `${Math.max(4, (f.value / top) * 100)}%`, opacity: 1 - i * 0.14 }}/></div><b>{f.value.toLocaleString("pt-BR")}</b></div>)}
    </section>

    <section aria-labelledby="imp-how"><h2 id="imp-how" className="req-title">Como o VIVA+ gera valor</h2>
      <div className="imp-steps">
        {[[Wallet, "Carteira digital", "O doador acompanha histórico, selos e próxima data possível de doação."], [QrCode, "QR temporário e seguro", "Identificação de uso único, verificada apenas por perfil institucional."], [Building2, "Painel do hemocentro", "Confirma agendamentos, valida doações e cria campanhas direcionadas."], [HeartPulse, "Retenção", "Selos, lembretes de elegibilidade e campanhas incentivam a doação regular."]].map(([I, t, x]) => <article className="panel imp-step" key={t}><span className="icon-soft"><I size={18}/></span><h3>{t}</h3><p>{x}</p></article>)}
      </div>
    </section>

    <section className="imp-two">
      <div className="panel imp-road"><span className="section-kicker">PRÓXIMOS PASSOS</span><h2>Do protótipo ao piloto</h2>
        <ol><li><b>Piloto com um hemocentro parceiro</b><small>Formalizar parceria e validar o fluxo com a equipe de coleta.</small></li><li><b>Integração oficial de estoque</b><small>Depende de API ou autorização da Fundação Pró-Sangue; hoje o estoque é lançamento manual.</small></li><li><b>Leitura de QR por câmera</b><small>Scanner seguro com HTTPS e testes em dispositivo real.</small></li><li><b>Conformidade com a LGPD</b><small>Base legal, política de retenção e revisão de segurança antes de dados reais.</small></li></ol>
      </div>
      <div className="panel imp-road"><span className="section-kicker">SUSTENTABILIDADE</span><h2>Caminhos em exploração</h2>
        <ol><li><b>Editais de inovação</b><small>FAPESP PIPE, Sebrae e InovAtiva Brasil estão em avaliação.</small></li><li><b>Ecossistema ESG</b><small>Empresas patrocinando campanhas de mobilização, sem pagamento por doação.</small></li><li><b>Painéis de inteligência</b><small>Indicadores agregados e anônimos para gestores de saúde.</small></li></ol>
        <small className="imp-foot">Itens em planejamento; nenhuma parceria é afirmada nesta versão.</small>
      </div>
    </section>

    <div className="notice-box"><b>Transparência dos dados</b><p>Indicadores calculados em tempo real a partir do banco do VIVA+, de forma agregada e anônima. O VIVA+ é um projeto acadêmico e não substitui sistemas oficiais de hemoterapia. Atualizado em {new Date(d.generatedAt).toLocaleString("pt-BR")}.</p></div>
  </div>;
}
