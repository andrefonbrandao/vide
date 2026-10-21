-- Esquema PREVISTO para a fase de login e sincronização (Supabase/Postgres).
-- AINDA NÃO É USADO pelo protótipo. Os nomes das colunas são os mesmos
-- dos registros guardados no navegador (src/dados/modelo.ts), para que a
-- sincronização copie tudo sem conversão.

create table if not exists diplomas (
  id uuid primary key,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  sigla text not null,                -- 'cpc'
  nome text not null,
  apelidos text[] not null default '{}',
  origem_url text,
  versao_em timestamptz not null,
  total_artigos integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz               -- exclusão "suave", necessária para sincronizar
);

create table if not exists itens (
  id uuid primary key,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('legislacao', 'precedente', 'conceito', 'imagem', 'grafico')),
  chave text not null,                  -- 'cpc:art:1015'
  titulo text not null,                 -- 'art. 1.015 CPC'
  rotulo text,
  gatilhos text[] not null default '{}',
  etiquetas text[] not null default '{}',
  conteudo jsonb not null,              -- formato depende do tipo (ex.: 'legislacao/artigo@1')
  origem jsonb not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create index if not exists itens_usuario_atualizado on itens (usuario_id, atualizado_em);
create index if not exists itens_chave on itens (usuario_id, chave);

-- Cada pessoa só vê e altera o próprio acervo.
alter table diplomas enable row level security;
alter table itens enable row level security;
create policy "dono dos diplomas" on diplomas for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
create policy "dono dos itens" on itens for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- Sincronização prevista: o aparelho envia o que mudou desde a última vez
-- (atualizado_em > ultima_sincronizacao) e baixa o que mudou no servidor.
-- O registro de teste fica só no aparelho por enquanto.
