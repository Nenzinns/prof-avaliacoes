-- Prof: estrutura da nuvem para a sincronização "como no WhatsApp".
-- O servidor NÃO guarda os dados: cada aparelho tem uma caixa de correio; o que chega
-- é apagado assim que o aparelho de destino recebe.
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este arquivo inteiro e clique em "Run".
-- Pode ser executado de novo sem problema.

-- ---------------------------------------------------------------- aparelhos da conta
create table if not exists public.aparelhos (
  id uuid primary key,                                   -- gerado pelo próprio aparelho
  usuario uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text,                                             -- ex.: "Android · Chrome"
  precisa_copia boolean not null default false,          -- aparelho novo: espera uma cópia completa
  criado_em timestamptz not null default now(),
  visto_em timestamptz not null default now()
);
create index if not exists aparelhos_usuario on public.aparelhos (usuario);

alter table public.aparelhos enable row level security;
drop policy if exists "aparelhos: dono le" on public.aparelhos;
drop policy if exists "aparelhos: dono cria" on public.aparelhos;
drop policy if exists "aparelhos: dono altera" on public.aparelhos;
drop policy if exists "aparelhos: dono apaga" on public.aparelhos;
create policy "aparelhos: dono le" on public.aparelhos for select to authenticated
  using ((select auth.uid()) = usuario);
create policy "aparelhos: dono cria" on public.aparelhos for insert to authenticated
  with check ((select auth.uid()) = usuario);
create policy "aparelhos: dono altera" on public.aparelhos for update to authenticated
  using ((select auth.uid()) = usuario) with check ((select auth.uid()) = usuario);
create policy "aparelhos: dono apaga" on public.aparelhos for delete to authenticated
  using ((select auth.uid()) = usuario);
revoke all on public.aparelhos from anon;
grant select, insert, update, delete on public.aparelhos to authenticated;

-- ---------------------------------------------------------------- caixa de correio (entregas pendentes)
-- Cada linha é uma alteração esperando um aparelho. Apagada assim que ele recebe.
create table if not exists public.caixa (
  id bigint generated always as identity primary key,
  usuario uuid not null default auth.uid() references auth.users (id) on delete cascade,
  para uuid not null references public.aparelhos (id) on delete cascade,  -- aparelho de destino
  de uuid,                                                                  -- aparelho que enviou
  tipo text not null check (tipo in ('questoes', 'avaliacoes', 'colecoes', 'config')),
  item_id text not null,
  dados jsonb,                                   -- conteúdo (vazio quando apagado)
  apagado boolean not null default false,
  versao bigint not null,                        -- vale a mais recente
  criado_em timestamptz not null default now()
);
create index if not exists caixa_para on public.caixa (para, id);

alter table public.caixa enable row level security;
drop policy if exists "caixa: dono le" on public.caixa;
drop policy if exists "caixa: dono cria" on public.caixa;
drop policy if exists "caixa: dono apaga" on public.caixa;
create policy "caixa: dono le" on public.caixa for select to authenticated
  using ((select auth.uid()) = usuario);
-- só entrega para aparelhos da própria conta
create policy "caixa: dono cria" on public.caixa for insert to authenticated
  with check ((select auth.uid()) = usuario
    and exists (select 1 from public.aparelhos a where a.id = para and a.usuario = (select auth.uid())));
create policy "caixa: dono apaga" on public.caixa for delete to authenticated
  using ((select auth.uid()) = usuario);
revoke all on public.caixa from anon;
grant select, insert, delete on public.caixa to authenticated;

-- ---------------------------------------------------------------- imagens em trânsito
-- Pasta privada "imagens"; cada conta só acessa a própria subpasta (o id da conta).
-- As imagens ficam em <conta>/<aparelho de destino>/ e são apagadas quando ele recebe.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagens', 'imagens', false, 10485760,
        array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'])
on conflict (id) do nothing;

drop policy if exists "imagens: dono le" on storage.objects;
drop policy if exists "imagens: dono cria" on storage.objects;
drop policy if exists "imagens: dono altera" on storage.objects;
drop policy if exists "imagens: dono apaga" on storage.objects;
create policy "imagens: dono le" on storage.objects for select to authenticated
  using (bucket_id = 'imagens' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "imagens: dono cria" on storage.objects for insert to authenticated
  with check (bucket_id = 'imagens' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "imagens: dono altera" on storage.objects for update to authenticated
  using (bucket_id = 'imagens' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "imagens: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'imagens' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------- versão anterior
-- A tabela "registros" guardava os dados. O app novo importa o que houver nela para os aparelhos
-- e apaga tudo. Depois que todos os seus aparelhos estiverem atualizados, ela pode ser removida com:
--   drop table if exists public.registros;
