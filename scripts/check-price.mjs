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
  DRY_RUN,
} = process.env;

const COOLDOWN_HOURS = 20;   // não repete alerta antes disso
const REALERT_DROP = 0.05;   // ...a menos que caia mais 5% do último alerta

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
    raw: { insights, flights: cheapest.flights ?? [] },
  };
}

// ---------- Decisão: isso é uma barganha? ----------

async function shouldAlert(watch, reading) {
  const reasons = [];

  if (watch.target_price != null && reading.price <= Number(watch.target_price)) {
    reasons.push('target');
  }
  if (reading.typical_low != null && reading.price < Number(reading.typical_low)) {
    reasons.push('below_typical');
  }

  const history = await sb(
    `price_checks?watch_id=eq.${watch.id}&select=price&order=price.asc&limit=1`
  );
  const previousLow = history[0]?.price;
  if (previousLow != null && reading.price < Number(previousLow)) {
    reasons.push('all_time_low');
  }

  if (!reasons.length) return null;

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

  return reasons[0];
}

// ---------- Push ----------

const money = (v, currency) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(v);

const REASON_TEXT = {
  target: 'Bateu o seu teto',
  below_typical: 'Abaixo da faixa normal',
  all_time_low: 'Menor preço já visto',
};

async function sendPush(watch, reading, reason) {
  const title = `${watch.label} — ${money(reading.price, reading.currency)}`;
  const body = reading.typical_low
    ? `${REASON_TEXT[reason]}. Normal fica entre ${money(reading.typical_low, reading.currency)} e ${money(reading.typical_high, reading.currency)}.`
    : REASON_TEXT[reason];

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    console.log(`  [sem OneSignal configurado] ${title} / ${body}`);
    return;
  }
  if (DRY_RUN === 'true') {
    console.log(`  [dry run] ${title} / ${body}`);
    return;
  }

  const res = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      Authorization: `Key ${ONESIGNAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      included_segments: ['Subscribed Users'],
      headings: { pt: title, en: title },
      contents: { pt: body, en: body },
      url: reading.booking_url ?? undefined,
    }),
  });
  if (!res.ok) throw new Error(`OneSignal ${res.status}: ${await res.text()}`);
  console.log(`  push enviado: ${title}`);
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

    const reason = await shouldAlert(watch, reading);

    await sb('price_checks', {
      method: 'POST',
      body: JSON.stringify({ watch_id: watch.id, ...reading }),
    });

    if (reason) {
      await sendPush(watch, reading, reason);
      if (DRY_RUN !== 'true') {
        await sb('alerts_sent', {
          method: 'POST',
          body: JSON.stringify({ watch_id: watch.id, price: reading.price, reason }),
        });
      }
    }
  } catch (err) {
    falhas++;
    console.error(`  erro: ${err.message}`);
  }
}

process.exit(falhas === watches.length ? 1 : 0);
