/* Fly Alert — painel de preços (só ida): o preço de agora está barato ou caro em relação ao histórico? */

const SUPABASE_URL = 'https://qnxyjzmqubzdkouvzewq.supabase.co';
const SUPABASE_ANON = 'sb_publishable_glj1x8t-y-vGdhozSBW84Q_rLRlkdbk';
const ONESIGNAL_APP_ID = '11593a31-7feb-45b9-aad9-5d1eb46bf1c7';

/* ---------------- helpers ---------------- */

const $ = (id) => document.getElementById(id);
const brl = (v, c = 'BRL') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(Number(v) || 0);
const num = (v) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(v));
const D = (d) => new Date(`${d}T12:00:00`);
const diaMes = (d) => D(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
const dataLonga = (d) => D(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
const hhmm = (t) => (t ? String(t).split(' ')[1]?.slice(0, 5) ?? '' : '');
const durStr = (m) => (m == null ? '—' : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min`);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtQuando = (d) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');

const CIDADES = {
  GRU: 'São Paulo', CGH: 'São Paulo', VCP: 'Campinas', SSA: 'Salvador',
  GIG: 'Rio de Janeiro', SDU: 'Rio de Janeiro', BSB: 'Brasília', CNF: 'Belo Horizonte',
  REC: 'Recife', FOR: 'Fortaleza', POA: 'Porto Alegre', CWB: 'Curitiba',
  LIS: 'Lisboa', MCO: 'Orlando', EZE: 'Buenos Aires', SCL: 'Santiago', MIA: 'Miami',
};
const cidade = (ids) => {
  const lista = String(ids).split(',').map((s) => s.trim());
  const nomes = [...new Set(lista.map((c) => CIDADES[c] || c))];
  if (nomes.length === 1) return nomes[0];
  if (nomes.every((n) => n === 'São Paulo' || n === 'Campinas')) return 'São Paulo';
  return nomes[0];
};
const rota = (w) => `${cidade(w.departure_id)} → ${cidade(w.arrival_id)}`;
const sigla = (ids) => String(ids).split(',')[0].trim();
const faixaTxt = (w) => (w.outbound_times ? `partida ${w.outbound_times.replace(',', 'h–')}h` : 'qualquer horário');

const linkGoogleFlights = (w) => {
  const q = [
    `Flights from ${sigla(w.departure_id)} to ${sigla(w.arrival_id)}`,
    `on ${w.outbound_date}`, 'oneway',
    (w.adults || 1) > 1 ? `${w.adults} adults` : '',
  ].filter(Boolean).join(' ');
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&curr=BRL&hl=pt-BR&gl=BR`;
};

// Skyscanner (só ida). Vários aeroportos da mesma cidade viram o código da cidade.
const skyId = (ids) => {
  const l = String(ids).split(',').map((s) => s.trim().toUpperCase());
  if (l.length > 1 && l.every((c) => ['GRU', 'CGH', 'VCP'].includes(c))) return 'sao';
  if (l.length > 1 && l.every((c) => ['GIG', 'SDU'].includes(c))) return 'rio';
  return l[0].toLowerCase();
};
const linkSkyscanner = (w) => {
  const [a, m, d] = w.outbound_date.split('-');
  return `https://www.skyscanner.com.br/transporte/passagens-aereas/${skyId(w.departure_id)}/${skyId(w.arrival_id)}/${a.slice(2)}${m}${d}/?adultsv2=${w.adults || 1}&cabinclass=economy&rtn=0`;
};

const GRADS = [
  ['#1D6FE8', '#0B2447'], ['#2E9AD6', '#12467B'], ['#3AA680', '#0E3B57'],
  ['#C97A05', '#7A3B12'], ['#7A5AD6', '#1B2A6B'], ['#D65A7A', '#5B1B45'],
];
const grad = (w) => {
  const k = [...String(w.id)].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADS.length;
  const [a, b] = GRADS[k];
  return `linear-gradient(135deg,${a},${b})`;
};

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
  bell: 'M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M13.7 20a2 2 0 0 1-3.4 0',
  plane: 'M21 15.5 13 11V5a1.5 1.5 0 0 0-3 0v6l-8 4.5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-3l8 2.5z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  plus: 'M12 5v14M5 12h14',
  right: 'm9 18 6-6-6-6',
  left: 'm15 18-6-6 6-6',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 16v-5M12 8h.01',
  check: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M8.5 12.5l2.5 2.5 4.5-5',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  users: 'M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.8',
  cal2: 'M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
};
const ic = (n, size = 20, cls = '') =>
  `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;

/* ---------------- estado ---------------- */

const S = {
  watches: [],
  checks: {},      // watch_id -> [{t, v, live}] em ordem cronológica (histórico completo)
  ofertas: {},     // watch_id -> {offers, checked_at} da última leitura real
  alertas: [],     // alerts_sent (carregado só ao abrir Ajustes)
  alertasOk: false,
  carregado: false,
  erro: null,
  view: { tabAlertas: 'ativos', janela: 'tudo' },
};

/* ---------------- API ---------------- */

async function api(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      ...(options.body ? { Prefer: 'return=representation' } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// Economia de requisições: o histórico vem leve (sem o JSON de ofertas) e as ofertas
// só da última leitura real de cada trajeto, em uma segunda chamada.
async function carregar() {
  const watches = (await api('watches?select=*&order=outbound_date.asc'))
    .filter((w) => w.trip_type === 2 && !w.return_date);
  const ids = watches.map((w) => `"${w.id}"`).join(',');
  const linhas = ids
    ? await api(`price_checks?watch_id=in.(${ids})&select=id,watch_id,price,source,checked_at&order=checked_at.desc&limit=1000`)
    : [];
  linhas.reverse();

  const checks = {}, ultimoReal = {};
  for (const c of linhas) {
    const real = c.source !== 'google_history';
    (checks[c.watch_id] ||= []).push({ t: Date.parse(c.checked_at), v: Number(c.price), live: real });
    if (real) ultimoReal[c.watch_id] = c;
  }

  const idsReais = Object.values(ultimoReal).map((c) => `"${c.id}"`).join(',');
  const ofertas = {};
  if (idsReais) {
    for (const r of await api(`price_checks?id=in.(${idsReais})&select=watch_id,offers,checked_at`)) ofertas[r.watch_id] = r;
  }

  S.watches = watches;
  S.checks = checks;
  S.ofertas = ofertas;
  S.carregado = true;
}

async function carregarAlertas() {
  try {
    S.alertas = await api('alerts_sent?select=*&order=sent_at.desc&limit=8');
  } catch { S.alertas = []; }
  S.alertasOk = true;
}

/* ---------------- análise: barato ou caro vs. histórico ---------------- */

const DIA = 86400000;

function analise(w) {
  const pts = S.checks[w.id] || [];
  if (!pts.length) return null;
  const vals = pts.map((p) => p.v);
  const n = vals.length;
  const atual = vals[n - 1];
  const media = vals.reduce((a, b) => a + b, 0) / n;
  const min = Math.min(...vals), max = Math.max(...vals);
  const maisBaratoQue = Math.round((100 * vals.filter((v) => v > atual).length) / n);
  const vsMedia = media ? Math.round(((atual - media) / media) * 100) : 0;
  const ref = [...pts].reverse().find((p) => p.t <= Date.now() - 7 * DIA);
  const delta7 = ref ? atual - ref.v : null;

  let nivel;
  if (n < 8) nivel = 'poucos';
  else if (max - min < media * 0.05) nivel = 'estavel';
  else if (maisBaratoQue >= 75) nivel = 'barato';
  else if (maisBaratoQue <= 25) nivel = 'caro';
  else nivel = 'media';

  const pos = max > min ? Math.min(100, Math.max(0, ((atual - min) / (max - min)) * 100)) : 50;
  const vezes = pts.filter((p) => p.live).length;
  return { n, vezes, atual, media, min, max, maisBaratoQue, vsMedia, delta7, nivel, pos, primeiro: pts[0].t };
}

const VD = {
  barato: ['Barato agora', 'barato'], media: ['Na média', 'media'], caro: ['Caro agora', 'caro'],
  estavel: ['Preço estável', 'media'], poucos: ['Poucos dados', 'poucos'],
};
const vdBadge = (a) => (a
  ? `<span class="vd ${VD[a.nivel][1]}">${VD[a.nivel][0]}</span>`
  : '<span class="vd poucos">Sem dados</span>');

function frasesAnalise(a, w) {
  const out = [];
  if (a.nivel === 'poucos') {
    out.push(`Só ${a.n} leitura${a.n > 1 ? 's' : ''} no histórico: o veredito ainda é provisório.`);
  } else {
    out.push(`Mais barato que ${a.maisBaratoQue}% das ${a.n} leituras do histórico.`);
  }
  if (a.atual <= a.min && a.n > 1) out.push('É o menor preço já registrado.');
  else if (a.vsMedia !== 0) out.push(`${Math.abs(a.vsMedia)}% ${a.vsMedia < 0 ? 'abaixo' : 'acima'} da média (${brl(a.media, w.currency)}).`);
  else out.push(`Igual à média (${brl(a.media, w.currency)}).`);
  if (a.delta7 != null) {
    out.push(Math.abs(a.delta7) < 10 ? 'Estável nos últimos 7 dias.' : `Nos últimos 7 dias: ${a.delta7 < 0 ? '↓' : '↑'} ${brl(Math.abs(a.delta7), w.currency)}.`);
  }
  return out;
}

const faixaPreco = (a, w) => `
  <div class="faixa"><i style="left:${a.pos.toFixed(1)}%"></i></div>
  <div class="vlab"><span>mín ${brl(a.min, w.currency)}</span><span>média ${brl(a.media, w.currency)}</span><span>máx ${brl(a.max, w.currency)}</span></div>`;

/* ---------------- frequência de atualização ---------------- */

// O robô (.github/workflows/check-price.yml) roda todo dia às 06h17 de Brasília (09:17 UTC),
// mas só consulta cada trajeto conforme a proximidade da viagem — é o que economiza buscas:
// mais de 90 dias → a cada 3 dias · de 30 a 90 → a cada 2 · menos de 30 → todo dia.
const ATUALIZA_UTC = [9, 17];
const BUSCAS_MES = 250, RESERVA_BUSCAS = 10; // plano gratuito da SerpApi
const intervaloDias = (w) => {
  const dias = Math.round((D(w.outbound_date) - Date.now()) / DIA);
  return dias > 90 ? 3 : dias > 30 ? 2 : 1;
};
const ultimaReal = (w) => {
  const p = [...(S.checks[w.id] || [])].reverse().find((x) => x.live);
  return p ? p.t : null;
};
function proximaConsulta(w) {
  const ult = ultimaReal(w);
  const t = Math.max(Date.now(), ult ? ult + (intervaloDias(w) * 24 - 3) * 3600000 : 0);
  const d = new Date(t);
  let c = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), ATUALIZA_UTC[0], ATUALIZA_UTC[1]);
  if (c < t) c += DIA;
  return c;
}
function resumoAtualizacao() {
  const ativos = S.watches.filter((w) => w.active && w.outbound_date >= new Date().toISOString().slice(0, 10));
  const ultima = Math.max(0, ...ativos.map((w) => ultimaReal(w) || 0));
  const proxima = ativos.length ? Math.min(...ativos.map(proximaConsulta)) : null;
  const buscasMes = Math.round(ativos.reduce((s, w) => s + 30 / intervaloDias(w), 0));
  return { ativos, ultima: ultima || null, proxima, buscasMes };
}

/* ---------------- gráfico ---------------- */

const JANELAS = [[30, '30d'], [60, '60d'], [90, '90d'], ['tudo', 'Tudo']];
const CORES_MEDIA = { 30: '#15A05A', 60: '#C97A05', 90: '#7A5AD6' };

const dentro = (pts, j) => {
  if (j === 'tudo') return pts;
  const agora = Date.now();
  return pts.filter((d) => agora - d.t <= Number(j) * DIA);
};

const filtroJanela = () => `<div class="tabs light seg">${JANELAS.map(([v, t]) =>
  `<button class="${String(S.view.janela) === String(v) ? 'on' : ''}" data-janela="${v}">${t}</button>`).join('')}</div>`;

function chart(todos, { janela = 'tudo' } = {}) {
  if (!todos || todos.length < 2) return `<p class="muted small">Ainda sem histórico suficiente para o gráfico.</p>`;
  const pts = dentro(todos, janela);
  if (pts.length < 2) {
    return `<p class="muted small">Só ${pts.length} leitura nos últimos ${janela} dias. Escolha um período maior.</p>`;
  }
  const W = 360, H = 200, PL = 46, PR = 44, PT = 16, PB = 24;

  // reamostra para no máximo 26 pontos, mantendo o primeiro e o último
  const passo = Math.max(1, Math.ceil(pts.length / 26));
  const p = pts.filter((_, i) => i % passo === 0);
  if (p[p.length - 1] !== pts[pts.length - 1]) p.push(pts[pts.length - 1]);

  const vals = p.map((d) => d.v);

  // Só entram as janelas que cabem no período filtrado, e cada uma precisa
  // trazer leitura que a anterior não tinha — senão vira linha duplicada.
  const teto = janela === 'tudo' ? 90 : Number(janela);
  const medias = [];
  let antes = 0;
  for (const [dias, cor] of Object.entries(CORES_MEDIA)) {
    if (Number(dias) > teto) continue;
    const j = dentro(todos, Number(dias));
    if (j.length < 2 || j.length === antes) continue;
    antes = j.length;
    medias.push({ dias: Number(dias), cor, v: j.reduce((a, d) => a + d.v, 0) / j.length });
  }

  const extremos = [...vals, ...medias.map((m) => m.v)];
  const lo = Math.min(...extremos), hi = Math.max(...extremos);
  const pad = (hi - lo) * 0.18 || Math.max(60, lo * 0.05);
  const y0 = lo - pad, y1 = hi + pad;
  const t0 = p[0].t, t1 = p[p.length - 1].t;

  const X = (t) => (t1 === t0 ? PL : PL + ((t - t0) / (t1 - t0)) * (W - PL - PR));
  const Y = (v) => PT + (1 - (v - y0) / (y1 - y0)) * (H - PT - PB);

  let grade = '';
  for (let i = 0; i <= 3; i++) {
    const v = y0 + ((y1 - y0) / 3) * i;
    const y = Y(v).toFixed(1);
    grade += `<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="#E6ECF4" stroke-width="1"/>
      <text x="${PL - 8}" y="${Number(y) + 3.5}" text-anchor="end" font-size="9.5" fill="#8A99AD">R$ ${num(v)}</text>`;
  }
  const linha = p.map((d, i) => `${i ? 'L' : 'M'}${X(d.t).toFixed(1)},${Y(d.v).toFixed(1)}`).join(' ');
  const area = `${linha} L${X(t1).toFixed(1)},${H - PB} L${PL},${H - PB} Z`;
  const pontos = p.map((d) => `<circle cx="${X(d.t).toFixed(1)}" cy="${Y(d.v).toFixed(1)}" r="3" fill="#fff" stroke="#1D6FE8" stroke-width="2"/>`).join('');

  const marcas = [0, 1, 2, 3].map((i) => p[Math.round((p.length - 1) * (i / 3))]);
  const datas = [...new Set(marcas)].map((d) =>
    `<text x="${X(d.t).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="9.5" fill="#8A99AD">${new Date(d.t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</text>`
  ).join('');

  const linhasMedia = medias.map((m) => `
    <line x1="${PL}" y1="${Y(m.v).toFixed(1)}" x2="${W - PR}" y2="${Y(m.v).toFixed(1)}"
      stroke="${m.cor}" stroke-width="1.3" stroke-dasharray="6 4" opacity=".9"/>
    <text x="${W - PR + 5}" y="${(Y(m.v) + 3.5).toFixed(1)}" font-size="9"
      font-weight="700" fill="${m.cor}">${m.dias}d</text>`).join('');

  const fim = p[p.length - 1];
  const bx = Math.min(X(fim.t) + 6, W - PR - 4), by = Math.max(Y(fim.v) - 12, PT);
  const rotulo = `<g><rect x="${bx}" y="${by - 10}" width="62" height="21" rx="6" fill="#1D6FE8"/>
    <text x="${bx + 31}" y="${by + 4.5}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff">${brl(fim.v)}</text></g>`;

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Histórico de preços">
    <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1D6FE8" stop-opacity=".16"/><stop offset="1" stop-color="#1D6FE8" stop-opacity="0"/>
    </linearGradient></defs>
    ${grade}
    <path d="${area}" fill="url(#g1)"/>
    ${linhasMedia}
    <path d="${linha}" fill="none" stroke="#1D6FE8" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    ${pontos}${datas}${rotulo}
  </svg>
  ${medias.length ? `<div class="legend">${medias.map((m) =>
    `<span><i style="background:${m.cor}"></i>Média ${m.dias}d · ${brl(m.v)}</span>`).join('')}</div>` : ''}`;
}

/* ---------------- componentes ---------------- */

function topbar(titulo, { voltar = null, acao = '' } = {}) {
  return `<div class="topbar">
    ${voltar ? `<button class="iconbtn" data-go="${voltar}" aria-label="Voltar">${ic('left', 22)}</button>` : ''}
    <h1>${esc(titulo)}</h1><div class="spacer"></div>${acao}
  </div>`;
}

// Card do painel: o veredito vem primeiro, depois a comparação com o histórico.
function cardVeredito(w) {
  const a = analise(w);
  return `<button class="vcard" data-go="#/alerta/${w.id}">
    <div class="vtop"><b>${esc(rota(w))}</b>${vdBadge(a)}</div>
    <small class="muted">${dataLonga(w.outbound_date)} · ${faixaTxt(w)}</small>
    ${a ? `<div class="vprice">${brl(a.atual, w.currency)}</div>
      ${faixaPreco(a, w)}
      <div class="vtxt">${frasesAnalise(a, w).slice(0, 2).join(' ')}</div>`
      : `<div class="vtxt" style="margin-top:10px">Ainda sem leituras. A primeira chega na próxima consulta.</div>`}
  </button>`;
}

function linhaAlerta(w) {
  const a = analise(w);
  return `<div class="row">
    <button class="thumb" style="background:${grad(w)}" data-go="#/alerta/${w.id}" aria-label="Abrir alerta">
      ${sigla(w.departure_id)}→${sigla(w.arrival_id)}
    </button>
    <button class="info" data-go="#/alerta/${w.id}">
      <b>${esc(rota(w))}</b>
      <small class="datas">${dataLonga(w.outbound_date)} · ${faixaTxt(w)}</small>
      <span class="price">${a ? brl(a.atual, w.currency) : '—'} ${vdBadge(a)}</span>
    </button>
    <div class="switch ${w.active ? 'on' : ''}" data-toggle="${w.id}" role="switch" aria-checked="${w.active}" tabindex="0"></div>
  </div>`;
}

/* ---------------- telas ---------------- */

function telaHome() {
  const r = resumoAtualizacao();
  const itens = r.ativos.map((w) => ({ w, a: analise(w) }));
  const baratos = itens.filter((x) => x.a?.nivel === 'barato');
  const caros = itens.filter((x) => x.a?.nivel === 'caro');

  let manchete = 'Nenhum trajeto ativo.', sub = 'Toque no + para criar o primeiro alerta.';
  if (itens.length) {
    if (baratos.length) {
      const melhor = [...baratos].sort((x, y) => x.a.vsMedia - y.a.vsMedia)[0];
      manchete = `${baratos.length} de ${itens.length} trajeto${itens.length > 1 ? 's' : ''} barato${baratos.length > 1 ? 's' : ''} agora`;
      sub = `Melhor momento: ${rota(melhor.w)} · ${dataLonga(melhor.w.outbound_date)} por ${brl(melhor.a.atual, melhor.w.currency)}.`;
    } else {
      manchete = 'Nenhum trajeto está barato agora';
      sub = caros.length
        ? `${caros.length} está${caros.length > 1 ? 'ão' : ''} entre os preços mais altos do histórico. Os outros estão na média.`
        : 'Todos estão na média do histórico (ou ainda com poucos dados).';
    }
  }

  return `
  ${topbar('Painel')}
  <div class="wrap">
    <div class="card resumo ${baratos.length ? 'bom' : ''}">
      <h2>${manchete}</h2>
      <p>${sub}</p>
      <small>${r.ultima ? `Atualizado em ${fmtQuando(r.ultima)}` : 'Sem leituras ainda'}${r.proxima ? ` · próxima ~${fmtQuando(r.proxima)}` : ''}</small>
    </div>
    ${itens.length ? itens.map(({ w }) => cardVeredito(w)).join('')
      : `<div class="empty">Nenhum alerta ativo ainda.</div>`}
  </div>`;
}

function telaAlertas() {
  const ativos = S.watches.filter((w) => w.active);
  const inativos = S.watches.filter((w) => !w.active);
  const lista = S.view.tabAlertas === 'ativos' ? ativos : inativos;
  return `
  ${topbar('Meus Alertas', { acao: `<button class="iconbtn blue" data-go="#/novo" aria-label="Novo alerta">${ic('plus', 24)}</button>` })}
  <div class="tabs light">
    <button class="${S.view.tabAlertas === 'ativos' ? 'on' : ''}" data-tab="ativos">Ativos (${ativos.length})</button>
    <button class="${S.view.tabAlertas === 'inativos' ? 'on' : ''}" data-tab="inativos">Pausados (${inativos.length})</button>
  </div>
  <div class="wrap" style="margin-top:14px">
    ${lista.length ? `<div class="rows">${lista.map(linhaAlerta).join('')}</div>`
      : `<div class="empty" style="margin:0">Nenhum alerta ${S.view.tabAlertas === 'ativos' ? 'ativo' : 'pausado'} no momento.</div>`}
  </div>`;
}

function telaAlerta(id) {
  const w = S.watches.find((x) => x.id === id);
  if (!w) return `${topbar('Alerta', { voltar: '#/home' })}<div class="error">Alerta não encontrado.</div>`;
  const a = analise(w);
  const pts = S.checks[w.id] || [];
  const of = S.ofertas[w.id];
  const ofertas = (Array.isArray(of?.offers) ? [...of.offers] : [])
    .filter((o) => o.departure)
    .sort((x, y) => String(x.departure).localeCompare(String(y.departure)));
  const barato = ofertas.length ? ofertas.reduce((x, y) => (y.price < x.price ? y : x)) : null;
  const dias = a ? Math.max(1, Math.round((Date.now() - a.primeiro) / DIA)) : 0;

  const linhasOfertas = ofertas.map((o) => `
    <div class="row" style="padding:10px 0">
      <div class="info">
        <b>${hhmm(o.departure) || '--:--'} → ${hhmm(o.arrival) || '--:--'}${o === barato ? ' <span class="badge">mais barato</span>' : ''}</b>
        <small>${esc(o.departure_id || sigla(w.departure_id))} → ${esc(sigla(w.arrival_id))} · ${o.stops === 0 ? 'Direto' : `${o.stops} escala${o.stops > 1 ? 's' : ''}`} · ${durStr(o.duration_min)}</small>
        <small>${esc((o.airlines || []).join(' + ') || '—')}</small>
      </div>
      <b style="font-size:14.5px">${brl(o.price, w.currency)}</b>
    </div>`).join('');

  return `
  ${topbar(rota(w), { voltar: '#/home' })}
  <div class="wrap">
    <div class="card">
      <div class="vtop"><span class="muted small">${dataLonga(w.outbound_date)} · ${faixaTxt(w)} · ${w.adults || 1} pessoa${(w.adults || 1) > 1 ? 's' : ''}</span>${vdBadge(a)}</div>
      ${a ? `<div class="vprice big">${brl(a.atual, w.currency)}</div>
        ${faixaPreco(a, w)}
        <ul class="frases">${frasesAnalise(a, w).map((f) => `<li>${f}</li>`).join('')}</ul>`
        : `<p class="muted small" style="margin-top:10px">Ainda sem leituras para este trajeto.</p>`}
    </div>

    ${a ? `<div class="tiles" style="padding:12px 0 0;gap:10px">
      <div class="tile"><div><b>${brl(a.media, w.currency)}</b><small>Média histórica</small></div></div>
      <div class="tile"><div><b>${brl(a.min, w.currency)}</b><small>Menor preço</small></div></div>
      <div class="tile"><div><b>${brl(a.max, w.currency)}</b><small>Maior preço</small></div></div>
      <div class="tile"><div><b>${a.n}</b><small>Leituras · ${dias} dias</small></div></div>
    </div>` : ''}

    <div class="card" style="margin-top:12px">
      <b style="font-size:15px">Histórico de preços</b>
      ${filtroJanela()}
      ${chart(pts, { janela: S.view.janela })}
    </div>

    <div class="card" style="margin-top:12px">
      <b style="font-size:15px">Horários encontrados</b>
      ${ofertas.length
        ? `<div style="margin-top:6px">${linhasOfertas}</div>
           <div class="muted small" style="margin-top:8px">Atualizado em ${fmtQuando(of.checked_at)} · são as opções mais baratas da consulta, não todos os voos do dia.</div>`
        : `<div class="muted small" style="margin-top:8px">Ainda sem horários salvos. Eles aparecem após a próxima consulta.</div>`}
    </div>

    <div style="display:flex;gap:10px;margin-top:14px">
      <a class="btn" style="flex:1;text-align:center" href="${linkGoogleFlights(w)}" target="_blank" rel="noopener noreferrer">Google Flights</a>
      <a class="btn" style="flex:1;text-align:center" href="${linkSkyscanner(w)}" target="_blank" rel="noopener noreferrer">Skyscanner</a>
    </div>

    <div class="card" style="margin-top:12px;display:flex;align-items:center;gap:12px">
      <div style="flex:1">
        <b style="font-size:15px">Alerta ${w.active ? 'ativo' : 'pausado'}</b>
        <div class="muted small">Consulta a cada ${intervaloDias(w)} dia${intervaloDias(w) > 1 ? 's' : ''} (viagem ${intervaloDias(w) > 1 ? 'ainda distante' : 'próxima'})${w.target_price ? ` · avisa até ${brl(w.target_price, w.currency)}` : ''}</div>
      </div>
      <div class="switch ${w.active ? 'on' : ''}" data-toggle="${w.id}" role="switch" aria-checked="${w.active}" tabindex="0"></div>
    </div>
  </div>`;
}

function telaNovo() {
  const opcoes = [
    ['GRU,CGH,VCP', 'São Paulo (GRU/CGH/VCP)'], ['GRU', 'São Paulo (GRU)'], ['CGH', 'São Paulo (CGH)'],
    ['VCP', 'Campinas (VCP)'], ['SSA', 'Salvador (SSA)'], ['GIG,SDU', 'Rio de Janeiro (GIG/SDU)'],
    ['BSB', 'Brasília (BSB)'], ['REC', 'Recife (REC)'], ['CNF', 'Belo Horizonte (CNF)'], ['FOR', 'Fortaleza (FOR)'],
  ];
  const sel = (nome, valor) => `<select id="${nome}">${opcoes.map(([v, t]) =>
    `<option value="${v}" ${v === valor ? 'selected' : ''}>${t}</option>`).join('')}</select>`;

  return `
  ${topbar('Novo alerta', { voltar: '#/alertas' })}
  <div class="wrap">
    <div class="field"><label>Origem</label>
      <div class="control"><span class="ic">${ic('plane', 18)}</span>${sel('f-origem', 'GRU,CGH,VCP')}<span class="chev">${ic('right', 16)}</span></div></div>

    <div class="field"><label>Destino</label>
      <div class="control"><span class="ic">${ic('pin', 18)}</span>${sel('f-destino', 'SSA')}<span class="chev">${ic('right', 16)}</span></div></div>

    <div class="field"><label>Data do voo (só ida)</label>
      <div class="control"><span class="ic">${ic('calendar', 18)}</span><input type="date" id="f-ida" value="2026-12-26"></div></div>

    <div class="field"><label>Horário de partida</label>
      <div class="control"><span class="ic">${ic('clock', 18)}</span>
        <select id="f-janela">
          <option value="">Qualquer horário</option>
          <option value="5,12">Manhã (05h–12h)</option>
          <option value="12,18">Tarde (12h–18h)</option>
          <option value="18,23">Noite (18h–23h)</option>
          <option value="0,5">Madrugada (00h–05h)</option>
        </select></div></div>

    <div class="field"><label>Passageiros</label>
      <div class="control"><span class="ic">${ic('users', 18)}</span>
        <span style="flex:1;font-weight:600"><span id="f-pax-txt">1 adulto</span></span>
        <span class="stepper"><button data-pax="-1" aria-label="Menos">−</button><button data-pax="1" aria-label="Mais">+</button></span>
      </div></div>

    <div class="field"><label>Preço desejado (opcional)</label>
      <div class="control"><span style="font-weight:700;color:var(--muted)">R$</span>
        <input type="number" id="f-teto" placeholder="2.000" inputmode="numeric"></div>
      <div class="hint">Vamos te avisar quando o preço ficar igual ou menor.</div></div>

    <button class="btn" id="btn-criar" style="margin:20px 0 8px">Criar alerta</button>
    <p class="hint" style="text-align:center">O robô consulta 1x por dia perto da viagem e a cada 2–3 dias quando ela ainda está longe, para economizar buscas.</p>
  </div>`;
}

function telaAjustes() {
  const ativo = typeof Notification !== 'undefined' && Notification.permission === 'granted';
  const r = resumoAtualizacao();
  const maxAlertas = Math.floor((BUSCAS_MES - RESERVA_BUSCAS) / 30);

  const recentes = S.alertas.map((al) => {
    const w = S.watches.find((x) => x.id === al.watch_id);
    if (!w) return '';
    const horas = Math.round((Date.now() - new Date(al.sent_at)) / 3600000);
    const quando = horas < 24 ? `${horas}h atrás` : `${Math.round(horas / 24)} dia${horas >= 48 ? 's' : ''} atrás`;
    const motivo = { target: 'Atingiu seu teto', below_typical: 'Abaixo da faixa normal', all_time_low: 'Menor preço já visto' }[al.reason] || 'Preço caiu';
    return `<div class="row">
      <span class="thumb" style="background:${grad(w)}">${sigla(w.departure_id)}→${sigla(w.arrival_id)}</span>
      <button class="info" data-go="#/alerta/${w.id}">
        <b>${esc(rota(w))}</b>
        <small style="color:var(--green);font-weight:600">${motivo}</small>
        <span class="price">${brl(al.price, w.currency)} <span class="muted small" style="font-weight:500">· ${quando}</span></span>
      </button>
      <span class="chev">${ic('right', 18)}</span>
    </div>`;
  }).join('');

  return `
  ${topbar('Ajustes')}
  <div class="wrap">
    <div class="card" style="display:flex;align-items:center;gap:12px">
      <div style="flex:1">
        <b style="font-size:15px">Notificações</b>
        <div class="muted small" id="push-status">Receba um aviso quando o preço cair.</div>
      </div>
      <div class="switch ${ativo ? 'on' : ''}" id="push-switch" role="switch" aria-checked="${ativo}" tabindex="0"></div>
    </div>

    <div class="card" style="margin-top:12px">
      <b style="font-size:15px">Atualização dos dados</b>
      <div class="row" style="padding:9px 0"><span class="info"><b>Última atualização</b></span><span>${r.ultima ? fmtQuando(r.ultima) : '—'}</span></div>
      <div class="row" style="padding:9px 0"><span class="info"><b>Próxima (aprox.)</b></span><span>${r.proxima ? fmtQuando(r.proxima) : '—'}</span></div>
      <div class="row" style="padding:9px 0"><span class="info"><b>Horário do robô</b></span><span>todo dia · 06h17</span></div>
      <div class="row" style="padding:9px 0"><span class="info"><b>Buscas por mês</b></span><span>~${r.buscasMes} de ${BUSCAS_MES}</span></div>
      <div class="muted small" style="margin-top:6px">Cada trajeto é consultado a cada 3 dias quando faltam mais de 90 dias para a viagem, a cada 2 dias entre 30 e 90, e todo dia nos últimos 30. Cada consulta gasta 1 busca. Cabem até ${maxAlertas} alertas diários na cota gratuita.</div>
    </div>

    <div class="section-title">Avisos enviados</div>
    ${recentes ? `<div class="rows">${recentes}</div>`
      : `<div class="empty" style="margin:0">Nenhum aviso enviado ainda.</div>`}

    <p class="hint" style="text-align:center;margin-top:16px">Fly Alert · dados via Google Flights (SerpApi) · build 16</p>
  </div>`;
}

/* ---------------- navegação ---------------- */

const TELAS = ['home', 'alertas', 'alerta', 'novo', 'ajustes'];

function navbar(atual) {
  const itens = [
    ['home', 'Painel', '#/home'],
    ['bell', 'Alertas', '#/alertas'],
    ['__fab__', '', '#/novo'],
    ['info', 'Ajustes', '#/ajustes'],
  ];
  return itens.map(([i, t, go]) => i === '__fab__'
    ? `<button data-go="${go}" aria-label="Novo alerta"><span class="fab">${ic('plus', 24)}</span></button>`
    : `<button class="${atual === go ? 'on' : ''}" data-go="${go}">${ic(i, 21)}<span>${t}</span></button>`).join('');
}

function render() {
  const hash = location.hash || '#/';
  const [, seg, id] = hash.split('/');
  // links antigos (viagem, histórico, filtros, perfil…) continuam funcionando
  const mapa = {
    '': 'home', home: 'home', alertas: 'alertas', alerta: 'alerta', viagem: 'alerta', historico: 'alerta',
    novo: 'novo', ajustes: 'ajustes', perfil: 'ajustes', notificacoes: 'ajustes',
    info: 'home', viagens: 'home', filtros: 'home',
  };
  const tela = mapa[seg] ?? 'home';

  for (const t of TELAS) $(`scr-${t}`).classList.toggle('on', t === tela);
  const alvo = $(`scr-${tela}`);

  if (!S.carregado) {
    alvo.innerHTML = S.erro
      ? `<div class="error">Não deu para carregar os preços: ${esc(S.erro)}</div>`
      : `<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>`;
  } else {
    alvo.innerHTML = {
      home: telaHome, alertas: telaAlertas, novo: telaNovo, ajustes: telaAjustes,
      alerta: () => telaAlerta(id),
    }[tela]();
  }

  const nav = $('nav');
  nav.hidden = false;
  nav.innerHTML = navbar({ home: '#/home', alerta: '#/home', alertas: '#/alertas', novo: '#/novo', ajustes: '#/ajustes' }[tela]);
  window.scrollTo(0, 0);
  if (tela === 'novo') prepararFormulario();
  if (tela === 'ajustes') {
    sincronizarPush();
    if (!S.alertasOk && S.carregado) carregarAlertas().then(() => { if (location.hash.includes('ajustes')) render(); });
  }
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ---------------- interações ---------------- */

document.addEventListener('click', async (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { location.hash = go.dataset.go; return; }

  const jan = e.target.closest('[data-janela]');
  if (jan) {
    const y = window.scrollY;
    S.view.janela = jan.dataset.janela === 'tudo' ? 'tudo' : Number(jan.dataset.janela);
    render(); window.scrollTo(0, y); return;
  }

  const tab = e.target.closest('[data-tab]');
  if (tab) { S.view.tabAlertas = tab.dataset.tab; render(); return; }

  const tg = e.target.closest('[data-toggle]');
  if (tg) { await alternarAlerta(tg.dataset.toggle); return; }

  if (e.target.closest('#push-switch')) { ativarPush(); return; }
  if (e.target.closest('#btn-criar')) { criarAlerta(); return; }

  const pax = e.target.closest('[data-pax]');
  if (pax) {
    const el = $('f-pax-txt');
    const n = Math.min(9, Math.max(1, (Number(el.dataset.n || 1)) + Number(pax.dataset.pax)));
    el.dataset.n = n;
    el.textContent = `${n} adulto${n > 1 ? 's' : ''}`;
  }
});

function prepararFormulario() {
  const el = $('f-pax-txt');
  if (el && !el.dataset.n) el.dataset.n = 1;
}

async function alternarAlerta(id) {
  const w = S.watches.find((x) => x.id === id);
  if (!w) return;
  const novo = !w.active;
  w.active = novo;
  const y = window.scrollY;
  render(); window.scrollTo(0, y);
  try {
    await api(`watches?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ active: novo }) });
    toast(novo ? 'Alerta reativado.' : 'Alerta pausado.');
  } catch (err) {
    w.active = !novo; render();
    toast('Não foi possível salvar. Verifique as permissões no Supabase.');
  }
}

async function criarAlerta() {
  const btn = $('btn-criar');
  const dep = $('f-origem').value, arr = $('f-destino').value;
  const ida = $('f-ida').value;
  const adults = Number($('f-pax-txt').dataset.n || 1);
  const teto = Number($('f-teto').value) || null;
  const janela = $('f-janela').value || null;

  if (!ida) return toast('Escolha a data do voo.');
  if (dep === arr) return toast('Origem e destino precisam ser diferentes.');

  btn.disabled = true; btn.textContent = 'Criando...';
  try {
    const [criado] = await api('watches', {
      method: 'POST',
      body: JSON.stringify({
        label: `${cidade(dep)} → ${cidade(arr)} · ${diaMes(ida)}`,
        departure_id: dep, arrival_id: arr,
        outbound_date: ida, return_date: null,
        trip_type: 2, currency: 'BRL', target_price: teto,
        outbound_times: janela, adults, active: true,
      }),
    });
    await carregar();
    toast('Alerta criado. A primeira leitura chega na próxima consulta.');
    location.hash = criado?.id ? `#/alerta/${criado.id}` : '#/alertas';
  } catch (err) {
    btn.disabled = false; btn.textContent = 'Criar alerta';
    toast('Não foi possível criar o alerta agora.');
  }
}

/* ---------------- push (OneSignal) ---------------- */

const BASE = location.pathname.replace(/[^/]*$/, '');
let OS = null;

window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async (OneSignal) => {
  try {
    await OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      serviceWorkerOverrideForTypical: true,
      serviceWorkerPath: `${BASE.replace(/^\//, '')}OneSignalSDKWorker.js`,
      serviceWorkerParam: { scope: BASE },
      allowLocalhostAsSecureOrigin: true,
    });
    OS = OneSignal;
    OneSignal.User.PushSubscription.addEventListener('change', sincronizarPush);
    sincronizarPush();
  } catch { /* push é opcional */ }
});

function sincronizarPush() {
  const sw = $('push-switch'), st = $('push-status');
  if (!sw || !st) return;
  const on = OS?.User?.PushSubscription?.optedIn && Notification.permission === 'granted';
  sw.classList.toggle('on', !!on);
  sw.setAttribute('aria-checked', String(!!on));
  st.textContent = on ? 'Ativas neste aparelho.' : 'Receba um aviso quando o preço cair.';
}

async function ativarPush() {
  if (!OS) return toast('O serviço de notificação ainda está carregando.');
  try {
    if (OS.User.PushSubscription.optedIn) {
      await OS.User.PushSubscription.optOut();
      toast('Notificações desativadas neste aparelho.');
    } else {
      if (Notification.permission !== 'granted') await OS.Notifications.requestPermission();
      if (Notification.permission === 'denied') return toast('Permissão bloqueada no navegador.');
      await OS.User.PushSubscription.optIn();
      toast('Notificações ativadas.');
    }
  } catch (e) { toast('Não foi possível alterar as notificações.'); }
  sincronizarPush();
}

/* ---------------- boot ---------------- */

window.addEventListener('hashchange', render);
render();
carregar()
  .catch((err) => { S.erro = err.message; })
  .finally(render);

// Os dados só mudam quando o robô roda (no máximo 1x por dia): ao voltar para o app,
// só recarrega se já passaram 30 minutos — menos requisições ao banco.
let ultimaCarga = Date.now();
function recarregarAoVoltar() {
  if (document.visibilityState !== 'visible' || Date.now() - ultimaCarga < 30 * 60000) return;
  ultimaCarga = Date.now();
  carregar().then(render).catch(() => {});
}
document.addEventListener('visibilitychange', recarregarAoVoltar);
window.addEventListener('pageshow', recarregarAoVoltar);

// limpa workers antigos presos de versões anteriores
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((rs) => rs.forEach((r) => { if (r.active?.scriptURL.endsWith('/sw.js')) r.unregister(); }))
    .catch(() => {});
}
