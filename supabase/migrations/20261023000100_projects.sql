-- =============================================================================
-- SIGED-INEDUC · Migración 0600 · Proyectos de investigación
-- =============================================================================
-- Expedientes de proyectos de investigación de la Facultad: datos del
-- proyecto, documentos especiales (oficios, informes de avance, presupuestos,
-- avales éticos, cartas institucionales…) con su propio estado de trámite,
-- archivos privados y un historial cronológico de solo anexado.
--
-- Reglas:
--  * Solo los administradores registran y modifican; el personal de consulta
--    visualiza (excepto las notas internas).
--  * Los cambios de estado (del proyecto y de cada documento) solo se hacen
--    mediante las funciones change_project_status / change_project_document_status,
--    que registran el evento en la misma transacción.
--  * Nada se elimina: los archivos se retiran con motivo.
-- =============================================================================

create type public.project_status as enum (
  'EN_FORMULACION', 'EN_TRAMITE', 'APROBADO', 'EN_EJECUCION', 'FINALIZADO', 'RECHAZADO', 'CANCELADO'
);

create type public.project_document_kind as enum (
  'OFICIO', 'PROPUESTA', 'INFORME_AVANCE', 'INFORME_FINAL', 'PRESUPUESTO', 'AVAL_ETICO',
  'CARTA_INSTITUCIONAL', 'OTRO'
);

create type public.project_document_status as enum (
  'INGRESADO', 'EN_REVISION', 'PENDIENTE_FIRMA', 'ENVIADO_A_VIA', 'DEVUELTO', 'APROBADO', 'COMPLETADO'
);

create type public.project_event_type as enum (
  'CREACION',              -- alta del proyecto
  'CAMBIO_ESTADO',         -- estado del trámite del proyecto
  'ACTUALIZACION',         -- edición de datos (proyecto o documento)
  'DOCUMENTO_REGISTRADO',  -- alta de un documento especial
  'DOCUMENTO_ESTADO',      -- estado del trámite de un documento
  'ARCHIVO_CARGADO',
  'ARCHIVO_RETIRADO',
  'OBSERVACION'            -- nota de seguimiento (puede ser interna)
);

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9._/-]{1,39}$'),
  title text not null check (length(btrim(title)) between 5 and 300),
  summary text check (summary is null or length(summary) <= 5000),
  principal_investigator text not null check (length(btrim(principal_investigator)) between 3 and 200),
  co_investigators text[] not null default '{}',
  unit text not null default 'Facultad de Ciencias de la Educación' check (length(btrim(unit)) between 2 and 200),
  funding_source text check (funding_source is null or length(btrim(funding_source)) between 2 and 200),
  year integer not null default extract(year from (now() at time zone 'America/Santo_Domingo'))::integer
    check (year between 2000 and 2100),
  status public.project_status not null default 'EN_TRAMITE',
  status_changed_at timestamptz not null default now(),
  is_demo boolean not null default false,
  search_text text not null default '',
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_co_investigators_max check (cardinality(co_investigators) <= 30)
);

create index projects_status_idx on public.projects (status);
create index projects_year_idx on public.projects (year);
create index projects_pi_idx on public.projects (principal_investigator);
create index projects_funding_idx on public.projects (funding_source);
create index projects_updated_idx on public.projects (updated_at desc);
create index projects_search_trgm_idx on public.projects using gin (search_text extensions.gin_trgm_ops);

create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind public.project_document_kind not null,
  title text not null check (length(btrim(title)) between 3 and 200),
  reference text check (reference is null or length(btrim(reference)) between 1 and 100),
  status public.project_document_status not null default 'INGRESADO',
  priority_code text not null default 'MEDIA' references public.priorities (code),
  due_date date,
  notes text check (notes is null or length(notes) <= 2000),
  status_changed_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_documents_project_idx on public.project_documents (project_id);
create index project_documents_status_idx on public.project_documents (status);
create index project_documents_due_idx on public.project_documents (due_date) where due_date is not null;

create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  project_document_id uuid not null references public.project_documents (id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null check (length(original_filename) between 1 and 255),
  mime_type text not null,
  extension text not null,
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by uuid references public.profiles (id),
  uploaded_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references public.profiles (id),
  removal_reason text,
  constraint project_files_path_prefix check (
    storage_path like 'proyectos/' || project_id::text || '/' || project_document_id::text || '/%'
  ),
  constraint project_files_removal_consistent check (
    (removed_at is null and removed_by is null and removal_reason is null)
    or (removed_at is not null and removal_reason is not null and length(btrim(removal_reason)) >= 5)
  )
);

create index project_files_document_idx on public.project_files (project_document_id);
create index project_files_project_idx on public.project_files (project_id);

create table public.project_events (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  project_id uuid not null references public.projects (id) on delete cascade,
  project_document_id uuid references public.project_documents (id) on delete cascade,
  file_id uuid references public.project_files (id) on delete cascade,
  event_type public.project_event_type not null,
  -- Estado anterior/nuevo del proyecto o del documento (según event_type).
  from_status text,
  to_status text,
  changes jsonb,
  notes text check (notes is null or length(notes) <= 2000),
  is_internal boolean not null default false,
  recorded_by uuid references public.profiles (id),
  occurred_at timestamptz not null default now(),
  constraint project_events_internal_only_notes check (not is_internal or event_type = 'OBSERVACION')
);

create index project_events_project_idx on public.project_events (project_id, seq);
create index project_events_document_idx on public.project_events (project_document_id);
create index project_events_occurred_idx on public.project_events (occurred_at desc);

-- -----------------------------------------------------------------------------
-- Proyectos: validación, campos del servidor e historial automático
-- -----------------------------------------------------------------------------
create or replace function private.projects_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_clean text[] := '{}';
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    new.status_changed_at := now();
  else
    if new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
       or new.is_demo is distinct from old.is_demo then
      raise exception 'SIGED_PROTEGIDO: Se intentó modificar un campo inmutable del proyecto.' using errcode = 'P0001';
    end if;
    if new.status is distinct from old.status then
      if not private.in_workflow() then
        raise exception 'SIGED_PROTEGIDO: El estado del proyecto solo cambia mediante «Cambiar estado», que lo registra en el historial.'
          using errcode = 'P0001';
      end if;
      new.status_changed_at := now();
    else
      new.status_changed_at := old.status_changed_at;
    end if;
  end if;

  new.code := upper(btrim(new.code));
  new.title := btrim(new.title);
  new.principal_investigator := btrim(new.principal_investigator);
  new.unit := btrim(new.unit);
  new.funding_source := nullif(btrim(new.funding_source), '');
  new.summary := nullif(btrim(new.summary), '');

  foreach v_name in array coalesce(new.co_investigators, '{}') loop
    v_name := btrim(v_name);
    if v_name = '' then
      continue;
    end if;
    if length(v_name) > 200 then
      raise exception 'SIGED_VALIDACION: El nombre de un coinvestigador supera los 200 caracteres.' using errcode = 'P0001';
    end if;
    if not v_name = any (v_clean) then
      v_clean := v_clean || v_name;
    end if;
  end loop;
  new.co_investigators := v_clean;

  new.search_text := public.normalize_search(concat_ws(' ',
    new.code, new.title, new.summary, new.principal_investigator,
    array_to_string(new.co_investigators, ' '), new.unit, new.funding_source));
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_before_write
  before insert or update on public.projects
  for each row execute function private.projects_before_write();

create trigger projects_block_delete
  before delete on public.projects
  for each row execute function private.block_delete_unless_purge();

create or replace function private.projects_after_write()
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
    insert into public.project_events (project_id, event_type, to_status, notes)
    values (new.id, 'CREACION', new.status::text, v_note);
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into public.project_events (project_id, event_type, from_status, to_status, notes)
    values (new.id, 'CAMBIO_ESTADO', old.status::text, new.status::text, v_note);
  end if;

  select jsonb_object_agg(n.key, jsonb_build_object('anterior', o.value, 'nuevo', n.value))
    into v_changes
  from jsonb_each(to_jsonb(new) - array['status', 'status_changed_at', 'updated_at', 'updated_by', 'search_text']) n
  join jsonb_each(to_jsonb(old)) o on o.key = n.key
  where n.value is distinct from o.value;

  if v_changes is not null then
    insert into public.project_events (project_id, event_type, from_status, to_status, changes)
    values (new.id, 'ACTUALIZACION', new.status::text, new.status::text, v_changes);
  end if;
  return null;
end;
$$;

create trigger projects_after_write
  after insert or update on public.projects
  for each row execute function private.projects_after_write();

-- -----------------------------------------------------------------------------
-- Documentos especiales del proyecto
-- -----------------------------------------------------------------------------
create or replace function private.project_documents_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    new.status_changed_at := now();
  else
    if new.project_id is distinct from old.project_id
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'SIGED_PROTEGIDO: Se intentó modificar un campo inmutable del documento.' using errcode = 'P0001';
    end if;
    if new.status is distinct from old.status then
      if not private.in_workflow() then
        raise exception 'SIGED_PROTEGIDO: El estado del documento solo cambia mediante «Actualizar estado», que lo registra en el historial.'
          using errcode = 'P0001';
      end if;
      new.status_changed_at := now();
    else
      new.status_changed_at := old.status_changed_at;
    end if;
  end if;

  if (tg_op = 'INSERT' or new.priority_code is distinct from old.priority_code)
     and not exists (select 1 from public.priorities where code = new.priority_code and active) then
    raise exception 'SIGED_VALIDACION: La prioridad seleccionada no está activa.' using errcode = '23503';
  end if;

  new.title := btrim(new.title);
  new.reference := nullif(btrim(new.reference), '');
  new.notes := nullif(btrim(new.notes), '');
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create trigger project_documents_before_write
  before insert or update on public.project_documents
  for each row execute function private.project_documents_before_write();

create trigger project_documents_block_delete
  before delete on public.project_documents
  for each row execute function private.block_delete_unless_purge();

create or replace function private.project_documents_after_write()
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
    insert into public.project_events (project_id, project_document_id, event_type, to_status, notes)
    values (new.project_id, new.id, 'DOCUMENTO_REGISTRADO', new.status::text, v_note);
  else
    if new.status is distinct from old.status then
      insert into public.project_events (project_id, project_document_id, event_type, from_status, to_status, notes)
      values (new.project_id, new.id, 'DOCUMENTO_ESTADO', old.status::text, new.status::text, v_note);
    end if;

    select jsonb_object_agg(n.key, jsonb_build_object('anterior', o.value, 'nuevo', n.value))
      into v_changes
    from jsonb_each(to_jsonb(new) - array['status', 'status_changed_at', 'updated_at', 'updated_by']) n
    join jsonb_each(to_jsonb(old)) o on o.key = n.key
    where n.value is distinct from o.value;

    if v_changes is not null then
      insert into public.project_events (project_id, project_document_id, event_type, from_status, to_status, changes)
      values (new.project_id, new.id, 'ACTUALIZACION', new.status::text, new.status::text, v_changes);
    end if;
  end if;

  -- La actividad de los documentos actualiza el expediente.
  update public.projects set updated_at = now() where id = new.project_id;
  return null;
end;
$$;

create trigger project_documents_after_write
  after insert or update on public.project_documents
  for each row execute function private.project_documents_after_write();

-- -----------------------------------------------------------------------------
-- Archivos (metadatos; el contenido está en el bucket privado «documentos»,
-- carpeta proyectos/<proyecto>/<documento>/)
-- -----------------------------------------------------------------------------
create or replace function private.project_files_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.uploaded_by := auth.uid();
    new.uploaded_at := now();
    new.removed_at := null;
    new.removed_by := null;
    new.removal_reason := null;
    if not exists (
      select 1 from public.project_documents
      where id = new.project_document_id and project_id = new.project_id
    ) then
      raise exception 'SIGED_VALIDACION: El documento no pertenece al proyecto.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if private.purge_allowed() then
      return old;
    end if;
    raise exception 'SIGED_PROTEGIDO: Los archivos no se eliminan del registro; utilice la opción de retirar.' using errcode = 'P0001';
  end if;

  if coalesce(current_setting('siged.attachment_removal', true), '') <> 'on' then
    raise exception 'SIGED_PROTEGIDO: Los metadatos del archivo no pueden modificarse.' using errcode = 'P0001';
  end if;
  if old.removed_at is not null then
    raise exception 'SIGED_PROTEGIDO: El archivo ya fue retirado.' using errcode = 'P0001';
  end if;
  if (to_jsonb(new) - array['removed_at', 'removed_by', 'removal_reason'])
     is distinct from (to_jsonb(old) - array['removed_at', 'removed_by', 'removal_reason']) then
    raise exception 'SIGED_PROTEGIDO: Solo puede registrarse el retiro del archivo.' using errcode = 'P0001';
  end if;
  new.removed_at := now();
  new.removed_by := auth.uid();
  return new;
end;
$$;

create trigger project_files_before_write
  before insert or update or delete on public.project_files
  for each row execute function private.project_files_before_write();

create or replace function private.project_files_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.project_events (project_id, project_document_id, file_id, event_type, notes)
    values (new.project_id, new.project_document_id, new.id, 'ARCHIVO_CARGADO', new.original_filename);
  elsif new.removed_at is not null and old.removed_at is null then
    insert into public.project_events (project_id, project_document_id, file_id, event_type, notes)
    values (new.project_id, new.project_document_id, new.id, 'ARCHIVO_RETIRADO', new.removal_reason);
  end if;
  update public.projects set updated_at = now() where id = new.project_id;
  return null;
end;
$$;

create trigger project_files_after_write
  after insert or update on public.project_files
  for each row execute function private.project_files_after_write();

-- -----------------------------------------------------------------------------
-- Historial (solo anexar; el autor y la fecha los fija el servidor)
-- -----------------------------------------------------------------------------
create or replace function private.project_events_before_insert()
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

create trigger project_events_before_insert
  before insert on public.project_events
  for each row execute function private.project_events_before_insert();

create trigger project_events_append_only
  before update or delete on public.project_events
  for each row execute function private.block_append_only();

-- -----------------------------------------------------------------------------
-- Operaciones (RPC): validan el rol y son atómicas
-- -----------------------------------------------------------------------------
create or replace function public.change_project_status(
  p_project_id uuid,
  p_status public.project_status,
  p_notes text default null
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.projects;
begin
  perform private.require_admin();
  select * into v_row from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'SIGED_NO_ENCONTRADO: El proyecto no existe.' using errcode = 'P0002';
  end if;
  if v_row.status = p_status then
    raise exception 'SIGED_VALIDACION: El proyecto ya se encuentra en ese estado.' using errcode = 'P0001';
  end if;
  if p_status in ('RECHAZADO', 'CANCELADO') and length(btrim(coalesce(p_notes, ''))) < 5 then
    raise exception 'SIGED_VALIDACION: Indique el motivo (mínimo 5 caracteres).' using errcode = 'P0001';
  end if;

  perform set_config('siged.workflow', 'on', true);
  perform set_config('siged.event_note', coalesce(btrim(p_notes), ''), true);
  update public.projects set status = p_status where id = p_project_id returning * into v_row;
  perform set_config('siged.event_note', '', true);
  perform set_config('siged.workflow', 'off', true);
  return v_row;
end;
$$;

create or replace function public.change_project_document_status(
  p_document_id uuid,
  p_status public.project_document_status,
  p_notes text default null
)
returns public.project_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.project_documents;
begin
  perform private.require_admin();
  select * into v_row from public.project_documents where id = p_document_id for update;
  if not found then
    raise exception 'SIGED_NO_ENCONTRADO: El documento no existe.' using errcode = 'P0002';
  end if;
  if v_row.status = p_status then
    raise exception 'SIGED_VALIDACION: El documento ya se encuentra en ese estado.' using errcode = 'P0001';
  end if;
  if p_status = 'DEVUELTO' and length(btrim(coalesce(p_notes, ''))) < 5 then
    raise exception 'SIGED_VALIDACION: Indique las observaciones de la devolución (mínimo 5 caracteres).' using errcode = 'P0001';
  end if;

  perform set_config('siged.workflow', 'on', true);
  perform set_config('siged.event_note', coalesce(btrim(p_notes), ''), true);
  update public.project_documents set status = p_status where id = p_document_id returning * into v_row;
  perform set_config('siged.event_note', '', true);
  perform set_config('siged.workflow', 'off', true);
  return v_row;
end;
$$;

create or replace function public.add_project_note(
  p_project_id uuid,
  p_notes text,
  p_internal boolean default false,
  p_document_id uuid default null
)
returns public.project_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.project_events;
begin
  perform private.require_admin();
  if p_notes is null or length(btrim(p_notes)) < 3 then
    raise exception 'SIGED_VALIDACION: Escriba la observación.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception 'SIGED_NO_ENCONTRADO: El proyecto no existe.' using errcode = 'P0002';
  end if;
  if p_document_id is not null and not exists (
    select 1 from public.project_documents where id = p_document_id and project_id = p_project_id
  ) then
    raise exception 'SIGED_VALIDACION: El documento no pertenece al proyecto.' using errcode = 'P0001';
  end if;
  insert into public.project_events (project_id, project_document_id, event_type, notes, is_internal)
  values (p_project_id, p_document_id, 'OBSERVACION', btrim(p_notes), coalesce(p_internal, false))
  returning * into v_event;
  update public.projects set updated_at = now() where id = p_project_id;
  return v_event;
end;
$$;

create or replace function public.remove_project_file(p_file_id uuid, p_reason text)
returns public.project_files
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.project_files;
begin
  perform private.require_admin();
  if p_reason is null or length(btrim(p_reason)) < 5 then
    raise exception 'SIGED_VALIDACION: Indique el motivo del retiro (mínimo 5 caracteres).' using errcode = 'P0001';
  end if;
  perform set_config('siged.attachment_removal', 'on', true);
  update public.project_files
    set removed_at = now(), removed_by = auth.uid(), removal_reason = btrim(p_reason)
  where id = p_file_id
  returning * into v_row;
  perform set_config('siged.attachment_removal', 'off', true);
  if v_row.id is null then
    raise exception 'SIGED_NO_ENCONTRADO: El archivo no existe.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- Vistas de consulta (security_invoker: aplican la RLS de quien consulta)
-- -----------------------------------------------------------------------------
create or replace view public.project_document_overview
with (security_invoker = true) as
select
  d.id,
  d.project_id,
  p.code as project_code,
  p.title as project_title,
  d.kind,
  d.title,
  d.reference,
  d.status,
  d.priority_code,
  pr.name as priority_name,
  pr.weight as priority_weight,
  d.due_date,
  d.notes,
  d.status_changed_at,
  d.created_by,
  cb.full_name as created_by_name,
  d.created_at,
  d.updated_at,
  (d.status not in ('APROBADO', 'COMPLETADO')) as is_pending,
  (d.status = 'PENDIENTE_FIRMA') as is_pending_signature,
  (d.status not in ('APROBADO', 'COMPLETADO') and d.priority_code in ('ALTA', 'URGENTE')) as is_priority,
  (d.status not in ('APROBADO', 'COMPLETADO') and d.due_date is not null and d.due_date < private.today_do()) as is_overdue,
  (d.status not in ('APROBADO', 'COMPLETADO') and d.due_date is not null
     and d.due_date between private.today_do() and private.today_do() + s.deadline_warning_days) as is_due_soon,
  case when d.due_date is null then null else d.due_date - private.today_do() end as days_to_due,
  (select count(*) from public.project_files f where f.project_document_id = d.id and f.removed_at is null)::integer as files_count
from public.project_documents d
join public.projects p on p.id = d.project_id
cross join public.app_settings s
left join public.priorities pr on pr.code = d.priority_code
left join public.profiles cb on cb.id = d.created_by;

create or replace view public.project_overview
with (security_invoker = true) as
select
  p.id,
  p.code,
  p.title,
  p.summary,
  p.principal_investigator,
  p.co_investigators,
  p.unit,
  p.funding_source,
  p.year,
  p.status,
  p.status_changed_at,
  p.created_by,
  cb.full_name as created_by_name,
  p.updated_by,
  ub.full_name as updated_by_name,
  p.created_at,
  p.updated_at,
  p.search_text,
  (p.status in ('APROBADO', 'EN_EJECUCION', 'FINALIZADO')) as is_approved,
  coalesce(agg.documents_total, 0) as documents_total,
  coalesce(agg.documents_pending, 0) as documents_pending,
  coalesce(agg.documents_pending_signature, 0) as documents_pending_signature,
  coalesce(agg.documents_priority, 0) as documents_priority,
  coalesce(agg.documents_overdue, 0) as documents_overdue,
  coalesce(agg.documents_due_soon, 0) as documents_due_soon,
  (coalesce(agg.documents_pending_signature, 0) + coalesce(agg.documents_priority, 0)
     + coalesce(agg.documents_overdue, 0)) > 0 as has_alerts
from public.projects p
left join public.profiles cb on cb.id = p.created_by
left join public.profiles ub on ub.id = p.updated_by
left join lateral (
  select
    count(*)::integer as documents_total,
    count(*) filter (where o.is_pending)::integer as documents_pending,
    count(*) filter (where o.is_pending_signature)::integer as documents_pending_signature,
    count(*) filter (where o.is_priority)::integer as documents_priority,
    count(*) filter (where o.is_overdue)::integer as documents_overdue,
    count(*) filter (where o.is_due_soon)::integer as documents_due_soon
  from public.project_document_overview o
  where o.project_id = p.id
) agg on true;

create or replace view public.project_file_overview
with (security_invoker = true) as
select
  f.id,
  f.project_id,
  f.project_document_id,
  f.original_filename,
  f.extension,
  f.size_bytes,
  f.uploaded_at,
  f.uploaded_by,
  ub.full_name as uploaded_by_name,
  f.removed_at,
  f.removal_reason
from public.project_files f
left join public.profiles ub on ub.id = f.uploaded_by;

create or replace view public.project_event_overview
with (security_invoker = true) as
select
  e.id,
  e.seq,
  e.project_id,
  e.project_document_id,
  d.title as document_title,
  d.kind as document_kind,
  e.file_id,
  e.event_type,
  e.from_status,
  e.to_status,
  e.changes,
  e.notes,
  e.is_internal,
  e.recorded_by,
  rb.full_name as recorded_by_name,
  e.occurred_at
from public.project_events e
left join public.project_documents d on d.id = e.project_document_id
left join public.profiles rb on rb.id = e.recorded_by;

-- -----------------------------------------------------------------------------
-- Auditoría
-- -----------------------------------------------------------------------------
create trigger audit_projects after insert or update or delete on public.projects
  for each row execute function private.audit_row();
create trigger audit_project_documents after insert or update or delete on public.project_documents
  for each row execute function private.audit_row();
create trigger audit_project_files after insert or update or delete on public.project_files
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- RLS y permisos
-- -----------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.project_documents enable row level security;
alter table public.project_files enable row level security;
alter table public.project_events enable row level security;

create policy projects_select on public.projects for select to authenticated
  using ((select private.is_active_user()));
create policy projects_insert on public.projects for insert to authenticated
  with check ((select private.is_admin()));
create policy projects_update on public.projects for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy project_documents_select on public.project_documents for select to authenticated
  using ((select private.is_active_user()));
create policy project_documents_insert on public.project_documents for insert to authenticated
  with check ((select private.is_admin()));
create policy project_documents_update on public.project_documents for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy project_files_select on public.project_files for select to authenticated
  using ((select private.is_admin()) or (removed_at is null and (select private.is_active_user())));
create policy project_files_insert on public.project_files for insert to authenticated
  with check ((select private.is_admin()));

-- Las notas internas solo las ven los administradores.
create policy project_events_select on public.project_events for select to authenticated
  using ((select private.is_admin()) or ((select private.is_active_user()) and not is_internal));

revoke all on public.projects, public.project_documents, public.project_files, public.project_events,
  public.project_overview, public.project_document_overview, public.project_file_overview,
  public.project_event_overview from anon, authenticated;

grant select on public.projects, public.project_documents, public.project_files, public.project_events,
  public.project_overview, public.project_document_overview, public.project_file_overview,
  public.project_event_overview to authenticated;
grant insert, update on public.projects, public.project_documents to authenticated;
grant insert on public.project_files to authenticated;

revoke all on function
  public.change_project_status(uuid, public.project_status, text),
  public.change_project_document_status(uuid, public.project_document_status, text),
  public.add_project_note(uuid, text, boolean, uuid),
  public.remove_project_file(uuid, text)
from public, anon;
revoke all on function
  private.projects_before_write(), private.projects_after_write(),
  private.project_documents_before_write(), private.project_documents_after_write(),
  private.project_files_before_write(), private.project_files_after_write(),
  private.project_events_before_insert()
from public, anon, authenticated;

grant execute on function
  public.change_project_status(uuid, public.project_status, text),
  public.change_project_document_status(uuid, public.project_document_status, text),
  public.add_project_note(uuid, text, boolean, uuid),
  public.remove_project_file(uuid, text)
to authenticated;

-- -----------------------------------------------------------------------------
-- Almacenamiento: carpeta proyectos/<proyecto>/<documento>/ del bucket privado
-- (se suman a las políticas existentes del bucket «documentos»)
-- -----------------------------------------------------------------------------
create policy siged_proyectos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(objects.name))[1] = 'proyectos'
    and (
      (select private.is_admin())
      or exists (
        select 1 from public.project_files f
        where f.storage_path = objects.name
          and f.removed_at is null
          and private.is_active_user()
      )
    )
  );

create policy siged_proyectos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(objects.name))[1] = 'proyectos'
    and (select private.is_admin())
    and exists (
      select 1 from public.project_documents d
      where d.project_id::text = (storage.foldername(objects.name))[2]
        and d.id::text = (storage.foldername(objects.name))[3]
    )
  );

-- La política de borrado de cargas huérfanas de documentos no debe alcanzar
-- la carpeta de proyectos (cuyos archivos se registran en project_files).
drop policy if exists siged_documentos_delete on storage.objects;
create policy siged_documentos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'documentos'
    and coalesce((storage.foldername(objects.name))[1], '') <> 'proyectos'
    and (select private.is_admin())
    and not exists (select 1 from public.document_attachments a where a.storage_path = objects.name)
  );

create policy siged_proyectos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(objects.name))[1] = 'proyectos'
    and (select private.is_admin())
    and not exists (select 1 from public.project_files f where f.storage_path = objects.name)
  );

-- -----------------------------------------------------------------------------
-- Datos de demostración y tiempo real
-- -----------------------------------------------------------------------------
create or replace function public.purge_demo_data()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
  v_p integer;
begin
  perform set_config('siged.allow_purge', 'on', true);
  delete from public.notifications where document_id in (select id from public.documents where is_demo)
    or procedure_id in (select id from public.procedures where is_demo);
  delete from public.procedures where is_demo or document_id in (select id from public.documents where is_demo);
  delete from public.documents where is_demo;
  get diagnostics v_n = row_count;
  delete from public.project_events where project_id in (select id from public.projects where is_demo);
  delete from public.project_files where project_id in (select id from public.projects where is_demo);
  delete from public.project_documents where project_id in (select id from public.projects where is_demo);
  delete from public.projects where is_demo;
  get diagnostics v_p = row_count;
  perform set_config('siged.allow_purge', 'off', true);
  perform private.write_audit('PURGA_DEMOSTRACION', 'documents', null,
    'Eliminación de datos ficticios de demostración', jsonb_build_object('documentos', v_n, 'proyectos', v_p));
  return v_n;
end;
$$;

revoke all on function public.purge_demo_data() from public, anon, authenticated;
grant execute on function public.purge_demo_data() to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.projects, public.project_documents, public.project_files, public.project_events;
  end if;
end
$$;
