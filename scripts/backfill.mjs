#!/usr/bin/env node
/**
 * Importa o histórico de preços que o Google Flights devolve dentro de
 * price_insights.price_history — normalmente uns 60 dias da rota.
 *
 * Roda sob demanda (workflow_dispatch), não no cron.
 *
 * O bloco price_insights costuma sumir quando a busca tem vários aeroportos
 * de origem. Por isso aqui a consulta é feita com UM aeroporto por vez, e o
 * menor preço de cada dia entre eles é o que fica.
 */

const { SERPAPI_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, DRY_RUN } = process.env;

for (const [k, v] of Object.entries({ SERPAPI_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY })) {
  if (!v) {
    console.error(`Falta a variável ${k}.`);
    process.exit(1);
  }
}

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

async function historico(watch, aeroporto) {
  const params = new URLSearchParams({
    engine: 'google_flights',
    departure_id: aeroporto,
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

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  const data = await res.json();
  if (data.error) throw new Error(`SerpApi: ${data.error}`);

  const insights = data.price_insights;
  if (!insights) {
    console.log(`  ${aeroporto}: sem price_insights na resposta`);
    return [];
  }
  const serie = insights.price_history;
  if (!Array.isArray(serie) || !serie.length) {
    console.log(`  ${aeroporto}: price_insights veio, mas sem price_history`);
    return [];
  }

  // Formato: [[timestamp_unix, preco], ...]
  const pontos = serie
    .filter(p => Array.isArray(p) && p.length >= 2 && p[1] > 0)
    .map(([ts, preco]) => ({
      checked_at: new Date(ts * 1000).toISOString(),
      price: preco,
    }));

  console.log(`  ${aeroporto}: ${pontos.length} pontos históricos`);
  return pontos;
}

const watches = await sb('watches?active=eq.true&select=*');

for (const watch of watches) {
  console.log(`\n${watch.label}`);

  const aeroportos = watch.departure_id.split(',').map(s => s.trim());
  const porDia = new Map();

  for (const ap of aeroportos) {
    try {
      for (const p of await historico(watch, ap)) {
        const dia = p.checked_at.slice(0, 10);
        const atual = porDia.get(dia);
        // Mantém o menor preço do dia entre os aeroportos consultados.
        if (!atual || p.price < atual.price) porDia.set(dia, p);
      }
    } catch (e) {
      console.error(`  ${ap}: ${e.message}`);
    }
  }

  if (!porDia.size) {
    console.log('  nada para importar');
    continue;
  }

  // Não duplica dias que já existem como histórico importado.
  const jaTem = await sb(
    `price_checks?watch_id=eq.${watch.id}&source=eq.google_history&select=checked_at`
  );
  const conhecidos = new Set(jaTem.map(r => r.checked_at.slice(0, 10)));

  const novos = [...porDia.entries()]
    .filter(([dia]) => !conhecidos.has(dia))
    .map(([, p]) => ({
      watch_id: watch.id,
      price: p.price,
      currency: watch.currency,
      checked_at: p.checked_at,
      source: 'google_history',
    }));

  console.log(`  ${porDia.size} dias no histórico, ${novos.length} novos`);

  if (!novos.length) continue;
  if (DRY_RUN === 'true') {
    console.log('  [dry run] nada gravado');
    continue;
  }

  await sb('price_checks', { method: 'POST', body: JSON.stringify(novos) });
  console.log(`  ${novos.length} pontos importados`);
}
