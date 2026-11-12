import React, { useState } from "react";
import { ArrowRight, CalendarDays, Check, ClipboardCheck, Clock3, FileText, HeartPulse, Scale, ShieldCheck, Sparkles, UserRound } from "lucide-react";

// Critérios gerais conforme a Portaria GM/MS nº 11.685, de 2 de julho de 2026 (em vigor desde 30/09/2026).
// Os serviços de hemoterapia podem ter regras complementares; a triagem presencial é sempre quem decide.
const basics = [
  { icon: UserRound, title: "Idade", text: "De 16 anos completos a 69 anos, 11 meses e 29 dias. Menores de 18 anos precisam de consentimento formal, por escrito, do responsável legal a cada doação.", note: "Primeira doação: até 60 anos, 11 meses e 29 dias. Quem já doa regularmente pode continuar após os 70, com avaliação médica." },
  { icon: Scale, title: "Peso", text: "Pesar no mínimo 50 kg.", note: "O volume coletado considera o peso e as condições do doador." },
  { icon: HeartPulse, title: "Saúde", text: "Estar bem de saúde no dia da doação, sem sintomas de infecção como febre, tosse ou dor de garganta.", note: "Pressão, pulso e hemoglobina são conferidos na triagem." },
  { icon: FileText, title: "Documento", text: "Levar documento oficial com foto.", note: "Confirme na unidade quais documentos são aceitos." },
  { icon: Clock3, title: "Intervalo entre doações", text: "Homens: mínimo de 2 meses entre doações, no máximo 4 por ano. Mulheres: mínimo de 3 meses, no máximo 3 por ano.", note: "Vale para doação de sangue total." },
];

const dayBefore = [
  "Ter dormido pelo menos 6 horas nas últimas 24 horas.",
  "Estar alimentado no dia da doação.",
  "Evitar alimentos gordurosos nas 3 horas antes da doação.",
  "Levar o documento oficial com foto.",
];

const waits = [
  ["Resfriado comum", "3 dias após o fim dos sintomas"],
  ["Gripe com febre (acima de 38 °C)", "2 semanas após o fim dos sintomas"],
  ["Extração dentária ou tratamento de canal", "7 dias, conforme o medicamento usado"],
  ["Tatuagem, micropigmentação, acupuntura, piercing ou procedimento estético (botox, preenchimento)", "7 dias se feito em local seguro e comprovável; caso contrário, 4 meses"],
  ["Endoscopia", "4 meses"],
  ["Situações de maior risco para infecções sexualmente transmissíveis", "4 meses"],
];

function addMonths(dateStr, months) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return target;
}

function NextDonation() {
  const [sex, setSex] = useState("");
  const [last, setLast] = useState("");
  const todayStr = new Date().toLocaleDateString("en-CA");
  let result = null;
  if (sex && last && last <= todayStr) {
    const next = addMonths(last, sex === "F" ? 3 : 2);
    const ok = next <= new Date(new Date().setHours(23, 59, 59, 999));
    result = { next: next.toLocaleDateString("pt-BR"), ok };
  }
  return <div className="panel req-calc">
    <div className="panel-head"><div><span className="section-kicker">CALCULADORA</span><h2>Quando posso doar de novo?</h2></div><span className="icon-soft"><CalendarDays size={18}/></span></div>
    <div className="form-row">
      <label className="field"><span>Sexo biológico (define o intervalo)</span><select value={sex} onChange={e=>setSex(e.target.value)}><option value="">Selecione</option><option value="M">Masculino (2 meses)</option><option value="F">Feminino (3 meses)</option></select></label>
      <label className="field"><span>Data da última doação</span><input type="date" max={todayStr} value={last} onChange={e=>setLast(e.target.value)}/></label>
    </div>
    {last && last > todayStr && <p className="req-result req-wait" role="status">A data não pode ser futura.</p>}
    {result && <p className={`req-result ${result.ok ? "req-ok" : "req-wait"}`} role="status">{result.ok ? <><Check size={16}/> O intervalo mínimo já passou (desde {result.next}). Confira os demais requisitos e agende.</> : <><Clock3 size={16}/> Você poderá doar novamente a partir de {result.next}.</>}</p>}
    <small className="req-hint">Cálculo apenas informativo e feito no seu aparelho, sem salvar dados. Não considera o limite anual de doações nem outros impedimentos.</small>
  </div>;
}

export default function RequirementsPage({ onBook }) {
  return <div className="page-stack">
    <div className="page-heading"><div><span className="section-kicker">ANTES DE DOAR</span><h1>Requisitos para doar sangue</h1><p>Veja se você atende aos critérios básicos e como se preparar. A decisão final é da equipe de saúde, na triagem presencial.</p></div><button className="btn btn-primary" onClick={onBook}><CalendarDays size={16}/> Agendar doação</button></div>

    <section aria-labelledby="req-basic"><h2 id="req-basic" className="req-title">Critérios básicos</h2>
      <div className="req-grid">{basics.map(b=><article className="panel req-card" key={b.title}><span className="icon-soft"><b.icon size={18}/></span><h3>{b.title}</h3><p>{b.text}</p><small>{b.note}</small></article>)}</div>
    </section>

    <NextDonation/>

    <section className="req-two">
      <div className="panel req-card"><span className="icon-soft"><ClipboardCheck size={18}/></span><h3>Como se preparar</h3><ul className="req-list">{dayBefore.map(t=><li key={t}><Check size={14}/>{t}</li>)}</ul></div>
      <div className="panel req-card"><span className="icon-soft"><Sparkles size={18}/></span><h3>Depois da doação</h3><ul className="req-list"><li><Check size={14}/>Siga as orientações da equipe sobre descanso, alimentação e líquidos.</li><li><Check size={14}/>Se sentir tontura ou mal-estar, avise a equipe do hemocentro.</li><li><Check size={14}/>Respeite o intervalo mínimo antes da próxima doação.</li></ul></div>
    </section>

    <section aria-labelledby="req-wait"><h2 id="req-wait" className="req-title">Impedimentos temporários mais comuns</h2>
      <div className="panel table-panel"><div className="table-wrap"><table className="req-table"><thead><tr><th>Situação</th><th>Prazo de espera</th></tr></thead><tbody>{waits.map(([s,p])=><tr key={s}><td>{s}</td><td>{p}</td></tr>)}</tbody></table></div></div>
    </section>

    <div className="notice-box"><b><ShieldCheck size={13}/> Importante</b><p>Esta página é informativa e não substitui a triagem. Medicamentos, cirurgias, doenças crônicas, histórico de câncer, viagens a áreas de risco e outras situações são avaliados individualmente na entrevista, e cada hemocentro pode ter regras complementares. Critérios conforme a Portaria GM/MS nº 11.685/2026, em vigor desde 30/09/2026. Fonte: <a href="https://www.gov.br/hubrasil/pt-br/comunicacao/noticias/novos-criterios-para-doacao-de-sangue-podem-ampliar-numero-de-doadores-aptos" target="_blank" rel="noreferrer">Ministério da Saúde / gov.br</a>. Em caso de dúvida, consulte o serviço de hemoterapia da sua região.</p></div>
    <button className="btn btn-secondary req-cta" onClick={onBook}>Atendo aos requisitos, quero agendar <ArrowRight size={15}/></button>
  </div>;
}
