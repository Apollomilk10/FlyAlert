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

async function shouldAlert(watch, reading) {
  const desde = new Date(Date.now() - JANELA_DIAS * 86400_000).toISOString();
  const janela = await sb(
    `price_checks?watch_id=eq.${watch.id}&checked_at=gte.${desde}&select=price&order=price.asc&limit=1`
  );
  const minimo30 = janela[0] != null ? Number(janela[0].price) : null;

  // Primeira leitura da janela: não há com o que comparar.
  if (minimo30 == null) {
    console.log('  sem histórico nos últimos 30 dias — apenas registrando');
    return null;
  }

  const queda = minimo30 - reading.price;
  console.log(`  mínimo de ${JANELA_DIAS} dias: ${money(minimo30, reading.currency)} (diferença: ${queda >= 0 ? '-' : '+'}${money(Math.abs(queda), reading.currency)})`);

  if (queda < QUEDA_MINIMA) return null;

  // Cooldown: já avisei disso recentemente?
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

  return { reason: 'minimo_30d', minimo30, queda };
}

// ---------- Push ----------

const money = (v, currency) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(v);

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
  const { minimo30, queda } = veredito;
  // Preço primeiro: o Android corta o fim do título.
  const title = `${money(reading.price, reading.currency)} · ${watch.label}`;
  const body = `${money(queda, reading.currency)} abaixo do mínimo dos últimos ${JANELA_DIAS} dias (${money(minimo30, reading.currency)}).`;

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

// ---------- Main ----------

const watches = await sb('watches?active=eq.true&select=*');
if (!watches.length) {
  console.log('Nenhuma rota ativa. Adicione uma linha na tabela watches.');
  process.exit(0);
}

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
  }
}

process.exit(falhas === watches.length ? 1 : 0);
