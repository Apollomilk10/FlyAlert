# FlyAlert

Cansei de abrir o Google Flights toda semana pra ver se a passagem caiu.
Montei isso pra ele me avisar sozinho.

Roda inteiro em free tier: GitHub Actions faz o cron, Supabase guarda o
histórico, SerpApi busca o preço e o OneSignal manda o push.
Custo mensal: R$ 0.

## Como funciona

A cada 6h o GitHub Actions roda `scripts/check-price.mjs`, que consulta o Google
Flights via SerpApi, grava a leitura no Supabase e dispara um push se o preço:

- bateu o teto que você definiu (`target_price`), **ou**
- ficou abaixo da faixa normal que o próprio Google calcula para a rota, **ou**
- é o menor já registrado no seu histórico.

Tem cooldown de 20h para o mesmo alerta não repetir, exceto se cair mais 5%.

## Setup (~30 min)

### 1. Supabase
Crie um projeto, abra o SQL Editor e rode `db/schema.sql`.
Depois insira sua rota na tabela `watches` (tem um exemplo comentado no final do arquivo).
A coluna `outbound_times` filtra o horário de decolagem: `"4,10"` = entre 4h e 10h.
Anote em Settings > API: a **URL**, a **anon key** e a **service_role key**.

### 2. SerpApi
Crie a conta em serpapi.com, copie a API key do dashboard e confirme ali mesmo
quantas buscas o free tier te dá — o número mudou algumas vezes em 2026.

### 3. OneSignal
Crie um app do tipo **Web**, com o site URL apontando pro seu GitHub Pages
(`https://Apollomilk10.github.io/FlyAlert/`). Anote o **App ID** e a
**REST API Key**.

### 4. Secrets do repositório
Settings > Secrets and variables > Actions:

| Secret | De onde vem |
|---|---|
| `SERPAPI_KEY` | dashboard do SerpApi |
| `SUPABASE_URL` | Supabase > Settings > API |
| `SUPABASE_SERVICE_KEY` | Supabase, service_role (**nunca** no front) |
| `ONESIGNAL_APP_ID` | OneSignal |
| `ONESIGNAL_API_KEY` | OneSignal, REST API Key |

### 5. Front
Em `web/index.html`, preencha `SUPABASE_URL`, `SUPABASE_ANON` (anon key, não a
service_role) e `ONESIGNAL_APP_ID`. Publique a pasta `web/` no GitHub Pages.
Baixe os arquivos do SDK do OneSignal (`OneSignalSDKWorker.js`) e coloque em
`web/` — o OneSignal mostra o link no próprio painel de setup.

### 6. Testar
Actions > "Checar preços" > Run workflow. Veja o log e confira se apareceu uma
linha em `price_checks`.

Para testar sem enviar push: rode local com `DRY_RUN=true node scripts/check-price.mjs`.

## Consumo de buscas

1 rota × 4 consultas/dia ≈ 124 buscas/mês. Se adicionar rotas, ajuste o cron em
`.github/workflows/check-price.yml` para não estourar a cota.

## Pontos de atenção

- **iOS**: push só funciona se você adicionar o site à tela de início (iOS 16.4+).
  No Android funciona pelo navegador normalmente.
- **GitHub Actions**: cron em repositório público é pausado após 60 dias sem
  commits. Um commit qualquer reativa.
- **Horário do cron**: está em UTC. `1,7,13,19` UTC = 22h, 4h, 10h, 16h em Brasília.
