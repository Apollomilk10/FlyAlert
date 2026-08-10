#!/usr/bin/env node
/**
 * Mede quanto custa o filtro de horário de decolagem.
 * Faz duas buscas por rota — com e sem o filtro — e mostra a diferença.
 * Não grava nada no banco. Roda sob demanda.
 */

const { SERPAPI_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

for (const [k, v] of Object.entries({ SERPAPI_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY })) {
  if (!v) {
    console.error(`Falta a variável ${k}.`);
    process.exit(1);
  }
}

const money = (v, c = 'BRL') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: c }).format(v);

const dur = m => (m == null ? '—' : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`);

const hora = t => {
  if (!t) return '??:??';
  const p = String(t).split(' ')[1];
  return p ? p.slice(0, 5) : '??:??';
};

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

async function buscar(watch, comFiltro) {
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
  if (comFiltro && watch.outbound_times) {
    params.set('outbound_times', watch.outbound_times);
  }

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  const data = await res.json();
  if (data.error) throw new Error(`SerpApi: ${data.error}`);

  const ofertas = [...(data.best_flights ?? []), ...(data.other_flights ?? [])];
  if (!ofertas.length) return null;

  const melhor = ofertas.reduce((a, b) => (b.price < a.price ? b : a));
  const pernas = melhor.flights ?? [];

  return {
    price: melhor.price,
    airlines: [...new Set(pernas.map(f => f.airline).filter(Boolean))].join(' + '),
    duration: melhor.total_duration,
    stops: Math.max(pernas.length - 1, 0),
    saida: hora(pernas[0]?.departure_airport?.time),
    origem: pernas[0]?.departure_airport?.id ?? '?',
    total: ofertas.length,
  };
}

const watches = await sb('watches?active=eq.true&select=*');

for (const w of watches) {
  console.log(`\n=== ${w.label} ===`);
  if (!w.outbound_times) {
    console.log('Essa rota não tem filtro de horário. Nada a comparar.');
    continue;
  }
  const [ini, fim] = w.outbound_times.split(',');
  console.log(`Filtro atual: decolagem entre ${ini}h e ${fim}h\n`);

  const [comFiltro, semFiltro] = await Promise.all([
    buscar(w, true),
    buscar(w, false),
  ]);

  if (!comFiltro || !semFiltro) {
    console.log('Uma das buscas não retornou ofertas.');
    continue;
  }

  const linha = (rot, r) =>
    console.log(
      `${rot.padEnd(12)} ${money(r.price, w.currency).padStart(12)}  ` +
      `${r.airlines || '—'} · ${dur(r.duration)} · ` +
      `${r.stops === 0 ? 'direto' : r.stops + ' parada(s)'} · ` +
      `sai ${r.saida} de ${r.origem} · ${r.total} opções`
    );

  linha('COM filtro', comFiltro);
  linha('SEM filtro', semFiltro);

  const custo = comFiltro.price - semFiltro.price;
  console.log('');
  if (custo <= 0) {
    console.log('O filtro NÃO está custando nada — o voo mais barato já sai cedo.');
  } else {
    const pct = ((custo / semFiltro.price) * 100).toFixed(1);
    console.log(`Exigir decolagem entre ${ini}h e ${fim}h custa ${money(custo, w.currency)} (+${pct}%).`);
    console.log(`A alternativa mais barata sai ${semFiltro.saida}.`);
  }
}
