#!/usr/bin/env node
/**
 * Consulta o preço das rotas ativas, grava o histórico e avisa quando cair.
 * Roda no GitHub Actions. Sem servidor.
 */

const {
  SERPAPI_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  ONESIGNAL_APP_ID,
  ONESIGNAL_API_KEY,
  ONESIGNAL_SUBSCRIPTION_ID,
  DRY_RUN,
} = process.env;

const COOLDOWN_HOURS = 20;   // não repete alerta antes disso
const REALERT_DROP = 0.05;   // ...a menos que caia mais 5% do último alerta
const JANELA_DIAS = 30;      // referência: mínimo observado nesse período
const MAX_OFERTAS = 5;       // quantas opções guardar para comparação
const QUEDA_MINIMA = 50;     // em R$ — ignora queda insignificante
const AVISAR_SEMPRE = true;  // true = push a cada consulta, mesmo sem queda

for (const [k, v] of Object.entries({ SERPAPI_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY })) {
  if (!v) {
    console.error(`Falta a variável ${k}. Configure em Settings > Secrets do repositório.`);
    process.exit(1);
  }
}

// ---------- Supabase (REST, sem SDK) ----------

async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// ---------- SerpApi / Google Flights ----------

async function fetchPrice(watch) {
  const params = new URLSearchParams({
    engine: 'google_flights',
    departure_id: watch.departure_id,
    arrival_id: watch.arrival_id,
    outbound_date: watch.outbound_date,
    type: String(watch.trip_type),
    currency: watch.currency,
    hl: 'pt-br',
    gl: 'br',
    api_key: SERPAPI_KEY,
  });
  if (watch.trip_type === 1 && watch.return_date) {
    params.set('return_date', watch.return_date);
  }
  if (watch.adults && watch.adults > 1) {
    params.set('adults', String(watch.adults));
  }
  if (watch.outbound_times) {
    params.set('outbound_times', watch.outbound_times);
  }

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  const data = await res.json();
  if (data.error) throw new Error(`SerpApi: ${data.error}`);

  const offers = [...(data.best_flights ?? []), ...(data.other_flights ?? [])];
  if (!offers.length) return null;

  const resumo = (o) => {
    const pernas = o.flights ?? [];
    const primeira = pernas[0] ?? {};
    const ultima = pernas[pernas.length - 1] ?? {};
    const cias = [...new Set(pernas.map(f => f.airline).filter(Boolean))];
    return {
      price: o.price,
      airlines: cias,
      duration_min: o.total_duration ?? null,
      stops: Math.max(pernas.length - 1, 0),
      departure: primeira.departure_airport?.time ?? null,
      departure_id: primeira.departure_airport?.id ?? null,
      arrival: ultima.arrival_airport?.time ?? null,
    };
  };

  const melhores = [...offers]
    .sort((a, b) => a.price - b.price)
    .slice(0, MAX_OFERTAS)
    .map(resumo);

  const cheapest = offers.reduce((a, b) => (b.price < a.price ? b : a));
  const insights = data.price_insights ?? {};
  const [typicalLow, typicalHigh] = insights.typical_price_range ?? [null, null];

  return {
    price: cheapest.price,
    currency: watch.currency,
    price_level: insights.price_level ?? null,
    typical_low: typicalLow,
    typical_high: typicalHigh,
    airline: cheapest.flights?.[0]?.airline ?? null,
    duration_min: cheapest.total_duration ?? null,
    booking_url: data.search_metadata?.google_flights_url ?? null,
    offers: melhores,
    raw: { insights, flights: cheapest.flights ?? [] },
  };
}

// ---------- Decisão: isso é uma barganha? ----------

const money = (v, currency = 'BRL') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(v);

async function shouldAlert(watch, reading) {
  const desde = new Date(Date.now() - JANELA_DIAS * 86400_000).toISOString();
  const janela = await sb(
    `price_checks?watch_id=eq.${watch.id}&checked_at=gte.${desde}&select=price&order=price.asc&limit=1`
  );
  const minimo30 = janela[0] != null ? Number(janela[0].price) : null;
  const queda = minimo30 != null ? minimo30 - reading.price : 0;

  if (minimo30 != null) {
    console.log(`  mínimo de ${JANELA_DIAS} dias: ${money(minimo30, reading.currency)} (diferença: ${queda >= 0 ? '-' : '+'}${money(Math.abs(queda), reading.currency)})`);
  } else {
    console.log('  primeira leitura da janela de 30 dias');
  }

  const bateuMeta = minimo30 != null && queda >= QUEDA_MINIMA;

  if (!AVISAR_SEMPRE && !bateuMeta) return null;

  // O cooldown existe para não repetir o mesmo alerta de queda.
  // Com AVISAR_SEMPRE ligado ele não se aplica: o push é um informe de rotina.
  if (!AVISAR_SEMPRE) {
    const since = new Date(Date.now() - COOLDOWN_HOURS * 3600_000).toISOString();
    const recent = await sb(
      `alerts_sent?watch_id=eq.${watch.id}&sent_at=gte.${since}&select=price&order=sent_at.desc&limit=1`
    );
    if (recent.length) {
      const lastAlertPrice = Number(recent[0].price);
      if (reading.price > lastAlertPrice * (1 - REALERT_DROP)) {
        console.log(`  silenciado (avisei ${lastAlertPrice} há menos de ${COOLDOWN_HOURS}h)`);
        return null;
      }
    }
  }

  return {
    reason: bateuMeta ? 'minimo_30d' : 'acompanhamento',
    minimo30,
    queda,
    bateuMeta,
  };
}

async function enviar(payload) {
  const res = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      Authorization: `Key ${ONESIGNAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ app_id: ONESIGNAL_APP_ID, ...payload }),
  });
  if (!res.ok) throw new Error(`OneSignal ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sendPush(watch, reading, veredito) {
  const { minimo30, queda, bateuMeta } = veredito;
  const cur = reading.currency;
  const delta = Math.abs(queda);

  // Preço primeiro: o Android corta o fim do título.
  const marca = bateuMeta ? '↓ ' : '';
  const title = `${marca}${money(reading.price, cur)} · ${watch.label}`;

  let body;
  if (minimo30 == null) {
    body = 'Primeira leitura — começando o histórico de 30 dias.';
  } else if (queda > 0) {
    body = `${money(delta, cur)} abaixo do mínimo de ${JANELA_DIAS} dias (${money(minimo30, cur)}).`;
  } else if (queda === 0) {
    body = `Empatado com o mínimo de ${JANELA_DIAS} dias (${money(minimo30, cur)}).`;
  } else {
    body = `${money(delta, cur)} acima do mínimo de ${JANELA_DIAS} dias (${money(minimo30, cur)}).`;
  }

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    console.log(`  [sem OneSignal configurado] ${title} / ${body}`);
    return false;
  }
  if (DRY_RUN === 'true') {
    console.log(`  [dry run] ${title} / ${body}`);
    return false;
  }

  const comum = {
    headings: { pt: title, en: title },
    contents: { pt: body, en: body },
    url: reading.booking_url ?? undefined,
  };

  // Tenta na ordem: id fixo (se houver), depois os nomes de segmento possiveis.
  const tentativas = [];
  if (ONESIGNAL_SUBSCRIPTION_ID) {
    tentativas.push(['id fixo', { include_subscription_ids: [ONESIGNAL_SUBSCRIPTION_ID] }]);
  }
  tentativas.push(['segmento Subscribed Users', { included_segments: ['Subscribed Users'] }]);
  tentativas.push(['segmento Total Subscriptions', { included_segments: ['Total Subscriptions'] }]);

  for (const [nome, alvo] of tentativas) {
    try {
      const out = await enviar({ ...comum, ...alvo });
      const n = out.recipients ?? 0;
      if (n > 0) {
        console.log(`  push entregue a ${n} aparelho(s) via ${nome}: ${title}`);
        return true;
      }
      console.log(`  ${nome}: 0 destinatarios — ${JSON.stringify(out.errors ?? out)}`);
    } catch (e) {
      console.log(`  ${nome}: ${e.message}`);
    }
  }
  console.log('  NENHUMA tentativa alcancou um aparelho. Confira Audience no painel do OneSignal.');
  return false;
}

// ---------- Orçamento de buscas (SerpApi) ----------
// Cada consulta gasta 1 busca. Para nunca estourar a cota do plano, o script lê o
// saldo real na SerpApi (chamada gratuita) e reparte o que sobrou pelos dias até a renovação.
const DIA_MS = 86400_000;
const RESERVA = Number(process.env.SERPAPI_RESERVA) || 10;          // folga que nunca é gasta
const DIA_RENOVACAO = Number(process.env.SERPAPI_DIA_RENOVACAO) || 1; // dia do mês em que a cota renova
const LIMITE_MENSAL = Number(process.env.SERPAPI_LIMITE) || 200;      // só usado se a SerpApi não informar o saldo

async function saldoSerpApi() {
  try {
    const res = await fetch(`https://serpapi.com/account.json?api_key=${SERPAPI_KEY}`);
    const a = await res.json();
    if (a.error) throw new Error(a.error);
    const left = Number(a.total_searches_left ?? a.plan_searches_left);
    if (!Number.isFinite(left)) throw new Error('resposta sem saldo');
    return left;
  } catch (e) {
    console.log(`Não consegui ler o saldo da SerpApi (${e.message}); usando a contagem local.`);
    return null;
  }
}

async function selecionarHoje(todas) {
  const hoje = new Date();
  const hojeISO = hoje.toISOString().slice(0, 10);
  let ativos = todas.filter((w) => w.outbound_date >= hojeISO);
  if (ativos.length < todas.length) {
    console.log(`${todas.length - ativos.length} rota(s) com data já passada foram ignoradas.`);
  }
  if (!ativos.length) {
    console.log('Nenhuma rota com data futura.');
    process.exit(0);
  }

  let saldo = await saldoSerpApi();
  if (saldo == null) {
    const desde = new Date(Date.now() - 30 * DIA_MS).toISOString();
    const usadas = await sb(`price_checks?source=eq.live&checked_at=gte.${desde}&select=id&limit=1000`);
    saldo = LIMITE_MENSAL - usadas.length;
  }

  const y = hoje.getUTCFullYear(), m = hoje.getUTCMonth(), d = hoje.getUTCDate();
  const hoje0 = Date.UTC(y, m, d);
  let renova = Date.UTC(y, m, DIA_RENOVACAO);
  if (renova <= hoje0) renova = Date.UTC(y, m + 1, DIA_RENOVACAO);
  const diasRestantes = Math.max(1, Math.round((renova - hoje0) / DIA_MS));

  const disponivel = saldo - RESERVA;
  const cotaHoje = Math.max(0, Math.floor(disponivel / diasRestantes));
  console.log(`Saldo: ${saldo} buscas | reserva: ${RESERVA} | dias até renovar: ${diasRestantes} | cota de hoje: ${cotaHoje} | rotas ativas: ${ativos.length}`);

  if (cotaHoje <= 0) {
    console.log(`::warning title=Sem buscas disponíveis::Saldo ${saldo} (reserva ${RESERVA}). Nenhuma consulta feita hoje para não estourar a cota.`);
    process.exit(0);
  }
  if (cotaHoje < ativos.length) {
    // Prioriza as rotas há mais tempo sem leitura
    const ultimas = new Map();
    for (const w of ativos) {
      const r = await sb(`price_checks?watch_id=eq.${w.id}&select=checked_at&order=checked_at.desc&limit=1`);
      ultimas.set(w.id, r[0] ? Date.parse(r[0].checked_at) : 0);
    }
    ativos = [...ativos].sort((a, b) => ultimas.get(a.id) - ultimas.get(b.id)).slice(0, cotaHoje);
    console.log(`Cota menor que o número de rotas: consultando só as ${ativos.length} mais antigas hoje.`);
  }
  return ativos;
}

// ---------- Main ----------

const todas = await sb('watches?active=eq.true&select=*');
if (!todas.length) {
  console.log('Nenhuma rota ativa. Adicione uma linha na tabela watches.');
  process.exit(0);
}
const watches = await selecionarHoje(todas);

let falhas = 0;

for (const watch of watches) {
  console.log(`\n${watch.label} (${watch.departure_id}->${watch.arrival_id} ${watch.outbound_date})`);
  try {
    const reading = await fetchPrice(watch);
    if (!reading) {
      console.log('  sem ofertas retornadas');
      continue;
    }
    console.log(`  ${money(reading.price, reading.currency)} — ${reading.airline ?? 'n/d'} — nível: ${reading.price_level ?? 'n/d'}`);

    const veredito = await shouldAlert(watch, reading);

    await sb('price_checks', {
      method: 'POST',
      body: JSON.stringify({ watch_id: watch.id, ...reading }),
    });

    if (veredito) {
      const entregue = await sendPush(watch, reading, veredito);
      // So marca como avisado se alguem recebeu — senao o cooldown
      // silenciaria o proximo ciclo sem nunca ter avisado ninguem.
      if (entregue && DRY_RUN !== 'true') {
        await sb('alerts_sent', {
          method: 'POST',
          body: JSON.stringify({ watch_id: watch.id, price: reading.price, reason: veredito.reason }),
        });
      }
    }
  } catch (err) {
    falhas++;
    console.error(`  erro: ${err.message}`);
    console.error(`::error title=Falha em ${watch.label}::${String(err.message).slice(0, 300)}`);
  }
}

process.exit(falhas === watches.length ? 1 : 0);
