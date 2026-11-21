-- Prof: estrutura da nuvem para a sincronização.
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este arquivo inteiro e clique em "Run".
-- Pode ser executado de novo sem problema (não apaga dados).

-- ---------------------------------------------------------------- tabela única de registros
-- Cada linha é uma questão, avaliação, gabarito ou configuração de um professor.
create table if not exists public.registros (
  usuario uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('questoes', 'avaliacoes', 'colecoes', 'config')),
  id text not null,
  dados jsonb,                                   -- conteúdo (vazio quando apagado)
  apagado boolean not null default false,        -- apagado num aparelho: some dos outros
  atualizado_em bigint not null,                 -- versão (milissegundos): vale a mais recente
  servidor_em timestamptz not null default clock_timestamp(), -- quando chegou ao servidor
  primary key (usuario, tipo, id)
);
create index if not exists registros_usuario_servidor on public.registros (usuario, servidor_em);

-- Uma versão mais antiga nunca sobrescreve uma mais nova; marca a hora de chegada.
create or replace function public.registros_antes_de_gravar()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.atualizado_em <= old.atualizado_em then
      return null; -- ignora: o servidor já tem esta versão ou uma mais nova
    end if;
    new.usuario := old.usuario;
  end if;
  new.servidor_em := clock_timestamp();
  return new;
end $$;

drop trigger if exists registros_antes_de_gravar on public.registros;
create trigger registros_antes_de_gravar
  before insert or update on public.registros
  for each row execute function public.registros_antes_de_gravar();

-- Segurança: cada conta só vê e altera os próprios registros.
alter table public.registros enable row level security;

drop policy if exists "registros: dono le" on public.registros;
drop policy if exists "registros: dono cria" on public.registros;
drop policy if exists "registros: dono altera" on public.registros;
drop policy if exists "registros: dono apaga" on public.registros;
create policy "registros: dono le" on public.registros for select to authenticated
  using ((select auth.uid()) = usuario);
create policy "registros: dono cria" on public.registros for insert to authenticated
  with check ((select auth.uid()) = usuario);
create policy "registros: dono altera" on public.registros for update to authenticated
  using ((select auth.uid()) = usuario) with check ((select auth.uid()) = usuario);
create policy "registros: dono apaga" on public.registros for delete to authenticated
  using ((select auth.uid()) = usuario);

revoke all on public.registros from anon;
grant select, insert, update, delete on public.registros to authenticated;

-- ---------------------------------------------------------------- imagens das questões
-- Pasta privada "imagens"; cada conta só acessa a própria subpasta (o id da conta).
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
