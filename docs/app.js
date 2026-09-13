/* Fly Alert — app do Figma, dados reais do Supabase. */

const SUPABASE_URL = 'https://qnxyjzmqubzdkouvzewq.supabase.co';
const SUPABASE_ANON = 'sb_publishable_glj1x8t-y-vGdhozSBW84Q_rLRlkdbk';
const ONESIGNAL_APP_ID = '11593a31-7feb-45b9-aad9-5d1eb46bf1c7';
const USUARIO = { nome: 'Lucas Tavares', email: 'lucas@email.com' };

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
const periodo = (w) => w.return_date
  ? `${diaMes(w.outbound_date)} → ${diaMes(w.return_date)} ${D(w.return_date).getFullYear()}`
  : `${diaMes(w.outbound_date)} ${D(w.outbound_date).getFullYear()}`;
const sigla = (ids) => String(ids).split(',')[0].trim();

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
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  bulb: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2',
  card: 'M3 10h18M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.9-.9 1.5v.7M12 17h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 16v-5M12 8h.01',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  check: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M8.5 12.5l2.5 2.5 4.5-5',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  users: 'M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.8',
  x: 'M18 6 6 18M6 6l12 12',
  cal2: 'M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  hist: 'M12 22a10 10 0 1 0-9.9-11M12 7v5l3.5 2M2 6v5h5',
  money: 'M12 2v20M17 6.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.8 5 3.4 5 1.4 5 3.4-2.2 3.2-5 3.2-5-1.3-5-3.2',
};
const ic = (n, size = 20, cls = '') =>
  `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;

/* ---------------- estado ---------------- */

const S = {
  watches: [],
  checks: {},           // watch_id -> [{t, v, price_level, ...}]
  alertas: [],          // alerts_sent
  ultima: {},           // watch_id -> último price_check completo
  filtros: carregarFiltros(),
  carregado: false,
  erro: null,
  view: { tabAlertas: 'ativos', legAberta: null },
};

function carregarFiltros() {
  try {
    return Object.assign(
      { escalas: 'todas', horarios: [], cias: [] },
      JSON.parse(localStorage.getItem('fa_filtros') || '{}')
    );
  } catch { return { escalas: 'todas', horarios: [], cias: [] }; }
}
const salvarFiltros = () => localStorage.setItem('fa_filtros', JSON.stringify(S.filtros));

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

async function carregar() {
  const watches = await api('watches?select=*&order=outbound_date.asc');
  const ids = watches.map((w) => `"${w.id}"`).join(',');
  const [checks, alertas] = await Promise.all([
    ids ? api(`price_checks?watch_id=in.(${ids})&select=watch_id,price,currency,price_level,typical_low,typical_high,airline,duration_min,offers,source,checked_at&order=checked_at.asc&limit=4000`) : [],
    api('alerts_sent?select=*&order=sent_at.desc&limit=20').catch(() => []),
  ]);

  S.watches = watches;
  S.checks = {};
  S.ultima = {};
  for (const c of checks) {
    (S.checks[c.watch_id] ||= []).push({ t: new Date(c.checked_at).getTime(), v: Number(c.price), live: c.source !== 'google_history' });
    S.ultima[c.watch_id] = c;
  }
  S.alertas = alertas;
  S.carregado = true;
}

/* ---------------- métricas ---------------- */

const DIA = 86400000;

function stats(w) {
  const pts = S.checks[w.id] || [];
  if (!pts.length) return null;
  const agora = Date.now();
  const vals = pts.map((p) => p.v);
  const j30 = pts.filter((p) => agora - p.t <= 30 * DIA).map((p) => p.v);
  const base = j30.length > 1 ? j30 : vals;
  const atual = vals[vals.length - 1];
  const media = base.reduce((a, b) => a + b, 0) / base.length;
  const min = Math.min(...vals);
  const max = Math.max(...base);
  const pct = media ? Math.round(((atual - media) / media) * 100) : 0;
  let quedas = 0;
  for (let i = 1; i < pts.length; i++) {
    if (agora - pts[i].t <= 30 * DIA && pts[i - 1].v - pts[i].v >= 50) quedas++;
  }
  return { atual, media, min, max, pct, quedas, economia: Math.max(0, media - atual), leituras: pts.length, primeiro: pts[0].t };
}

function resumoGeral() {
  const ativos = S.watches.filter((w) => w.active);
  let economia = 0, quedas = 0, potencial = 0, comDados = 0;
  for (const w of ativos) {
    const s = stats(w);
    if (!s) continue;
    comDados++;
    economia += s.economia;
    quedas += s.quedas;
    potencial += Math.max(0, s.max - s.atual);
  }
  return { ativos: ativos.length, economia, quedas, potencial, comDados, total: S.watches.length };
}

function badge(pct) {
  if (pct <= -1) return `<span class="badge">↓ ${Math.abs(pct)}%</span>`;
  if (pct >= 1) return `<span class="badge up">↑ ${pct}%</span>`;
  return `<span class="badge flat">estável</span>`;
}

/* ---------------- gráfico ---------------- */

function chart(pts, { alto = false } = {}) {
  if (!pts || pts.length < 2) return `<p class="muted small">Ainda sem histórico suficiente para o gráfico.</p>`;
  const W = 360, H = alto ? 200 : 175, PL = 46, PR = 44, PT = 16, PB = 24;

  // reamostra para no máximo 26 pontos, mantendo o primeiro e o último
  const passo = Math.max(1, Math.ceil(pts.length / 26));
  const p = pts.filter((_, i) => i % passo === 0);
  if (p[p.length - 1] !== pts[pts.length - 1]) p.push(pts[pts.length - 1]);

  const vals = p.map((d) => d.v);

  // Médias dos últimos 30/60/90 dias. Uma janela só entra se trouxer leitura
  // que a anterior não tinha — senão vira linha duplicada em cima da outra.
  const agora = Date.now();
  const medias = [];
  let antes = 0;
  for (const [dias, cor] of [[30, '#15A05A'], [60, '#C97A05'], [90, '#7A5AD6']]) {
    const janela = pts.filter((d) => agora - d.t <= dias * DIA);
    if (janela.length < 2 || janela.length === antes) continue;
    antes = janela.length;
    medias.push({ dias, cor, v: janela.reduce((a, d) => a + d.v, 0) / janela.length });
  }

  const extremos = [...vals, ...medias.map((m) => m.v)];
  const lo = Math.min(...extremos), hi = Math.max(...extremos);
  const pad = (hi - lo) * 0.18 || Math.max(60, lo * 0.05);
  const y0 = lo - pad, y1 = hi + pad;
  const t0 = p[0].t, t1 = p[p.length - 1].t;

  const X = (t) => (t1 === t0 ? PL : PL + ((t - t0) / (t1 - t0)) * (W - PL - PR));
  const Y = (v) => PT + (1 - (v - y0) / (y1 - y0)) * (H - PT - PB);

  let grade = '', linha = '', pontos = '', datas = '';
  for (let i = 0; i <= 3; i++) {
    const v = y0 + ((y1 - y0) / 3) * i;
    const y = Y(v).toFixed(1);
    grade += `<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="#E6ECF4" stroke-width="1"/>
      <text x="${PL - 8}" y="${Number(y) + 3.5}" text-anchor="end" font-size="9.5" fill="#8A99AD">R$ ${num(v)}</text>`;
  }
  linha = p.map((d, i) => `${i ? 'L' : 'M'}${X(d.t).toFixed(1)},${Y(d.v).toFixed(1)}`).join(' ');
  const area = `${linha} L${X(t1).toFixed(1)},${H - PB} L${PL},${H - PB} Z`;
  pontos = p.map((d) => `<circle cx="${X(d.t).toFixed(1)}" cy="${Y(d.v).toFixed(1)}" r="3" fill="#fff" stroke="#1D6FE8" stroke-width="2"/>`).join('');

  const marcas = [0, 1, 2, 3].map((i) => p[Math.round((p.length - 1) * (i / 3))]);
  datas = [...new Set(marcas)].map((d) =>
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

function linhaAlerta(w, { toggle = false } = {}) {
  const s = stats(w);
  const preco = s ? brl(s.atual, w.currency) : '—';
  const dist = s ? badge(s.pct) : '<span class="badge flat">sem dados</span>';
  const pax = `${w.adults || 1} pessoa${(w.adults || 1) > 1 ? 's' : ''}`;
  const controle = toggle
    ? `<div class="switch ${w.active ? 'on' : ''}" data-toggle="${w.id}" role="switch" aria-checked="${w.active}" tabindex="0"></div>`
    : `<span class="chev">${ic('right', 18)}</span>`;
  return `<div class="row">
    <button class="thumb" style="background:${grad(w)}" data-go="#/alerta/${w.id}" aria-label="Abrir alerta">
      ${sigla(w.departure_id)}→${sigla(w.arrival_id)}
    </button>
    <button class="info" data-go="#/alerta/${w.id}">
      <b>${esc(rota(w))}</b>
      <small class="datas">${periodo(w)}</small>
      <small>${pax} · ${w.return_date ? 'ida e volta' : 'só ida'}</small>
      <span class="price">${preco} ${dist}</span>
    </button>
    ${controle}
  </div>`;
}

/* ---------------- telas ---------------- */

function telaSplash() {
  return `<div class="splash">
    <div class="splash-top">
      <svg class="plane" viewBox="0 0 24 24" fill="#5FA8FF" aria-hidden="true"><path d="${ICONS.plane}"/></svg>
      <div class="splash-logo">Fly <span>Alert</span></div>
      <p>Acompanhe os preços das suas viagens e seja avisado quando eles caírem.</p>
    </div>
    <div class="splash-actions">
      <button class="btn btn-splash" data-go="#/home">Começar</button>
      <a class="link-center" href="#/home">Já tenho uma conta</a>
    </div>
  </div>`;
}

function telaHome() {
  const r = resumoGeral();
  const ativos = S.watches.filter((w) => w.active).slice(0, 3);
  const spark = `<svg class="spark" width="70" height="34" viewBox="0 0 70 34" fill="none">
    <path d="M2 30 L16 22 L28 26 L42 13 L54 16 L68 4" stroke="#5AE29A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M60 4h8v8" stroke="#5AE29A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  return `
  <div class="hello">
    <h2>Olá, ${esc(USUARIO.nome.split(' ')[0])} 👋</h2>
    <p>Aqui está um resumo dos seus alertas</p>
  </div>

  <div class="savings">
    <h3>Você está economizando!</h3>
    <p>Nos últimos 30 dias, ${r.comDados} rota${r.comDados === 1 ? '' : 's'} monitorada${r.comDados === 1 ? '' : 's'} estão abaixo da própria média.</p>
    <div class="big">${brl(r.economia)}</div>
    ${spark}
  </div>

  <div class="tiles">
    <div class="tile"><div class="ic" style="background:var(--blue-soft);color:var(--blue)">${ic('bell', 17)}</div>
      <div><b>${r.ativos}</b><small>Alertas ativos</small></div></div>
    <div class="tile"><div class="ic" style="background:var(--blue-soft);color:var(--blue)">${ic('trend', 17)}</div>
      <div><b>${r.quedas}</b><small>Quedas de preço</small></div></div>
    <div class="tile"><div class="ic" style="background:var(--green-bg);color:var(--green)">${ic('check', 17)}</div>
      <div><b>${r.total}</b><small>Rotas monitoradas</small></div></div>
    <div class="tile"><div class="ic" style="background:#FFF3E0;color:var(--amber)">${ic('money', 17)}</div>
      <div><b>${brl(r.potencial)}</b><small>Economia potencial</small></div></div>
  </div>

  <div class="wrap">
    <div class="section-title">Seus alertas <a href="#/alertas">Ver todos</a></div>
    ${ativos.length ? `<div class="rows">${ativos.map((w) => linhaAlerta(w)).join('')}</div>`
      : `<div class="empty">Nenhum alerta ativo ainda. Toque no + para criar o primeiro.</div>`}
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
    <button class="${S.view.tabAlertas === 'inativos' ? 'on' : ''}" data-tab="inativos">Inativos (${inativos.length})</button>
  </div>
  <div class="wrap" style="margin-top:14px">
    ${lista.length ? `<div class="rows">${lista.map((w) => linhaAlerta(w, { toggle: true })).join('')}</div>`
      : `<div class="empty" style="margin:0">Nenhum alerta ${S.view.tabAlertas === 'ativos' ? 'ativo' : 'inativo'} no momento.</div>`}
  </div>`;
}

function telaAlerta(id) {
  const w = S.watches.find((x) => x.id === id);
  if (!w) return `<div class="error">Alerta não encontrado.</div>`;
  const s = stats(w);
  const u = S.ultima[w.id];
  const pts = S.checks[w.id] || [];
  const dica = s && s.atual > s.min
    ? `Você pode economizar até <b>${brl(s.atual - s.min, w.currency)}</b> se esperar o preço voltar ao menor valor já visto (${brl(s.min, w.currency)}).`
    : `Este é o <b>menor preço já registrado</b> para esta rota desde o início do monitoramento.`;

  return `
  <div class="hero" style="background:${grad(w)}">
    <div class="hero-nav">
      <button class="iconbtn" style="color:#fff" data-go="#/alertas" aria-label="Voltar">${ic('left', 22)}</button>
      <button class="iconbtn" style="color:#fff" data-go="#/historico/${w.id}" aria-label="Histórico">${ic('bookmark', 22)}</button>
    </div>
    <div class="codes">${sigla(w.departure_id)} → ${sigla(w.arrival_id)}</div>
    <span class="pill">${w.active ? '🔔 Alerta ativo' : '⏸ Alerta pausado'}</span>
  </div>

  <div class="detail-head">
    <h2>${esc(rota(w))}</h2>
    <div class="sub">${w.return_date ? 'Ida e volta' : 'Só ida'} · ${w.adults || 1} pessoa${(w.adults || 1) > 1 ? 's' : ''}</div>
    <div class="sub" style="margin-top:8px">${ic('cal2', 15)} ${dataLonga(w.outbound_date)}${w.return_date ? ` — ${dataLonga(w.return_date)}` : ''}</div>

    <div class="price-xl">${s ? brl(s.atual, w.currency) : '—'} ${s ? badge(s.pct) : ''}</div>
    <div class="sub">Menor preço encontrado: <b>${s ? brl(s.min, w.currency) : '—'}</b>${u?.airline ? ` · ${esc(u.airline)}` : ''}</div>

    <button class="btn" style="margin-top:14px" data-go="#/viagem/${w.id}">Ver detalhes da viagem</button>

    <div class="tipcard">
      <span class="ic">${ic('bulb', 20)}</span>
      <p>${dica}</p>
    </div>

    <div class="chartbox">
      <h3>Histórico de preços</h3>
      ${chart(pts)}
      <button class="btn ghost" style="margin-top:10px" data-go="#/historico/${w.id}">Ver histórico completo</button>
    </div>
  </div>`;
}

function telaHistorico(id) {
  const w = S.watches.find((x) => x.id === id);
  if (!w) return `<div class="error">Alerta não encontrado.</div>`;
  const s = stats(w);
  const pts = S.checks[w.id] || [];
  const dias = s ? Math.max(1, Math.round((Date.now() - s.primeiro) / DIA)) : 0;
  const antecedencia = Math.round((D(w.outbound_date) - Date.now()) / DIA);

  const dicas = [
    [ic('clock', 18), `Faltam <b>${antecedencia} dias</b> para a viagem. A faixa mais barata costuma aparecer entre 60 e 90 dias antes.`],
    [ic('cal2', 18), `Terça e quarta são os dias com os preços mais baixos — o robô consulta 3x por dia (06h, 14h e 22h).`],
    [ic('plane', 18), `Voos diretos podem sair mais caros, mas economizam tempo. Compare na aba da viagem.`],
  ];

  return `
  ${topbar('Histórico de preços', { voltar: `#/alerta/${w.id}` })}
  <div class="wrap">
    <div class="card">
      <b style="font-size:16px">${esc(rota(w))}</b>
      <div class="sub muted small">${w.return_date ? 'Ida e volta' : 'Só ida'} · ${w.adults || 1} pessoa${(w.adults || 1) > 1 ? 's' : ''}</div>
      <div class="price-xl" style="font-size:27px">${s ? brl(s.atual, w.currency) : '—'} ${s ? badge(s.pct) : ''}</div>
      <div class="small" style="color:var(--green);font-weight:600">Menor preço: ${s ? brl(s.min, w.currency) : '—'}</div>
      ${chart(pts, { alto: true })}
      <div class="tiles" style="padding:12px 0 0;gap:10px">
        <div class="tile"><div><b>${s ? brl(s.media, w.currency) : '—'}</b><small>Média 30 dias</small></div></div>
        <div class="tile"><div><b>${s ? brl(s.max, w.currency) : '—'}</b><small>Máximo 30 dias</small></div></div>
        <div class="tile"><div><b>${s ? s.leituras : 0}</b><small>Leituras</small></div></div>
        <div class="tile"><div><b>${dias}</b><small>Dias monitorando</small></div></div>
      </div>
    </div>

    <div class="card">
      <b style="font-size:15px">Dicas para comprar</b>
      ${dicas.map(([icone, txt]) => `<div class="tipcard" style="background:#F4F7FB">
        <span class="ic">${icone}</span><p>${txt}</p></div>`).join('')}
    </div>

    <button class="btn" style="margin-top:14px" data-go="#/novo">Criar alerta parecido</button>
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
  ${topbar('Adicionar Alerta', { voltar: '#/alertas' })}
  <div class="wrap">
    <div class="tabs light" style="margin:0 0 4px">
      <button class="on">Voos</button>
      <button disabled style="opacity:.5">Hotéis</button>
      <button disabled style="opacity:.5">Pacotes</button>
    </div>

    <div class="field"><label>Origem</label>
      <div class="control"><span class="ic">${ic('plane', 18)}</span>${sel('f-origem', 'GRU,CGH,VCP')}<span class="chev">${ic('right', 16)}</span></div></div>

    <div class="field"><label>Destino</label>
      <div class="control"><span class="ic">${ic('pin', 18)}</span>${sel('f-destino', 'SSA')}<span class="chev">${ic('right', 16)}</span></div></div>

    <div class="field"><label>Tipo de viagem</label>
      <div class="tabs light" style="margin:0">
        <button class="on" data-tipo="1" id="tipo-1">Ida e volta</button>
        <button data-tipo="2" id="tipo-2">Só ida</button>
      </div></div>

    <div class="field"><label>Data de ida</label>
      <div class="control"><span class="ic">${ic('calendar', 18)}</span><input type="date" id="f-ida" value="2026-12-26"></div></div>

    <div class="field" id="campo-volta"><label>Data de volta</label>
      <div class="control"><span class="ic">${ic('calendar', 18)}</span><input type="date" id="f-volta" value="2027-01-01"></div></div>

    <div class="field"><label>Passageiros</label>
      <div class="control"><span class="ic">${ic('users', 18)}</span>
        <span style="flex:1;font-weight:600"><span id="f-pax-txt">1 adulto</span></span>
        <span class="stepper"><button data-pax="-1" aria-label="Menos">−</button><button data-pax="1" aria-label="Mais">+</button></span>
      </div></div>

    <div class="field"><label>Preço desejado (opcional)</label>
      <div class="control"><span style="font-weight:700;color:var(--muted)">R$</span>
        <input type="number" id="f-teto" placeholder="2.000" inputmode="numeric"></div>
      <div class="hint">Vamos te avisar quando o preço ficar igual ou menor.</div></div>

    <div class="field"><label>Horário de partida</label>
      <div class="control"><span class="ic">${ic('clock', 18)}</span>
        <select id="f-janela">
          <option value="">Qualquer horário</option>
          <option value="5,12">Manhã (05h–12h)</option>
          <option value="12,18">Tarde (12h–18h)</option>
          <option value="18,23">Noite (18h–23h)</option>
          <option value="0,5">Madrugada (00h–05h)</option>
        </select></div></div>

    <button class="btn" id="btn-criar" style="margin:20px 0 8px">Criar alerta</button>
    <p class="hint" style="text-align:center">O robô passa a consultar esta rota 3x por dia.</p>
  </div>`;
}

function telaFiltros() {
  const f = S.filtros;
  const cias = ['LATAM', 'Gol', 'Azul', 'American Airlines', 'Air France'];
  const horarios = [['0,5', 'Madrugada', '00h–05h'], ['5,12', 'Manhã', '05h–12h'], ['12,18', 'Tarde', '12h–18h'], ['18,23', 'Noite', '18h–23h']];
  const escalas = [['todas', 'Todas'], ['0', 'Direto'], ['1', '1 escala'], ['2', '2+ escalas']];

  return `
  <div class="topbar" style="background:linear-gradient(135deg,#0B2447,#1B4D87);color:#fff;border-radius:0 0 18px 18px;margin-bottom:6px">
    <button class="iconbtn" style="color:#fff" data-go="#/viagens" aria-label="Fechar">${ic('x', 22)}</button>
    <h1>Filtros</h1><div class="spacer"></div>
    <button style="color:#9FC6FF;font-weight:600;font-size:14px" id="btn-limpar">Limpar</button>
  </div>
  <div class="wrap">
    <div class="section-title">Escalas</div>
    <div class="radio-list">
      ${escalas.map(([v, t]) => `<button class="radio ${f.escalas === v ? 'on' : ''}" data-escala="${v}"><span class="dot"></span>${t}</button>`).join('')}
    </div>

    <div class="section-title">Horários de partida</div>
    <div class="chips">
      ${horarios.map(([v, t, h]) => `<button class="chip ${f.horarios.includes(v) ? 'on' : ''}" data-hora="${v}"><b>${t}</b><small>${h}</small></button>`).join('')}
    </div>

    <div class="section-title">Companhias aéreas</div>
    <div class="rows">
      <div class="row"><span class="info"><b>Todas</b></span>
        <div class="switch ${f.cias.length === 0 ? 'on' : ''}" data-cia="__todas__" role="switch"></div></div>
      ${cias.map((c) => `<div class="row"><span class="info"><b>${c}</b></span>
        <div class="switch ${f.cias.includes(c) ? 'on' : ''}" data-cia="${c}" role="switch"></div></div>`).join('')}
    </div>

    <button class="btn" style="margin:20px 0" data-go="#/viagens">Aplicar filtros</button>
  </div>`;
}

function telaNotificacoes() {
  const ativo = typeof Notification !== 'undefined' && Notification.permission === 'granted';
  const recentes = S.alertas.slice(0, 8).map((a) => {
    const w = S.watches.find((x) => x.id === a.watch_id);
    if (!w) return '';
    const quando = new Date(a.sent_at);
    const horas = Math.round((Date.now() - quando) / 3600000);
    const quando_txt = horas < 24 ? `${horas}h atrás` : `${Math.round(horas / 24)} dia${horas >= 48 ? 's' : ''} atrás`;
    const motivo = { target: 'Atingiu seu teto', below_typical: 'Abaixo da faixa normal', all_time_low: 'Menor preço já visto' }[a.reason] || 'Preço caiu';
    return `<div class="row">
      <span class="thumb" style="background:${grad(w)}">${sigla(w.departure_id)}→${sigla(w.arrival_id)}</span>
      <button class="info" data-go="#/alerta/${w.id}">
        <b>${esc(rota(w))}</b>
        <small style="color:var(--green);font-weight:600">${motivo}</small>
        <span class="price">${brl(a.price, w.currency)} <span class="muted small" style="font-weight:500">· ${quando_txt}</span></span>
      </button>
      <span class="chev">${ic('right', 18)}</span>
    </div>`;
  }).join('');

  return `
  ${topbar('Notificações', { voltar: '#/home' })}
  <div class="wrap">
    <div class="card" style="display:flex;align-items:center;gap:12px">
      <div style="flex:1">
        <b style="font-size:15px">Ativar notificações</b>
        <div class="muted small" id="push-status">Receba alertas quando os preços caírem.</div>
      </div>
      <div class="switch ${ativo ? 'on' : ''}" id="push-switch" role="switch" aria-checked="${ativo}" tabindex="0"></div>
    </div>

    <div class="section-title">Alertas recentes</div>
    ${recentes ? `<div class="rows">${recentes}</div>`
      : `<div class="empty" style="margin:0">Nenhum aviso enviado ainda. Assim que uma tarifa cair, ela aparece aqui.</div>`}

    <div class="tipcard" style="margin-top:16px">
      <span class="ic">${ic('bell', 20)}</span>
      <p><b>Dica.</b> Ative as notificações push para ser avisado em tempo real, 3x por dia (06h · 14h · 22h).</p>
    </div>
  </div>`;
}

function ofertasFiltradas(u) {
  let of = Array.isArray(u?.offers) ? [...u.offers] : [];
  const f = S.filtros;
  if (f.escalas !== 'todas') {
    const n = Number(f.escalas);
    of = of.filter((o) => (n === 2 ? o.stops >= 2 : o.stops === n));
  }
  if (f.horarios.length) {
    of = of.filter((o) => {
      const h = Number(hhmm(o.departure).split(':')[0]);
      return f.horarios.some((j) => { const [a, b] = j.split(',').map(Number); return h >= a && h < b; });
    });
  }
  if (f.cias.length) of = of.filter((o) => (o.airlines || []).some((c) => f.cias.includes(c)));
  return of;
}

function telaViagem(id) {
  if (!id) {
    return `${topbar('Minhas viagens')}
    <div class="wrap">${S.watches.length
      ? `<div class="rows">${S.watches.map((w) => linhaAlerta(w)).join('')}</div>`
      : `<div class="empty" style="margin:0">Nenhuma viagem monitorada.</div>`}</div>`;
  }
  const w = S.watches.find((x) => x.id === id);
  if (!w) return `<div class="error">Viagem não encontrada.</div>`;
  const u = S.ultima[w.id];
  const s = stats(w);
  const of = ofertasFiltradas(u);
  const total = Array.isArray(u?.offers) ? u.offers.length : 0;

  const cardOferta = (o, i) => `
    <div class="leg">
      <div class="route"><span>${o.departure_id || sigla(w.departure_id)} → ${sigla(w.arrival_id)}</span><span>${brl(o.price, w.currency)}</span></div>
      <div class="meta">${dataLonga(w.outbound_date)} · ${hhmm(o.departure) || '--:--'} – ${hhmm(o.arrival) || '--:--'}</div>
      <div class="meta">${o.stops === 0 ? '● Direto' : `● ${o.stops} escala${o.stops > 1 ? 's' : ''}`} · ${durStr(o.duration_min)} · ${(o.airlines || []).join(' + ') || '—'}</div>
      <button class="more" data-leg="${i}">${S.view.legAberta === String(i) ? '▲ Ocultar detalhes' : '▼ Ver detalhes'}</button>
      <div class="leg-detail ${S.view.legAberta === String(i) ? 'on' : ''}">
        Saída ${hhmm(o.departure) || '—'} de ${o.departure_id || '—'}<br>
        Chegada ${hhmm(o.arrival) || '—'} em ${sigla(w.arrival_id)}<br>
        Duração total ${durStr(o.duration_min)} · ${o.stops === 0 ? 'sem conexões' : `${o.stops} conexão(ões)`}<br>
        Preço por ${w.adults || 1} passageiro(s), moeda ${w.currency}
      </div>
    </div>`;

  return `
  ${topbar('Minha Viagem', { voltar: `#/alerta/${w.id}`, acao: `<button class="iconbtn blue" data-go="#/filtros" aria-label="Filtros">${ic('trend', 20)}</button>` })}
  <div class="wrap">
    <div class="hero" style="background:${grad(w)};height:130px;border-radius:16px">
      <div class="codes" style="font-size:26px">${sigla(w.departure_id)} → ${sigla(w.arrival_id)}</div>
    </div>
    <div style="margin-top:12px">
      <b style="font-size:17px">${esc(cidade(w.arrival_id))}</b>
      <div class="muted small">${dataLonga(w.outbound_date)}${w.return_date ? ` – ${dataLonga(w.return_date)}` : ''}</div>
      <div class="muted small">${ic('users', 14)} ${w.adults || 1} pessoa${(w.adults || 1) > 1 ? 's' : ''} · ${w.outbound_times ? `partida ${w.outbound_times.replace(',', 'h–')}h` : 'qualquer horário'}</div>
    </div>

    <div class="section-title">Voos encontrados <span class="muted small" style="font-weight:500">${of.length} de ${total}</span></div>
    ${of.length ? of.map(cardOferta).join('')
      : `<div class="empty" style="margin:0">Nenhuma opção bate com os filtros atuais. <button style="color:var(--blue);font-weight:600" data-go="#/filtros">Ajustar filtros</button></div>`}

    ${s ? `<div class="result">
      <span style="color:var(--green)">${ic('check', 22)}</span>
      <div><b>${brl(s.atual, w.currency)}</b>
        <small>${s.atual <= s.min ? 'Este é o menor preço já registrado' : `Você economiza ${brl(s.max - s.atual, w.currency)} em relação ao pico`}</small></div>
    </div>` : ''}

    <button class="btn" style="margin:16px 0" data-go="#/historico/${w.id}">Ver histórico de preços</button>
  </div>`;
}

function telaPerfil() {
  const itens = [
    ['plane', 'Minhas viagens', '#/viagens'],
    ['hist', 'Histórico de preços', S.watches[0] ? `#/historico/${S.watches[0].id}` : '#/alertas'],
    ['bell', 'Meus alertas', '#/alertas'],
    ['bell', 'Notificações', '#/notificacoes'],
    ['card', 'Formas de pagamento', '#/perfil'],
    ['help', 'Ajuda e suporte', '#/perfil'],
    ['info', 'Sobre o Fly Alert', '#/perfil'],
  ];
  const iniciais = USUARIO.nome.split(' ').map((p) => p[0]).slice(0, 2).join('');
  return `
  ${topbar('Perfil')}
  <div class="prof">
    <div class="avatar">${iniciais}</div>
    <div><b style="font-size:15.5px">${esc(USUARIO.nome)}</b><div class="muted small">${esc(USUARIO.email)}</div></div>
  </div>
  <div class="menu">
    ${itens.map(([i, t, go]) => `<button data-go="${go}"><span class="ic">${ic(i, 20)}</span><span style="flex:1">${t}</span><span class="chev">${ic('right', 18)}</span></button>`).join('')}
    <button class="danger" data-go="#/"><span class="ic">${ic('logout', 20)}</span><span style="flex:1">Sair</span></button>
  </div>
  <p class="hint" style="text-align:center;margin-top:16px">Fly Alert · dados via Google Flights (SerpApi) · build 13</p>`;
}

/* ---------------- navegação ---------------- */

const TELAS = ['splash', 'home', 'alertas', 'alerta', 'historico', 'novo', 'filtros', 'notificacoes', 'viagem', 'perfil'];

function navbar(atual) {
  const itens = [
    ['home', 'Início', '#/home'],
    ['bell', 'Alertas', '#/alertas'],
    ['__fab__', '', '#/novo'],
    ['plane', 'Viagens', '#/viagens'],
    ['user', 'Perfil', '#/perfil'],
  ];
  return itens.map(([i, t, go]) => i === '__fab__'
    ? `<button data-go="${go}" aria-label="Novo alerta"><span class="fab">${ic('plus', 24)}</span></button>`
    : `<button class="${atual === go ? 'on' : ''}" data-go="${go}">${ic(i, 21)}<span>${t}</span></button>`).join('');
}

function render() {
  const hash = location.hash || '#/';
  const [, seg, id] = hash.split('/');
  const mapa = {
    '': 'splash', home: 'home', alertas: 'alertas', alerta: 'alerta', historico: 'historico',
    novo: 'novo', filtros: 'filtros', notificacoes: 'notificacoes',
    viagem: 'viagem', viagens: 'viagem', perfil: 'perfil',
  };
  const tela = mapa[seg] ?? 'home';

  for (const t of TELAS) $(`scr-${t}`).classList.toggle('on', t === tela);
  const alvo = $(`scr-${tela}`);

  if (tela !== 'splash' && !S.carregado) {
    alvo.innerHTML = S.erro
      ? `<div class="error">Não deu para carregar os preços: ${esc(S.erro)}</div>`
      : `<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>`;
  } else {
    const html = {
      splash: telaSplash, home: telaHome, alertas: telaAlertas, novo: telaNovo,
      filtros: telaFiltros, notificacoes: telaNotificacoes, perfil: telaPerfil,
      alerta: () => telaAlerta(id), historico: () => telaHistorico(id),
      viagem: () => telaViagem(seg === 'viagem' ? id : null),
    }[tela];
    alvo.innerHTML = html();
  }

  const nav = $('nav');
  nav.hidden = tela === 'splash';
  if (!nav.hidden) {
    const aba = ['#/home', '#/alertas', '#/novo', '#/viagens', '#/perfil'];
    const atual = aba.find((a) => hash.startsWith(a)) || (tela === 'viagem' ? '#/viagens' : tela === 'alerta' || tela === 'historico' ? '#/alertas' : '');
    nav.innerHTML = navbar(atual);
  }
  window.scrollTo(0, 0);
  if (tela === 'novo') prepararFormulario();
  if (tela === 'notificacoes') sincronizarPush();
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

  const tab = e.target.closest('[data-tab]');
  if (tab) { S.view.tabAlertas = tab.dataset.tab; render(); return; }

  const leg = e.target.closest('[data-leg]');
  if (leg) { S.view.legAberta = S.view.legAberta === leg.dataset.leg ? null : leg.dataset.leg; render(); return; }

  const tg = e.target.closest('[data-toggle]');
  if (tg) { await alternarAlerta(tg.dataset.toggle); return; }

  const esc_ = e.target.closest('[data-escala]');
  if (esc_) { S.filtros.escalas = esc_.dataset.escala; salvarFiltros(); render(); return; }

  const hora = e.target.closest('[data-hora]');
  if (hora) {
    const v = hora.dataset.hora;
    S.filtros.horarios = S.filtros.horarios.includes(v) ? S.filtros.horarios.filter((x) => x !== v) : [...S.filtros.horarios, v];
    salvarFiltros(); render(); return;
  }

  const cia = e.target.closest('[data-cia]');
  if (cia) {
    const v = cia.dataset.cia;
    if (v === '__todas__') S.filtros.cias = [];
    else S.filtros.cias = S.filtros.cias.includes(v) ? S.filtros.cias.filter((x) => x !== v) : [...S.filtros.cias, v];
    salvarFiltros(); render(); return;
  }

  if (e.target.closest('#btn-limpar')) { S.filtros = { escalas: 'todas', horarios: [], cias: [] }; salvarFiltros(); render(); return; }
  if (e.target.closest('#push-switch')) { ativarPush(); return; }
  if (e.target.closest('#btn-criar')) { criarAlerta(); return; }

  const pax = e.target.closest('[data-pax]');
  if (pax) {
    const el = $('f-pax-txt');
    const n = Math.min(9, Math.max(1, (Number(el.dataset.n || 1)) + Number(pax.dataset.pax)));
    el.dataset.n = n;
    el.textContent = `${n} adulto${n > 1 ? 's' : ''}`;
    return;
  }

  const tipo = e.target.closest('[data-tipo]');
  if (tipo) {
    $('tipo-1').classList.toggle('on', tipo.dataset.tipo === '1');
    $('tipo-2').classList.toggle('on', tipo.dataset.tipo === '2');
    $('campo-volta').style.display = tipo.dataset.tipo === '1' ? '' : 'none';
    return;
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
  render();
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
  const tipo = $('tipo-1').classList.contains('on') ? 1 : 2;
  const dep = $('f-origem').value, arr = $('f-destino').value;
  const ida = $('f-ida').value, volta = $('f-volta').value;
  const adults = Number($('f-pax-txt').dataset.n || 1);
  const teto = Number($('f-teto').value) || null;
  const janela = $('f-janela').value || null;

  if (!ida) return toast('Escolha a data de ida.');
  if (tipo === 1 && !volta) return toast('Escolha a data de volta.');
  if (dep === arr) return toast('Origem e destino precisam ser diferentes.');

  btn.disabled = true; btn.textContent = 'Criando...';
  try {
    const [criado] = await api('watches', {
      method: 'POST',
      body: JSON.stringify({
        label: `${cidade(dep)} → ${cidade(arr)} · ${diaMes(ida)}`,
        departure_id: dep, arrival_id: arr,
        outbound_date: ida, return_date: tipo === 1 ? volta : null,
        trip_type: tipo, currency: 'BRL', target_price: teto,
        outbound_times: janela, adults, active: true,
      }),
    });
    await carregar();
    toast('Alerta criado. A primeira leitura chega no próximo ciclo.');
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
  st.textContent = on ? 'Ativas neste aparelho.' : 'Receba alertas quando os preços caírem.';
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
  .then(() => { if (!location.hash || location.hash === '#/') return; render(); })
  .catch((err) => { S.erro = err.message; })
  .finally(render);

// limpa workers antigos presos de versões anteriores
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((rs) => rs.forEach((r) => { if (r.active?.scriptURL.endsWith('/sw.js')) r.unregister(); }))
    .catch(() => {});
}
