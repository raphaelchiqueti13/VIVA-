// Fonte única dos selos e das propostas de benefício ligadas a cada selo.
// A regra do selo é a mesma usada em server/index.js (/api/dashboard):
// Bronze 1 · Prata 3 · Ouro 5 · Diamante 10 doações VALIDADAS por instituição.

export const levels = [
  { name: "Bronze",   count: 1,  color: "#b77948", text: "Primeira doação validada" },
  { name: "Prata",    count: 3,  color: "#8895a7", text: "3 doações validadas" },
  { name: "Ouro",     count: 5,  color: "#d6a83e", text: "5 doações validadas" },
  { name: "Diamante", count: 10, color: "#5b9fa6", text: "10 doações validadas" }
];

export const levelByName = Object.fromEntries(levels.map(l => [l.name, l]));

// `tier` = selo mínimo para a proposta valer para o doador.
// `icon` é o nome de um ícone do lucide-react resolvido em main.jsx.
export const benefits = [
  {
    id: "cultura", tier: "Bronze", icon: "Ticket", category: "Cultura",
    title: "Cultura e lazer",
    description: "Descontos em cinemas, teatros, museus e eventos culturais para quem já tem ao menos uma doação validada.",
    detail: "Dependeria de parcerias voluntárias e das regras de cada estabelecimento. O estabelecimento consultaria o selo na carteira (QR) em vez de pedir comprovantes."
  },
  {
    id: "universidade", tier: "Prata", icon: "University", category: "Universidades",
    title: "Reconhecimento universitário",
    description: "Doadores com selo Prata ou superior poderiam ter a atividade reconhecida como extensão ou horas complementares.",
    detail: "Cada universidade decide se adere e define suas próprias regras. O histórico validado no VIVA+ serviria como comprovante."
  },
  {
    id: "prevencao", tier: "Prata", icon: "Stethoscope", category: "Prevenção",
    title: "Ações preventivas e vacinação",
    description: "Acesso facilitado a campanhas de vacinação e ações preventivas organizadas junto a unidades de saúde parceiras.",
    detail: "Depende de programas oficiais e da capacidade dos serviços. Não é check-up gratuito garantido."
  },
  {
    id: "vestibular", tier: "Ouro", icon: "GraduationCap", category: "Educação",
    title: "Incentivo em vestibulares e exames",
    description: "Selo Ouro ou Diamante: proposta de isenção ou desconto em taxas de inscrição de vestibulares e exames, incluindo o ENEM.",
    detail: "Não garante desconto ou isenção no ENEM. Cada organizador define critérios; a proposta depende de parceria ou de lei."
  },
  {
    id: "prioridade", tier: "Ouro", icon: "HeartPulse", category: "Saúde",
    title: "Atendimento administrativo prioritário",
    description: "Proposta de orientação e agilidade administrativa para doadores Ouro e Diamante em serviços públicos de saúde, inclusive no SUS.",
    detail: "Não cria prioridade clínica nem substitui a classificação de risco. Qualquer prioridade adicional depende de base legal."
  },
  {
    id: "transporte", tier: "Diamante", icon: "Bus", category: "Mobilidade",
    title: "Transporte Solidário — 70% de desconto na passagem",
    description: "Exclusivo do selo Diamante: desconto de 70% na tarifa do transporte público para quem tem 10 ou mais doações validadas.",
    detail: "É uma proposta, não um benefício vigente. Depende de lei, orçamento e adesão dos operadores. A elegibilidade seria checada pelo selo Diamante da carteira."
  },
  {
    id: "govbr", tier: "Diamante", icon: "BadgeCheck", category: "Gov.br",
    title: "Reforço do nível da conta Gov.br",
    description: "Proposta para que o histórico de 10+ doações validadas conte como comprovação adicional e ajude a elevar o nível (Bronze → Prata → Ouro) da conta Gov.br do doador.",
    detail: "Hoje não há integração entre VIVA+ e Gov.br. Dependeria de acordo com o órgão responsável pela plataforma, de base legal e de consentimento do titular (LGPD). Na prática seria uma verificação extra, nunca um atalho para os demais critérios do Gov.br."
  }
];

export const tierRank = name => levels.findIndex(l => l.name === name) + 1; // Iniciante = 0
export const benefitsFor = name => benefits.filter(b => b.tier === name);
export const isUnlocked = (benefit, count) => count >= levelByName[benefit.tier].count;
