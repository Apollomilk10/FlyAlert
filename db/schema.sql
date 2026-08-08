-- Alerta de Passagem — schema Supabase
-- Rode isso no SQL Editor do Supabase.

-- Rotas que você quer monitorar.
create table if not exists watches (
  id              uuid primary key default gen_random_uuid(),
  label           text not null,              -- "GRU -> LIS janeiro"
  departure_id    text not null,              -- IATA, ex: GRU
  arrival_id      text not null,              -- IATA, ex: LIS
  outbound_date   date not null,
  return_date     date,                       -- null = só ida
  trip_type       smallint not null default 1,-- 1 = ida e volta, 2 = só ida
  currency        text not null default 'BRL',
  target_price    numeric,                    -- seu teto. null = usa só a faixa tipica do Google
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Toda consulta feita vira uma linha aqui.
create table if not exists price_checks (
  id              bigserial primary key,
  watch_id        uuid not null references watches(id) on delete cascade,
  price           numeric not null,
  currency        text not null,
  price_level     text,                       -- low / typical / high (Google Flights)
  typical_low     numeric,
  typical_high    numeric,
  airline         text,
  duration_min    int,
  booking_url     text,
  raw             jsonb,
  checked_at      timestamptz not null default now()
);

create index if not exists price_checks_watch_time
  on price_checks (watch_id, checked_at desc);

-- Alertas disparados, pra não repetir push a cada 6h.
create table if not exists alerts_sent (
  id              bigserial primary key,
  watch_id        uuid not null references watches(id) on delete cascade,
  price           numeric not null,
  reason          text not null,              -- target / below_typical / all_time_low
  sent_at         timestamptz not null default now()
);

create index if not exists alerts_sent_watch_time
  on alerts_sent (watch_id, sent_at desc);

-- Leitura pública do histórico pro front (PWA). Escrita só via service_role.
alter table watches      enable row level security;
alter table price_checks enable row level security;
alter table alerts_sent  enable row level security;

create policy "leitura publica de watches"
  on watches for select using (true);

create policy "leitura publica de price_checks"
  on price_checks for select using (true);

-- Exemplo de rota. Ajuste e rode.
-- insert into watches (label, departure_id, arrival_id, outbound_date, return_date, target_price)
-- values ('GRU -> LIS', 'GRU', 'LIS', '2027-01-15', '2027-02-05', 3500);
