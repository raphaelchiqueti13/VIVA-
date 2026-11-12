## Selos ligados aos benefícios (12/11/2026)

Os benefícios de `Propostas e benefícios` agora dependem do selo do doador (regras em `src/benefits.js`, usadas também em "Meus selos" e na carteira):

| Selo | Doações validadas | Propostas desbloqueadas |
|---|---|---|
| Bronze | 1+ | Cultura e lazer |
| Prata | 3+ | Reconhecimento universitário; ações preventivas e vacinação |
| Ouro | 5+ | Vestibulares/exames; atendimento administrativo prioritário |
| Diamante | 10+ | Passagem com 70% de desconto; reforço do nível da conta Gov.br |

Os benefícios são cumulativos. Continuam sendo **propostas**: não há integração com Gov.br nem com operadores de transporte, e a doação segue voluntária e não remunerada.

## Correções aplicadas em 11/11/2026

- Corrigidas expressões regulares do servidor que impediam a validação correta de e-mail, datas e horários e a leitura do token Bearer.
- Mensagem clara na interface quando a API estiver desligada ou inacessível.
- Tratamento de sessão expirada e exibição de erros na carga inicial.
- Datas iniciais do formulário calculadas no fuso local do navegador.
- Incluído roteiro de verificação rápida (`TESTES_APRESENTACAO.md`).

**Validação nesta entrega:** sintaxe do backend conferida com `node --check`; a instalação completa das dependências e os testes de ponta a ponta não puderam ser concluídos neste ambiente. Execute os testes guiados antes da apresentação.

# VIVA+ — Carteira Digital do Doador

Aplicação acadêmica com frontend React/Vite, API Node/Express e banco SQLite. Esta versão remove unidades fictícias e melhora os fluxos internos de autenticação, diretório, agendamentos, QR e área institucional.

> **Limite de uso:** o VIVA+ não é um sistema oficial de hemoterapia. Não substitui triagem clínica, prontuário, carteira oficial ou agendamento nos sistemas de hemocentros. Não cadastre dados reais de saúde até concluir revisão jurídica, segurança, privacidade/LGPD e parceria institucional.

## O que foi melhorado

- Removido o seed de três hemocentros fictícios. O diretório inicia vazio e só exibe unidades cadastradas por administrador com fonte HTTPS informada.
- Cadastro de unidades reais no painel administrativo, incluindo fonte oficial e link externo de agendamento.
- Agendamentos agora são **solicitações pendentes** no VIVA+; a unidade vinculada pode confirmar internamente. A aplicação informa que isso não reserva vaga em sistemas externos.
- Painel institucional com fila de solicitações e confirmação de agendamentos.
- QR da carteira com token assinado, expiração de 20 segundos, verificação exclusiva por perfil institucional autenticado e prevenção de reutilização do mesmo token.
- Endpoint e tela institucional para leitura/verificação de QR usando leitor USB ou conteúdo colado.
- Validação de doação restrita a perfis institucionais autenticados, com bloqueio de data futura e prevenção de duplicidade quando há unidade associada.
- Respostas institucionais deixam de expor e-mails dos doadores na listagem.
- JWT com emissor/audiência, segredo obrigatório em produção, limitação básica de tentativas em autenticação e cabeçalhos de segurança.
- Frontend e API podem ser servidos no mesmo domínio em produção; Vite faz proxy `/api` durante desenvolvimento.
- Migrações aditivas preservam os dados de instalações anteriores; a migração de agendamentos preserva registros existentes.

## O que continua dependendo de terceiros

Não há API pública universal conectada a todos os hemocentros. Para usar dados reais, o administrador deve conferir nome, endereço, telefone, horário e URL diretamente em fonte oficial e cadastrar essa referência no painel. O link externo de agendamento é apenas um atalho para o sistema da instituição; não sincroniza reservas.

Ainda não há integração automática com Gov.br, prontuários, sistemas clínicos, transporte público ou benefícios. O VIVA+ não envia e-mail/SMS/push: as preferências de comunicação ficam salvas, mas o envio depende de contratação/configuração de um provedor. A verificação de QR confirma apenas que o token foi emitido pelo VIVA+ e não foi reutilizado; não confirma identidade civil nem aptidão para doar.

## Requisitos

- Node.js 20+
- npm
- Em Linux, `build-essential`, `python3`, `make` e `g++` podem ser necessários para compilar `better-sqlite3`.

## Rodar localmente

```bash
npm install
cp .env.example .env
```

Edite `.env` e configure um segredo aleatório com pelo menos 32 caracteres em `JWT_SECRET`.

```bash
npm start
```

- Frontend: http://localhost:5173
- API: http://localhost:3001/api/health

Gerar build de produção:

```bash
npm run build
NODE_ENV=production npm run start:prod
```

Em produção, o Express serve o conteúdo de `dist/` e a API no mesmo domínio.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `NODE_ENV` | Use `production` em produção. |
| `PORT` | Porta fornecida pelo provedor de hospedagem. |
| `JWT_SECRET` | Segredo aleatório forte; obrigatório em produção (mínimo 32 caracteres). |
| `DATABASE_PATH` | Caminho do SQLite. Use disco persistente, por exemplo `/var/data/viva.sqlite`. |
| `CORS_ORIGINS` | Origens adicionais permitidas, separadas por vírgula, se frontend e API estiverem em domínios diferentes. |
| `VITE_API_URL` | URL da API durante o build; padrão `/api` para mesmo domínio. |

## Hospedagem

Há um `render.yaml` de referência para um serviço Render com disco persistente. O plano configurado requer suporte a disco persistente. Antes de publicar:
1. Revise as variáveis de ambiente e confirme que `JWT_SECRET` foi gerado pelo provedor.
2. Confirme que o disco está montado em `/var/data` e que `DATABASE_PATH=/var/data/viva.sqlite`.
3. Não use SQLite em armazenamento efêmero: os dados podem desaparecer em reinicializações/deploys.
4. Teste `/api/health`, cadastro, login, campanhas, agendamentos, QR e permissões institucionais.
5. Configure domínio/HTTPS e política de backup do banco.

Para escala com múltiplas instâncias, migre para PostgreSQL com migrações versionadas; SQLite em disco persistente é adequado apenas para uma instância pequena.

## Diretório de hemocentros

O diretório começa vazio intencionalmente. Um administrador deve:
1. Criar uma conta de usuário normal e promovê-la a `admin` usando o procedimento abaixo.
2. Consultar a fonte oficial da unidade e inserir os dados conferidos no formulário **Cadastrar unidade real**.
3. Informar a URL oficial da fonte e, se existir, a URL oficial de agendamento.
4. Criar a conta da instituição, promovê-la a `hemocenter` e vinculá-la à unidade.

Não use endereços ou horários presumidos. A URL informada deve ser HTTPS.

## Provisionamento inicial de perfis

O cadastro público cria somente contas de doador. Para criar o primeiro administrador local, registre uma conta pela interface e execute no SQLite:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@exemplo.com';
```

Saia e entre novamente para receber um token com o novo perfil. Após cadastrar uma unidade no painel, crie a conta da instituição e vincule-a:

```sql
UPDATE users
SET role = 'hemocenter', hemocenter_id = 1
WHERE email = 'unidade@exemplo.com';
```

Substitua o ID pelo ID real da unidade cadastrada. Faça o provisionamento somente para pessoas autorizadas, com consentimento e controle institucional.

## Banco de dados

O schema fica em `database/schema.sql`; o banco local é criado em `database/viva.sqlite`. Tabelas principais:
- `users`
- `hemocenters`
- `donation_records`
- `appointments`
- `campaigns`
- `audit_logs`
- `qr_verifications`

As migrações adicionam campos sem apagar usuários existentes. A instalação anterior que continha unidades fictícias precisa de revisão manual: unidades antigas não são exibidas porque não possuem `verified_at`. Um administrador deve desativar/remover esses registros e cadastrar dados oficiais conferidos.

## Segurança e privacidade — antes de uso público

Este código é uma base acadêmica melhorada, não uma certificação de segurança. Antes de usar dados pessoais reais:
- Fazer revisão independente de segurança e testes automatizados.
- Implementar recuperação de senha e verificação de e-mail.
- Usar rate limiting compartilhado (Redis/gateway) se houver múltiplas instâncias.
- Configurar logs, monitoramento, backup e política de retenção.
- Definir base legal, consentimento quando aplicável, direitos dos titulares, controlador/operador e política de privacidade LGPD.
- Minimizar dados pessoais: a tela institucional não deve usar dados além do necessário.
- Validar acessibilidade com leitores de tela e usuários.
- Formalizar parcerias e fluxos com instituições de hemoterapia.
- Fazer auditoria técnica das regras de elegibilidade; o sistema não decide aptidão para doação.

## Acessibilidade

O painel oferece escala de texto, alto contraste, redução de animações, sublinhado de links e atalho `Alt + Shift + A`. O widget VLibras foi removido nesta versão; o painel de acessibilidade interno o substitui.

## Página de Impacto (investidores)

`src/Impact.jsx` consome `GET /api/public/impact`, que devolve apenas métricas agregadas e anônimas calculadas do banco. Dados do contexto nacional citam o Ministério da Saúde (2023). Para demonstração, `npm run seed:apresentacao` gera dados fictícios e a interface os sinaliza como tal.

## Requisitos para doar

A página **Requisitos para doar** (`src/Requirements.jsx`) reúne os critérios gerais de aptidão (idade, peso, intervalo, preparo e impedimentos temporários mais comuns), com calculadora local de próxima doação. Base: Portaria GM/MS nº 11.685/2026, em vigor desde 30/09/2026. É conteúdo informativo; a aptidão é decidida na triagem presencial. Revise os textos quando houver nova portaria.
