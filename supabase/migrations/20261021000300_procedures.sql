-- =============================================================================
-- SIGED-INEDUC · Migración 0300 · Trámites y procedimientos
-- =============================================================================
-- Un documento puede generar varios trámites; un trámite puede existir sin
-- documento asociado. "Vencido" es un indicador calculado (fecha límite y
-- estado), no un estado del trámite.
-- =============================================================================

create table public.procedure_counters (
  year integer primary key,
  last_value integer not null default 0
);

create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('TMP-' || gen_random_uuid()),
  title text not null check (length(btrim(title)) between 3 and 200),
  description text check (description is null or length(description) <= 5000),
  document_id uuid references public.documents (id),
  category_id uuid references public.procedure_categories (id),
  responsible_id uuid references public.profiles (id),
  responsible_department_id uuid not null references public.departments (id),
  status public.procedure_status not null default 'PENDIENTE',
  priority_code text not null default 'MEDIA' references public.priorities (code),
  start_date date not null default private.today_do(),
  due_date date,
  next_action text check (next_action is null or length(next_action) <= 500),
  notes text check (notes is null or length(notes) <= 5000),
  completed_at timestamptz,
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (
    public.normalize_search(
      coalesce(reference, '') || ' ' || coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' || coalesce(next_action, '') || ' ' || coalesce(notes, '')
    )
  ) stored,
  constraint procedures_due_after_start check (due_date is null or due_date >= start_date),
  constraint procedures_completed_consistent check ((status = 'COMPLETADO') = (completed_at is not null))
);

create index procedures_status_idx on public.procedures (status);
create index procedures_due_date_idx on public.procedures (due_date) where due_date is not null;
create index procedures_responsible_idx on public.procedures (responsible_id);
create index procedures_department_idx on public.procedures (responsible_department_id);
create index procedures_document_idx on public.procedures (document_id);
create index procedures_priority_idx on public.procedures (priority_code);
create index procedures_search_trgm_idx on public.procedures using gin (search_text extensions.gin_trgm_ops);

create table public.procedure_events (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  procedure_id uuid not null references public.procedures (id) on delete cascade,
  event_type public.procedure_event_type not null,
  from_status public.procedure_status,
  to_status public.procedure_status,
  from_responsible_id uuid references public.profiles (id),
  to_responsible_id uuid references public.profiles (id),
  changes jsonb,
  notes text check (notes is null or length(notes) <= 2000),
  recorded_by uuid references public.profiles (id),
  occurred_at timestamptz not null default now()
);

create index procedure_events_procedure_idx on public.procedure_events (procedure_id, seq);
create index procedure_events_occurred_idx on public.procedure_events (occurred_at desc);

create or replace function private.can_view_procedure(p_procedure_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.procedures pr
    where pr.id = p_procedure_id
      and private.is_active_user()
      and (pr.document_id is null or private.can_view_document(pr.document_id) or pr.responsible_id = auth.uid())
  )
$$;

create or replace function private.next_procedure_reference()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year integer := extract(year from (now() at time zone 'America/Santo_Domingo'))::integer;
  v_value integer;
begin
  insert into public.procedure_counters as c (year, last_value) values (v_year, 1)
  on conflict (year) do update set last_value = c.last_value + 1
  returning c.last_value into v_value;
  return format('TRM-%s-%s', v_year, lpad(v_value::text, 5, '0'));
end;
$$;

create or replace function private.procedures_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.reference := private.next_procedure_reference();
    new.created_by := auth.uid();
    new.created_at := now();
    new.start_date := coalesce(new.start_date, private.today_do());
  else
    if new.reference is distinct from old.reference
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
       or new.is_demo is distinct from old.is_demo then
      raise exception 'SIGED_PROTEGIDO: Se intentó modificar un campo inmutable del trámite.' using errcode = 'P0001';
    end if;
  end if;

  if new.responsible_id is not null
     and (tg_op = 'INSERT' or new.responsible_id is distinct from old.responsible_id)
     and not exists (select 1 from public.profiles where id = new.responsible_id and status = 'ACTIVO') then
    raise exception 'SIGED_VALIDACION: El responsable seleccionado no es un usuario activo.' using errcode = '23503';
  end if;

  if (tg_op = 'INSERT' or new.responsible_department_id is distinct from old.responsible_department_id)
     and not exists (select 1 from public.departments where id = new.responsible_department_id and active) then
    raise exception 'SIGED_VALIDACION: La dependencia responsable no está activa.' using errcode = '23503';
  end if;

  if new.document_id is not null
     and (tg_op = 'INSERT' or new.document_id is distinct from old.document_id)
     and not exists (select 1 from public.documents where id = new.document_id and status <> 'ARCHIVADO') then
    raise exception 'SIGED_VALIDACION: El documento relacionado no existe o está archivado.' using errcode = '23503';
  end if;

  -- La fecha de completado la fija el servidor.
  if new.status = 'COMPLETADO' then
    new.completed_at := case
      when tg_op = 'UPDATE' and old.status = 'COMPLETADO' then old.completed_at
      else now()
    end;
  else
    new.completed_at := null;
  end if;

  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create trigger procedures_before_write
  before insert or update on public.procedures
  for each row execute function private.procedures_before_write();

create trigger procedures_block_delete
  before delete on public.procedures
  for each row execute function private.block_delete_unless_purge();

-- Historial automático: cualquier cambio queda registrado, también si se
-- hace por una vía distinta de las funciones RPC.
create or replace function private.procedures_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(current_setting('siged.event_note', true), '');
  v_changes jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.procedure_events (procedure_id, event_type, to_status, to_responsible_id, notes)
    values (new.id, 'CREACION', new.status, new.responsible_id, v_note);
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into public.procedure_events (procedure_id, event_type, from_status, to_status, notes)
    values (new.id, 'CAMBIO_ESTADO', old.status, new.status, v_note);
    v_note := null;
  end if;

  if new.responsible_id is distinct from old.responsible_id then
    insert into public.procedure_events (procedure_id, event_type, from_status, to_status, from_responsible_id, to_responsible_id, notes)
    values (new.id, 'REASIGNACION', new.status, new.status, old.responsible_id, new.responsible_id, v_note);
    v_note := null;
  end if;

  select jsonb_object_agg(n.key, jsonb_build_object('anterior', o.value, 'nuevo', n.value))
    into v_changes
  from jsonb_each(to_jsonb(new) - array['status','responsible_id','updated_at','updated_by','completed_at','search_text']) n
  join jsonb_each(to_jsonb(old)) o on o.key = n.key
  where n.value is distinct from o.value;

  if v_changes is not null then
    insert into public.procedure_events (procedure_id, event_type, from_status, to_status, changes, notes)
    values (new.id, 'ACTUALIZACION', new.status, new.status, v_changes, v_note);
  end if;
  return null;
end;
$$;

create trigger procedures_after_write
  after insert or update on public.procedures
  for each row execute function private.procedures_after_write();

create or replace function private.procedure_events_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.recorded_by := auth.uid();
  new.occurred_at := now();
  return new;
end;
$$;

create trigger procedure_events_before_insert
  before insert on public.procedure_events
  for each row execute function private.procedure_events_before_insert();

create trigger procedure_events_append_only
  before update or delete on public.procedure_events
  for each row execute function private.block_append_only();

-- Cambio de estado con observación (atómico).
create or replace function public.change_procedure_status(
  p_procedure_id uuid,
  p_status public.procedure_status,
  p_notes text default null
)
returns public.procedures
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.procedures;
begin
  perform private.require_admin();
  select * into v_row from public.procedures where id = p_procedure_id for update;
  if not found then
    raise exception 'SIGED_NO_ENCONTRADO: El trámite no existe.' using errcode = 'P0002';
  end if;
  if v_row.status = p_status then
    raise exception 'SIGED_VALIDACION: El trámite ya se encuentra en ese estado.' using errcode = 'P0001';
  end if;
  if p_status = 'CANCELADO' and length(btrim(coalesce(p_notes, ''))) < 5 then
    raise exception 'SIGED_VALIDACION: Indique el motivo de la cancelación.' using errcode = 'P0001';
  end if;

  perform set_config('siged.event_note', coalesce(btrim(p_notes), ''), true);
  update public.procedures set status = p_status where id = p_procedure_id returning * into v_row;
  perform set_config('siged.event_note', '', true);
  return v_row;
end;
$$;

create or replace function public.add_procedure_observation(p_procedure_id uuid, p_notes text)
returns public.procedure_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.procedure_events;
  v_status public.procedure_status;
begin
  perform private.require_admin();
  if p_notes is null or length(btrim(p_notes)) < 3 then
    raise exception 'SIGED_VALIDACION: Escriba la observación.' using errcode = 'P0001';
  end if;
  select status into v_status from public.procedures where id = p_procedure_id;
  if not found then
    raise exception 'SIGED_NO_ENCONTRADO: El trámite no existe.' using errcode = 'P0002';
  end if;
  insert into public.procedure_events (procedure_id, event_type, from_status, to_status, notes)
  values (p_procedure_id, 'OBSERVACION', v_status, v_status, btrim(p_notes))
  returning * into v_event;
  return v_event;
end;
$$;
