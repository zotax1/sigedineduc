-- =============================================================================
-- SIGED-INEDUC · Migración 0700 · Directorio de investigadores
-- =============================================================================
-- Registro de investigadores de la Facultad de Ciencias de la Educación y del
-- INEDUC: código único, nombre, títulos académicos, afiliación y foto de
-- perfil (en un bucket privado propio, servida con URL firmada).
-- Todo el personal activo consulta el directorio; solo los administradores
-- registran y editan.
-- =============================================================================

create type public.researcher_affiliation as enum ('FACULTAD', 'INEDUC', 'AMBOS');

create table public.researchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9._/-]{1,29}$'),
  full_name text not null check (length(btrim(full_name)) between 3 and 200),
  academic_titles text[] not null default '{}',
  affiliation public.researcher_affiliation not null,
  photo_path text,
  search_text text not null default '',
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint researchers_titles_max check (cardinality(academic_titles) <= 20),
  constraint researchers_photo_folder check (photo_path is null or photo_path like id::text || '/%')
);

create index researchers_affiliation_idx on public.researchers (affiliation);
create index researchers_name_idx on public.researchers (full_name);
create index researchers_search_trgm_idx on public.researchers using gin (search_text extensions.gin_trgm_ops);

create or replace function private.researchers_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_clean text[] := '{}';
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  elsif new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'SIGED_PROTEGIDO: Se intentó modificar un campo inmutable del investigador.' using errcode = 'P0001';
  end if;

  new.code := upper(btrim(new.code));
  new.full_name := regexp_replace(btrim(new.full_name), '\s+', ' ', 'g');

  foreach v_title in array coalesce(new.academic_titles, '{}') loop
    v_title := regexp_replace(btrim(v_title), '\s+', ' ', 'g');
    if v_title = '' then
      continue;
    end if;
    if length(v_title) > 200 then
      raise exception 'SIGED_VALIDACION: Un título académico supera los 200 caracteres.' using errcode = 'P0001';
    end if;
    if not v_title = any (v_clean) then
      v_clean := v_clean || v_title;
    end if;
  end loop;
  new.academic_titles := v_clean;

  new.search_text := public.normalize_search(concat_ws(' ', new.code, new.full_name, array_to_string(new.academic_titles, ' ')));
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create trigger researchers_before_write
  before insert or update on public.researchers
  for each row execute function private.researchers_before_write();

create trigger researchers_block_delete
  before delete on public.researchers
  for each row execute function private.block_delete_unless_purge();

create trigger audit_researchers after insert or update or delete on public.researchers
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- RLS y permisos
-- -----------------------------------------------------------------------------
alter table public.researchers enable row level security;

create policy researchers_select on public.researchers for select to authenticated
  using ((select private.is_active_user()));
create policy researchers_insert on public.researchers for insert to authenticated
  with check ((select private.is_admin()));
create policy researchers_update on public.researchers for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

revoke all on public.researchers from anon, authenticated;
grant select, insert, update on public.researchers to authenticated;
revoke all on function private.researchers_before_write() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Fotos de perfil: bucket privado «investigadores», carpeta <investigador>/
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('investigadores', 'investigadores', false, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy siged_investigadores_select on storage.objects for select to authenticated
  using (bucket_id = 'investigadores' and (select private.is_active_user()));

create policy siged_investigadores_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'investigadores'
    and (select private.is_admin())
    and exists (select 1 from public.researchers r where r.id::text = (storage.foldername(objects.name))[1])
  );

-- Solo se borran fotos que ya no están en uso (reemplazadas o huérfanas).
create policy siged_investigadores_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'investigadores'
    and (select private.is_admin())
    and not exists (select 1 from public.researchers r where r.photo_path = objects.name)
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.researchers;
  end if;
end
$$;
