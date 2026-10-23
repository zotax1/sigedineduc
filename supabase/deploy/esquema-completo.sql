-- =============================================================================
-- SIGED-INEDUC · ESQUEMA COMPLETO PARA INSTALACIÓN DESDE EL SQL EDITOR
-- =============================================================================
-- Archivo GENERADO a partir de supabase/migrations/ (no editar a mano;
-- regenerar con: npm run db:bundle).
-- Uso: Supabase → SQL Editor → New query → pegar todo → Run.
-- Se ejecuta en UNA transacción: si algo falla, no queda nada a medias.
-- Ejecútelo una sola vez, en un proyecto nuevo.
-- Al final registra las migraciones como aplicadas para que
-- `supabase db push` no intente repetirlas en el futuro.
-- =============================================================================

begin;

-- >>>>>>>>>>>>>>>>>>>> 20261021000100_base.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================================
-- SIGED-INEDUC · Migración 0100 · Base: extensiones, tipos, catálogos y perfiles
-- =============================================================================
-- Convenciones:
--   * Identificadores internos en inglés; etiquetas visibles en español (app).
--   * `private` contiene funciones auxiliares que NO se exponen por la API.
--   * Todas las marcas de tiempo de auditoría las genera la base de datos.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('ADMINISTRADOR', 'CONSULTA');
create type public.account_status as enum ('ACTIVO', 'SUSPENDIDO');
create type public.document_direction as enum ('ENTRANTE', 'SALIENTE');

create type public.document_status as enum (
  -- Flujo obligatorio de documentos salientes
  'REGISTRADO_EN_INEDUC',
  'REMITIDO_A_DIRECCION_INVESTIGACION',
  'RECIBIDO_EN_DIRECCION_INVESTIGACION',
  'EN_GESTION_DIRECCION_INVESTIGACION',
  'REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO',
  'RECIBIDO_EN_DECANATO',
  -- Estados de documentos entrantes
  'RECIBIDO',
  'EN_REVISION',
  'EN_TRAMITE',
  'REMITIDO',
  'EN_ESPERA_RESPUESTA',
  -- Comunes
  'EN_SEGUIMIENTO',
  'COMPLETADO',
  'ARCHIVADO'
);

create type public.document_visibility as enum ('GENERAL', 'RESTRINGIDO');

create type public.procedure_status as enum (
  'PENDIENTE', 'EN_PROCESO', 'EN_REVISION', 'EN_ESPERA_RESPUESTA', 'COMPLETADO', 'CANCELADO'
);

create type public.route_event_type as enum (
  'REGISTRO',     -- alta del documento
  'TRANSICION',   -- cambio de etapa del flujo
  'MOVIMIENTO',   -- traslado entre dependencias (entrantes)
  'OBSERVACION',  -- nota de seguimiento sin cambio de etapa
  'ASIGNACION',   -- cambio de responsable
  'REVERSION'     -- corrección autorizada que revierte el último movimiento
);

create type public.procedure_event_type as enum (
  'CREACION', 'CAMBIO_ESTADO', 'REASIGNACION', 'OBSERVACION', 'ACTUALIZACION'
);

-- -----------------------------------------------------------------------------
-- Utilidades generales
-- -----------------------------------------------------------------------------

-- Normaliza texto para búsquedas (minúsculas y sin tildes). Inmutable para
-- poder usarse en columnas generadas e índices.
create or replace function public.normalize_search(p_text text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, p_text))
$$;

-- Fecha actual en la zona horaria institucional (America/Santo_Domingo).
create or replace function private.today_do()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Santo_Domingo')::date
$$;

-- Indica si la transacción actual se ejecuta dentro de una operación de flujo
-- autorizada (las funciones de flujo activan esta bandera localmente).
create or replace function private.in_workflow()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('siged.workflow', true), '') = 'on'
$$;

create or replace function private.purge_allowed()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('siged.allow_purge', true), '') = 'on'
$$;

-- -----------------------------------------------------------------------------
-- Dependencias institucionales
-- -----------------------------------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_]{2,40}$'),
  name text not null check (length(btrim(name)) between 3 and 200),
  short_name text check (short_name is null or length(short_name) <= 60),
  description text check (description is null or length(description) <= 1000),
  contact_name text check (contact_name is null or length(contact_name) <= 200),
  contact_title text check (contact_title is null or length(contact_title) <= 200),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or length(phone) <= 40),
  is_system boolean not null default false,
  is_external boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

comment on table public.departments is
  'Dependencias e instituciones. Las marcadas is_system forman parte de la ruta obligatoria y no pueden alterarse.';

insert into public.departments (code, name, short_name, description, contact_name, contact_title, is_system, sort_order)
values
  ('INEDUC',
   'Instituto de Investigación e Innovación Educativa (INEDUC)',
   'INEDUC',
   'Instituto de la Facultad de Ciencias de la Educación, UASD. Origen de los documentos salientes.',
   null, null, true, 1),
  ('DIRECCION_INVESTIGACION',
   'Dirección de Investigación de la Facultad de Ciencias de la Educación',
   'Dirección de Investigación',
   'Dependencia intermedia obligatoria para todo documento saliente de INEDUC.',
   'Dr. Máximo Díaz', 'Director', true, 2),
  ('DECANATO',
   'Decanato de la Facultad de Ciencias de la Educación',
   'Decanato',
   'Dependencia que recibe los documentos salientes tras su paso por la Dirección de Investigación.',
   null, null, true, 3);

create or replace function private.department_id(p_code text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.departments where code = p_code
$$;

create or replace function private.department_code(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select code from public.departments where id = p_id
$$;

-- Protege las dependencias del sistema (ruta obligatoria).
create or replace function private.protect_system_departments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'SIGED_PROTEGIDO: Las dependencias no se eliminan; desactívelas si es necesario.'
      using errcode = 'P0001';
  end if;
  if new.code is distinct from old.code then
    raise exception 'SIGED_PROTEGIDO: El código de una dependencia no puede modificarse.' using errcode = 'P0001';
  end if;
  if new.is_system is distinct from old.is_system then
    raise exception 'SIGED_PROTEGIDO: No se puede cambiar la condición de dependencia del sistema.' using errcode = 'P0001';
  end if;
  if old.is_system and (not new.active or new.is_external) then
    raise exception 'SIGED_PROTEGIDO: Las dependencias de la ruta obligatoria no pueden desactivarse.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger departments_protect
  before update or delete on public.departments
  for each row execute function private.protect_system_departments();

create or replace function private.prevent_system_department_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_system and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'SIGED_PROTEGIDO: No se pueden crear dependencias del sistema.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger departments_insert_guard
  before insert on public.departments
  for each row execute function private.prevent_system_department_insert();

-- -----------------------------------------------------------------------------
-- Catálogos configurables
-- -----------------------------------------------------------------------------
create table public.priorities (
  code text primary key check (code ~ '^[A-Z_]{2,30}$'),
  name text not null check (length(btrim(name)) between 2 and 60),
  weight integer not null unique check (weight between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.priorities (code, name, weight) values
  ('BAJA', 'Baja', 10),
  ('MEDIA', 'Media', 20),
  ('ALTA', 'Alta', 30),
  ('URGENTE', 'Urgente', 40);

create table public.document_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 2 and 120),
  description text,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.document_types (name, sort_order) values
  ('Oficio', 1),
  ('Comunicación', 2),
  ('Memorándum', 3),
  ('Informe', 4),
  ('Solicitud', 5),
  ('Certificación', 6),
  ('Propuesta de investigación', 7),
  ('Resolución', 8),
  ('Circular', 9),
  ('Otro', 99);

create table public.procedure_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 2 and 120),
  description text,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.procedure_categories (name, sort_order) values
  ('Respuesta a comunicación', 1),
  ('Revisión de documento', 2),
  ('Gestión administrativa', 3),
  ('Seguimiento de solicitud', 4),
  ('Otro', 99);

-- Parámetros generales (fila única).
create table public.app_settings (
  id boolean primary key default true check (id),
  deadline_warning_days integer not null default 3 check (deadline_warning_days between 0 and 60),
  stale_stage_days integer not null default 7 check (stale_stage_days between 1 and 365),
  max_attachment_mb integer not null default 20 check (max_attachment_mb between 1 and 50),
  allowed_extensions text[] not null default array['pdf','doc','docx','xls','xlsx','png','jpg','jpeg'],
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint app_settings_extensions_valid check (
    allowed_extensions <@ array['pdf','doc','docx','xls','xlsx','png','jpg','jpeg']
    and cardinality(allowed_extensions) > 0
  )
);

insert into public.app_settings (id) values (true);

-- -----------------------------------------------------------------------------
-- Perfiles de usuario
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '' check (length(full_name) <= 200),
  job_title text check (job_title is null or length(job_title) <= 200),
  department_id uuid references public.departments (id),
  role public.app_role not null default 'CONSULTA',
  status public.account_status not null default 'ACTIVO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create index profiles_role_status_idx on public.profiles (role, status);

alter table public.departments
  add constraint departments_created_by_fkey foreign key (created_by) references public.profiles (id),
  add constraint departments_updated_by_fkey foreign key (updated_by) references public.profiles (id);
alter table public.app_settings
  add constraint app_settings_updated_by_fkey foreign key (updated_by) references public.profiles (id);

-- Alta automática de perfil al crear la cuenta. El rol SIEMPRE inicia como
-- CONSULTA: los metadatos enviados por el cliente nunca otorgan privilegios.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)), 200)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create or replace function private.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    perform set_config('siged.profile_sync', 'on', true);
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
    perform set_config('siged.profile_sync', 'off', true);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.handle_auth_user_email_change();

-- Funciones de autorización usadas por las políticas RLS.
create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'ACTIVO'
  )
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'ACTIVO' and p.role = 'ADMINISTRADOR'
  )
$$;

create or replace function private.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'SIGED_NO_AUTORIZADO: Esta operación requiere una cuenta de administrador activa.'
      using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

-- Los cambios de rol, estado o correo solo pueden hacerse mediante las
-- funciones administrativas (que se ejecutan como propietario) o desde el
-- editor SQL del proyecto. Un usuario nunca puede elevar su propio rol.
create or replace function private.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'SIGED_PROTEGIDO: Campos de identidad inmutables.' using errcode = 'P0001';
  end if;
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and coalesce(current_setting('siged.role_admin', true), '') <> 'on'
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'SIGED_NO_AUTORIZADO: El rol y el estado de la cuenta solo pueden cambiarse mediante una operación administrativa autorizada.'
      using errcode = '42501';
  end if;
  if new.email is distinct from old.email
     and coalesce(current_setting('siged.profile_sync', true), '') <> 'on'
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'SIGED_PROTEGIDO: El correo se sincroniza desde la cuenta de acceso.' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger profiles_protect
  before update on public.profiles
  for each row execute function private.protect_profile_columns();

-- -----------------------------------------------------------------------------
-- Marcas de tiempo / actores genéricos para catálogos
-- -----------------------------------------------------------------------------
create or replace function private.touch_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.touch_row_with_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := auth.uid();
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger departments_touch before insert or update on public.departments
  for each row execute function private.touch_row_with_actor();
create trigger priorities_touch before insert or update on public.priorities
  for each row execute function private.touch_row();
create trigger document_types_touch before insert or update on public.document_types
  for each row execute function private.touch_row();
create trigger procedure_categories_touch before insert or update on public.procedure_categories
  for each row execute function private.touch_row();

create or replace function private.touch_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger app_settings_touch before update on public.app_settings
  for each row execute function private.touch_settings();

create or replace function private.protect_priority_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'SIGED_PROTEGIDO: Las prioridades no se eliminan; desactívelas si es necesario.' using errcode = 'P0001';
  end if;
  if new.code is distinct from old.code then
    raise exception 'SIGED_PROTEGIDO: El código de prioridad no puede modificarse.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger priorities_protect before update or delete on public.priorities
  for each row execute function private.protect_priority_code();

-- >>>>>>>>>>>>>>>>>>>> 20261021000200_documents_workflow.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================================
-- SIGED-INEDUC · Migración 0200 · Documentos, historial y flujo obligatorio
-- =============================================================================
-- REGLA INSTITUCIONAL CRÍTICA:
--   Todo documento saliente de INEDUC debe pasar por la Dirección de
--   Investigación de la Facultad de Ciencias de la Educación antes de ser
--   remitido al Decanato de la Facultad.
--
--   INEDUC → Dirección de Investigación → Decanato
--
-- La regla se aplica en TRES capas dentro de la base de datos:
--   1. `record_outgoing_transition()`  valida y ejecuta la transición de forma
--      atómica, con bloqueo de fila y control de concurrencia optimista.
--   2. Trigger de `document_route_events` valida cada evento contra el estado
--      real del documento y el historial efectivo (prerrequisitos).
--   3. Trigger de `documents` impide cambiar etapa/dependencia fuera de una
--      operación de flujo, exige transición válida, coherencia
--      etapa↔dependencia y un evento de historial en la misma transacción.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Definición de la ruta obligatoria (inmutable; no configurable desde la app)
-- -----------------------------------------------------------------------------

-- Dependencia institucional responsable de cada etapa de un documento saliente.
create or replace function public.outgoing_stage_department_code(p_status public.document_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'REGISTRADO_EN_INEDUC' then 'INEDUC'
    when 'REMITIDO_A_DIRECCION_INVESTIGACION' then 'DIRECCION_INVESTIGACION'
    when 'RECIBIDO_EN_DIRECCION_INVESTIGACION' then 'DIRECCION_INVESTIGACION'
    when 'EN_GESTION_DIRECCION_INVESTIGACION' then 'DIRECCION_INVESTIGACION'
    when 'REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO' then 'DECANATO'
    when 'RECIBIDO_EN_DECANATO' then 'DECANATO'
    when 'EN_SEGUIMIENTO' then 'DECANATO'
    when 'COMPLETADO' then 'DECANATO'
    when 'ARCHIVADO' then 'DECANATO'
    else null
  end
$$;

create or replace function public.is_outgoing_status(p_status public.document_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status in (
    'REGISTRADO_EN_INEDUC', 'REMITIDO_A_DIRECCION_INVESTIGACION', 'RECIBIDO_EN_DIRECCION_INVESTIGACION',
    'EN_GESTION_DIRECCION_INVESTIGACION', 'REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO',
    'RECIBIDO_EN_DECANATO', 'EN_SEGUIMIENTO', 'COMPLETADO', 'ARCHIVADO'
  )
$$;

create or replace function public.is_incoming_status(p_status public.document_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status in (
    'RECIBIDO', 'EN_REVISION', 'EN_TRAMITE', 'REMITIDO', 'EN_ESPERA_RESPUESTA',
    'EN_SEGUIMIENTO', 'COMPLETADO', 'ARCHIVADO'
  )
$$;

-- Tabla de transiciones permitidas del flujo saliente.
-- Devuelve: etiqueta de la acción, dependencia de origen y destino del traspaso,
-- y la etapa que debe constar previamente en el historial efectivo.
create or replace function public.outgoing_transition_rule(
  p_from public.document_status,
  p_to public.document_status
)
returns table (
  action_label text,
  origin_code text,
  destination_code text,
  required_prior_status public.document_status
)
language sql
immutable
set search_path = ''
as $$
  select t.action_label, t.origin_code, t.destination_code, t.required_prior_status from (values
    ('REGISTRADO_EN_INEDUC'::public.document_status, 'REMITIDO_A_DIRECCION_INVESTIGACION'::public.document_status,
      'Remitido a la Dirección de Investigación', 'INEDUC', 'DIRECCION_INVESTIGACION', 'REGISTRADO_EN_INEDUC'::public.document_status),
    ('REMITIDO_A_DIRECCION_INVESTIGACION', 'RECIBIDO_EN_DIRECCION_INVESTIGACION',
      'Recepción registrada en la Dirección de Investigación', 'INEDUC', 'DIRECCION_INVESTIGACION', 'REMITIDO_A_DIRECCION_INVESTIGACION'),
    ('RECIBIDO_EN_DIRECCION_INVESTIGACION', 'EN_GESTION_DIRECCION_INVESTIGACION',
      'En gestión en la Dirección de Investigación', 'DIRECCION_INVESTIGACION', 'DIRECCION_INVESTIGACION', 'RECIBIDO_EN_DIRECCION_INVESTIGACION'),
    ('RECIBIDO_EN_DIRECCION_INVESTIGACION', 'REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO',
      'Remitido desde la Dirección de Investigación al Decanato', 'DIRECCION_INVESTIGACION', 'DECANATO', 'RECIBIDO_EN_DIRECCION_INVESTIGACION'),
    ('EN_GESTION_DIRECCION_INVESTIGACION', 'REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO',
      'Remitido desde la Dirección de Investigación al Decanato', 'DIRECCION_INVESTIGACION', 'DECANATO', 'RECIBIDO_EN_DIRECCION_INVESTIGACION'),
    ('REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO', 'RECIBIDO_EN_DECANATO',
      'Recepción registrada en el Decanato', 'DIRECCION_INVESTIGACION', 'DECANATO', 'REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO'),
    ('RECIBIDO_EN_DECANATO', 'EN_SEGUIMIENTO',
      'En seguimiento', 'DECANATO', 'DECANATO', 'RECIBIDO_EN_DECANATO'),
    ('RECIBIDO_EN_DECANATO', 'COMPLETADO',
      'Trámite completado', 'DECANATO', 'DECANATO', 'RECIBIDO_EN_DECANATO'),
    ('EN_SEGUIMIENTO', 'COMPLETADO',
      'Trámite completado', 'DECANATO', 'DECANATO', 'RECIBIDO_EN_DECANATO'),
    ('COMPLETADO', 'ARCHIVADO',
      'Documento archivado', 'DECANATO', 'DECANATO', 'COMPLETADO')
  ) as t(from_status, to_status, action_label, origin_code, destination_code, required_prior_status)
  where t.from_status = p_from and t.to_status = p_to
$$;

-- Definición completa de la ruta, expuesta para que la interfaz y las pruebas
-- verifiquen que su copia coincide con la base de datos.
create or replace function public.get_outgoing_route_definition()
returns table (
  from_status public.document_status,
  to_status public.document_status,
  action_label text,
  origin_code text,
  destination_code text,
  required_prior_status public.document_status
)
language sql
stable
set search_path = ''
as $$
  select f.s, t.s, r.action_label, r.origin_code, r.destination_code, r.required_prior_status
  from unnest(enum_range(null::public.document_status)) as f(s)
  cross join unnest(enum_range(null::public.document_status)) as t(s)
  cross join lateral public.outgoing_transition_rule(f.s, t.s) as r
  order by array_position(enum_range(null::public.document_status), f.s),
           array_position(enum_range(null::public.document_status), t.s)
$$;

-- -----------------------------------------------------------------------------
-- Documentos
-- -----------------------------------------------------------------------------
create table public.document_counters (
  direction public.document_direction not null,
  year integer not null,
  last_value integer not null default 0,
  primary key (direction, year)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  direction public.document_direction not null,
  -- Valor provisional: el trigger de inserción asigna la referencia definitiva.
  internal_reference text not null unique default ('TMP-' || gen_random_uuid()),
  official_number text check (official_number is null or length(btrim(official_number)) between 1 and 120),
  subject text not null check (length(btrim(subject)) between 3 and 300),
  description text check (description is null or length(description) <= 5000),
  document_type_id uuid references public.document_types (id),
  priority_code text not null default 'MEDIA' references public.priorities (code),
  -- Etapa y dependencia iniciales: el trigger de inserción las fija siempre.
  status public.document_status not null default 'REGISTRADO_EN_INEDUC',
  current_department_id uuid not null default private.department_id('INEDUC') references public.departments (id),
  -- Entrantes
  sender_name text check (sender_name is null or length(sender_name) <= 200),
  sender_institution text check (sender_institution is null or length(sender_institution) <= 300),
  origin_department_id uuid references public.departments (id),
  recipient_department_id uuid references public.departments (id),
  received_on date,
  received_by_name text check (received_by_name is null or length(received_by_name) <= 200),
  -- Salientes
  recipient_name text check (recipient_name is null or length(recipient_name) <= 200),
  destination_institution text check (destination_institution is null or length(destination_institution) <= 300),
  -- Comunes
  issued_on date,
  responsible_id uuid references public.profiles (id),
  due_date date,
  next_action text check (next_action is null or length(next_action) <= 500),
  observations text check (observations is null or length(observations) <= 5000),
  visibility public.document_visibility not null default 'GENERAL',
  is_demo boolean not null default false,
  -- Hitos mantenidos exclusivamente por las funciones de flujo
  registered_at timestamptz not null default now(),
  remitted_to_di_at timestamptz,
  received_at_di_at timestamptz,
  remitted_to_decanato_at timestamptz,
  received_at_decanato_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  stage_changed_at timestamptz not null default now(),
  -- Metadatos
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (
    public.normalize_search(
      coalesce(internal_reference, '') || ' ' || coalesce(official_number, '') || ' ' ||
      coalesce(subject, '') || ' ' || coalesce(sender_name, '') || ' ' ||
      coalesce(sender_institution, '') || ' ' || coalesce(recipient_name, '') || ' ' ||
      coalesce(destination_institution, '') || ' ' || coalesce(next_action, '') || ' ' ||
      coalesce(observations, '')
    )
  ) stored,

  constraint documents_status_matches_direction check (
    (direction = 'SALIENTE' and public.is_outgoing_status(status))
    or (direction = 'ENTRANTE' and public.is_incoming_status(status))
  ),
  constraint documents_incoming_required check (
    direction <> 'ENTRANTE'
    or (received_on is not null
        and (nullif(btrim(coalesce(sender_name, '')), '') is not null
             or nullif(btrim(coalesce(sender_institution, '')), '') is not null))
  ),
  constraint documents_outgoing_fields check (
    direction <> 'SALIENTE'
    or (received_on is null and sender_institution is null and sender_name is null)
  ),
  constraint documents_received_after_issued check (
    received_on is null or issued_on is null or received_on >= issued_on
  ),
  constraint documents_milestones_order check (
    (received_at_di_at is null or remitted_to_di_at is not null)
    and (remitted_to_decanato_at is null or received_at_di_at is not null)
    and (received_at_decanato_at is null or remitted_to_decanato_at is not null)
  )
);

comment on column public.documents.official_number is
  'Número oficial u oficio. Lo introduce el administrador; nunca se genera automáticamente.';
comment on column public.documents.internal_reference is
  'Referencia interna de seguimiento generada por SIGED; independiente del número oficial.';

-- Unicidad condicional del número oficial:
--   * Salientes: único (sin distinguir mayúsculas/espacios).
--   * Entrantes: único por institución remitente (otras instituciones pueden
--     usar la misma numeración).
create unique index documents_outgoing_official_number_uniq
  on public.documents (lower(btrim(official_number)))
  where direction = 'SALIENTE' and official_number is not null;

create unique index documents_incoming_official_number_uniq
  on public.documents (
    lower(btrim(coalesce(sender_institution, sender_name, ''))),
    lower(btrim(official_number))
  )
  where direction = 'ENTRANTE' and official_number is not null;

create index documents_direction_status_idx on public.documents (direction, status);
create index documents_current_department_idx on public.documents (current_department_id);
create index documents_responsible_idx on public.documents (responsible_id);
create index documents_due_date_idx on public.documents (due_date) where due_date is not null;
create index documents_registered_at_idx on public.documents (registered_at desc);
create index documents_updated_at_idx on public.documents (updated_at desc);
create index documents_priority_idx on public.documents (priority_code);
create index documents_type_idx on public.documents (document_type_id);
create index documents_search_trgm_idx on public.documents using gin (search_text extensions.gin_trgm_ops);

-- Acceso explícito a documentos restringidos.
create table public.document_access (
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  primary key (document_id, user_id)
);

create index document_access_user_idx on public.document_access (user_id);

-- -----------------------------------------------------------------------------
-- Adjuntos (metadatos; los archivos residen en un bucket privado)
-- -----------------------------------------------------------------------------
create table public.document_attachments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null check (length(original_filename) between 1 and 255),
  mime_type text not null,
  extension text not null,
  size_bytes bigint not null check (size_bytes > 0),
  description text check (description is null or length(description) <= 500),
  replaces_attachment_id uuid references public.document_attachments (id),
  uploaded_by uuid references public.profiles (id),
  uploaded_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references public.profiles (id),
  removal_reason text,
  constraint attachments_path_prefix check (storage_path like document_id::text || '/%'),
  constraint attachments_removal_consistent check (
    (removed_at is null and removed_by is null and removal_reason is null)
    or (removed_at is not null and removal_reason is not null and length(btrim(removal_reason)) >= 5)
  )
);

create index document_attachments_document_idx on public.document_attachments (document_id);

-- -----------------------------------------------------------------------------
-- Historial de movimientos (solo anexar)
-- -----------------------------------------------------------------------------
create table public.document_route_events (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  document_id uuid not null references public.documents (id) on delete cascade,
  event_type public.route_event_type not null,
  from_status public.document_status,
  to_status public.document_status,
  from_department_id uuid references public.departments (id),
  to_department_id uuid references public.departments (id),
  action text not null check (length(action) between 3 and 200),
  notes text check (notes is null or length(notes) <= 2000),
  attachment_id uuid references public.document_attachments (id),
  reverses_event_id uuid unique references public.document_route_events (id),
  from_responsible_id uuid references public.profiles (id),
  to_responsible_id uuid references public.profiles (id),
  recorded_by uuid references public.profiles (id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint route_events_reversal_consistent check (
    (event_type = 'REVERSION') = (reverses_event_id is not null)
  ),
  constraint route_events_reversal_reason check (
    event_type <> 'REVERSION' or length(btrim(coalesce(notes, ''))) >= 10
  )
);

comment on table public.document_route_events is
  'Historial cronológico de movimientos. Solo anexar: no admite modificaciones ni borrados.';

create index route_events_document_idx on public.document_route_events (document_id, seq);
create index route_events_occurred_idx on public.document_route_events (occurred_at desc);
create index route_events_to_status_idx on public.document_route_events (document_id, to_status);

-- -----------------------------------------------------------------------------
-- Autorización de lectura de documentos
-- -----------------------------------------------------------------------------
create or replace function private.user_can_view_document(p_user_id uuid, p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.documents d on d.id = p_document_id
    where p.id = p_user_id
      and p.status = 'ACTIVO'
      and (
        p.role = 'ADMINISTRADOR'
        or d.visibility = 'GENERAL'
        or d.responsible_id = p.id
        or exists (
          select 1 from public.document_access a
          where a.document_id = d.id and a.user_id = p.id
        )
      )
  )
$$;

create or replace function private.can_view_document(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.user_can_view_document(auth.uid(), p_document_id)
$$;

create or replace function private.has_document_access(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.document_access a
    where a.document_id = p_document_id and a.user_id = auth.uid()
  )
$$;

-- -----------------------------------------------------------------------------
-- Historial efectivo: un evento de transición cuenta salvo que haya sido
-- revertido por un evento de REVERSION posterior.
-- -----------------------------------------------------------------------------
create or replace function private.has_effective_stage(p_document_id uuid, p_status public.document_status)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.document_route_events e
    where e.document_id = p_document_id
      and e.to_status = p_status
      and e.event_type in ('REGISTRO', 'TRANSICION', 'MOVIMIENTO')
      and not exists (
        select 1 from public.document_route_events r
        where r.reverses_event_id = e.id
      )
  )
$$;

create or replace function private.last_effective_route_event(p_document_id uuid)
returns public.document_route_events
language sql
stable
security definer
set search_path = ''
as $$
  select e.*
  from public.document_route_events e
  where e.document_id = p_document_id
    and e.event_type in ('TRANSICION', 'MOVIMIENTO')
    and not exists (select 1 from public.document_route_events r where r.reverses_event_id = e.id)
  order by e.seq desc
  limit 1
$$;

-- Dependencia a restaurar al revertir un movimiento: en salientes, la que
-- corresponde a la etapa previa; en entrantes, la dependencia anterior real.
create or replace function private.restore_department_for(
  p_direction public.document_direction,
  p_event public.document_route_events
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_direction = 'SALIENTE'
      then private.department_id(public.outgoing_stage_department_code(p_event.from_status))
    else p_event.from_department_id
  end
$$;

-- -----------------------------------------------------------------------------
-- Triggers de documentos
-- -----------------------------------------------------------------------------
create or replace function private.next_internal_reference(p_direction public.document_direction)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year integer := extract(year from (now() at time zone 'America/Santo_Domingo'))::integer;
  v_value integer;
begin
  insert into public.document_counters as c (direction, year, last_value)
  values (p_direction, v_year, 1)
  on conflict (direction, year) do update set last_value = c.last_value + 1
  returning c.last_value into v_value;

  return format('SIGED-%s-%s-%s',
    case p_direction when 'ENTRANTE' then 'E' else 'S' end,
    v_year,
    lpad(v_value::text, 5, '0'));
end;
$$;

create or replace function private.documents_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ineduc uuid := private.department_id('INEDUC');
begin
  -- Valores controlados por el servidor: nunca se aceptan desde el cliente.
  new.internal_reference := private.next_internal_reference(new.direction);
  new.created_by := auth.uid();
  new.updated_by := auth.uid();
  new.created_at := now();
  new.updated_at := now();
  new.registered_at := now();
  new.stage_changed_at := now();
  new.remitted_to_di_at := null;
  new.received_at_di_at := null;
  new.remitted_to_decanato_at := null;
  new.received_at_decanato_at := null;
  new.completed_at := null;
  new.archived_at := null;
  new.official_number := nullif(btrim(new.official_number), '');

  if new.direction = 'SALIENTE' then
    -- Todo documento saliente inicia en INEDUC; su primer destino obligatorio
    -- es la Dirección de Investigación.
    new.status := 'REGISTRADO_EN_INEDUC';
    new.current_department_id := v_ineduc;
    new.origin_department_id := v_ineduc;
    new.recipient_department_id := coalesce(new.recipient_department_id, null);
  else
    new.status := 'RECIBIDO';
    new.recipient_department_id := coalesce(new.recipient_department_id, v_ineduc);
    new.current_department_id := new.recipient_department_id;
    if new.received_on is not null and new.received_on > private.today_do() then
      raise exception 'SIGED_VALIDACION: La fecha de recepción no puede ser futura.' using errcode = '22007';
    end if;
  end if;

  if new.issued_on is not null and new.issued_on > private.today_do() then
    raise exception 'SIGED_VALIDACION: La fecha de emisión no puede ser futura.' using errcode = '22007';
  end if;

  if new.responsible_id is not null and not exists (
    select 1 from public.profiles where id = new.responsible_id and status = 'ACTIVO'
  ) then
    raise exception 'SIGED_VALIDACION: El responsable seleccionado no es un usuario activo.' using errcode = '23503';
  end if;

  return new;
end;
$$;

create trigger documents_before_insert
  before insert on public.documents
  for each row execute function private.documents_before_insert();

create or replace function private.documents_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.document_route_events (
    document_id, event_type, from_status, to_status, from_department_id, to_department_id,
    action, to_responsible_id
  ) values (
    new.id, 'REGISTRO', null, new.status, null, new.current_department_id,
    case new.direction
      when 'SALIENTE' then 'Documento saliente registrado en INEDUC'
      else 'Documento entrante registrado'
    end,
    new.responsible_id
  );
  return null;
end;
$$;

create trigger documents_after_insert
  after insert on public.documents
  for each row execute function private.documents_after_insert();

create or replace function private.documents_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workflow boolean := private.in_workflow();
  v_expected_dept uuid;
  v_rule record;
begin
  -- Campos inmutables.
  if new.id is distinct from old.id
     or new.direction is distinct from old.direction
     or new.internal_reference is distinct from old.internal_reference
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.registered_at is distinct from old.registered_at
     or new.is_demo is distinct from old.is_demo
     or new.origin_department_id is distinct from old.origin_department_id and old.direction = 'SALIENTE' then
    raise exception 'SIGED_PROTEGIDO: Se intentó modificar un campo inmutable del documento.' using errcode = 'P0001';
  end if;

  -- Campos de flujo: solo modificables por las funciones de flujo.
  if (new.status is distinct from old.status
      or new.current_department_id is distinct from old.current_department_id
      or new.remitted_to_di_at is distinct from old.remitted_to_di_at
      or new.received_at_di_at is distinct from old.received_at_di_at
      or new.remitted_to_decanato_at is distinct from old.remitted_to_decanato_at
      or new.received_at_decanato_at is distinct from old.received_at_decanato_at
      or new.completed_at is distinct from old.completed_at
      or new.archived_at is distinct from old.archived_at
      or new.stage_changed_at is distinct from old.stage_changed_at)
     and not v_workflow then
    raise exception 'SIGED_RUTA_INVALIDA: La etapa y la dependencia actual solo pueden cambiarse registrando un movimiento válido.'
      using errcode = 'P0001';
  end if;

  -- Un documento archivado no admite cambios de metadatos.
  if old.status = 'ARCHIVADO' and not v_workflow then
    raise exception 'SIGED_PROTEGIDO: El documento está archivado y no admite modificaciones.' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    -- Debe existir un evento de historial que respalde el cambio, registrado
    -- en esta misma transacción (now() = inicio de la transacción).
    if not exists (
      select 1 from public.document_route_events e
      where e.document_id = new.id
        and e.to_status = new.status
        and e.from_status = old.status
        and e.event_type in ('TRANSICION', 'MOVIMIENTO', 'REVERSION')
        and e.created_at = now()
    ) then
      raise exception 'SIGED_RUTA_INVALIDA: Todo cambio de etapa debe quedar registrado en el historial.' using errcode = 'P0001';
    end if;

    if new.direction = 'SALIENTE' then
      -- Transición válida según la ruta obligatoria, salvo una reversión
      -- registrada (que devuelve el documento a su etapa previa).
      select * into v_rule from public.outgoing_transition_rule(old.status, new.status);
      if not found and not exists (
        select 1 from public.document_route_events e
        where e.document_id = new.id and e.event_type = 'REVERSION'
          and e.from_status = old.status and e.to_status = new.status and e.created_at = now()
      ) then
        raise exception 'SIGED_RUTA_INVALIDA: Transición no permitida en la ruta obligatoria (% → %).', old.status, new.status
          using errcode = 'P0001';
      end if;
    end if;
    new.stage_changed_at := now();
  end if;

  -- Coherencia etapa ↔ dependencia actual (salientes).
  if new.direction = 'SALIENTE' then
    v_expected_dept := private.department_id(public.outgoing_stage_department_code(new.status));
    if new.current_department_id is distinct from v_expected_dept then
      raise exception 'SIGED_RUTA_INVALIDA: La dependencia actual no corresponde a la etapa del documento.' using errcode = 'P0001';
    end if;
  end if;

  if new.issued_on is distinct from old.issued_on and new.issued_on > private.today_do() then
    raise exception 'SIGED_VALIDACION: La fecha de emisión no puede ser futura.' using errcode = '22007';
  end if;
  if new.received_on is distinct from old.received_on and new.received_on > private.today_do() then
    raise exception 'SIGED_VALIDACION: La fecha de recepción no puede ser futura.' using errcode = '22007';
  end if;
  if new.responsible_id is distinct from old.responsible_id and new.responsible_id is not null and not exists (
    select 1 from public.profiles where id = new.responsible_id and status = 'ACTIVO'
  ) then
    raise exception 'SIGED_VALIDACION: El responsable seleccionado no es un usuario activo.' using errcode = '23503';
  end if;
  if new.direction = 'ENTRANTE' and new.recipient_department_id is null then
    raise exception 'SIGED_VALIDACION: Indique la dependencia destinataria.' using errcode = '23502';
  end if;

  new.official_number := nullif(btrim(new.official_number), '');
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), old.updated_by);
  return new;
end;
$$;

create trigger documents_before_update
  before update on public.documents
  for each row execute function private.documents_before_update();

create or replace function private.documents_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.responsible_id is distinct from old.responsible_id then
    insert into public.document_route_events (
      document_id, event_type, from_status, to_status, from_department_id, to_department_id,
      action, from_responsible_id, to_responsible_id
    ) values (
      new.id, 'ASIGNACION', new.status, new.status, new.current_department_id, new.current_department_id,
      case when new.responsible_id is null then 'Responsable retirado' else 'Responsable asignado' end,
      old.responsible_id, new.responsible_id
    );
  end if;
  return null;
end;
$$;

create trigger documents_after_update
  after update on public.documents
  for each row execute function private.documents_after_update();

create or replace function private.block_delete_unless_purge()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.purge_allowed() then
    raise exception 'SIGED_PROTEGIDO: Los registros institucionales no se eliminan; archívelos.' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger documents_block_delete
  before delete on public.documents
  for each row execute function private.block_delete_unless_purge();

-- -----------------------------------------------------------------------------
-- Triggers del historial (validación y solo-anexar)
-- -----------------------------------------------------------------------------
create or replace function private.route_events_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documents;
  v_rule record;
  v_last public.document_route_events;
begin
  -- Actor y marcas de tiempo los fija el servidor (no se admiten fechas
  -- retroactivas ni actores suplantados).
  new.recorded_by := auth.uid();
  new.occurred_at := now();
  new.created_at := now();

  select * into v_doc from public.documents where id = new.document_id for update;
  if not found then
    raise exception 'SIGED_NO_ENCONTRADO: Documento inexistente.' using errcode = 'P0002';
  end if;

  if new.attachment_id is not null and not exists (
    select 1 from public.document_attachments a
    where a.id = new.attachment_id and a.document_id = new.document_id and a.removed_at is null
  ) then
    raise exception 'SIGED_VALIDACION: El adjunto de soporte no pertenece al documento.' using errcode = 'P0001';
  end if;

  if new.event_type = 'REGISTRO' then
    if exists (select 1 from public.document_route_events where document_id = new.document_id) then
      raise exception 'SIGED_RUTA_INVALIDA: El documento ya tiene un registro inicial.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.event_type in ('OBSERVACION', 'ASIGNACION') then
    -- No cambian la etapa: deben reflejar la etapa actual.
    new.from_status := v_doc.status;
    new.to_status := v_doc.status;
    new.from_department_id := v_doc.current_department_id;
    new.to_department_id := v_doc.current_department_id;
    return new;
  end if;

  -- Transiciones, traslados y reversiones solo pueden registrarse desde las
  -- funciones de flujo, que actualizan el documento en la misma transacción.
  if not private.in_workflow() then
    raise exception 'SIGED_RUTA_INVALIDA: Los movimientos deben registrarse mediante la operación de flujo correspondiente.'
      using errcode = 'P0001';
  end if;

  if new.from_status is distinct from v_doc.status then
    raise exception 'SIGED_CONFLICTO: El documento cambió de etapa mientras se registraba el movimiento. Actualice la página e intente de nuevo.'
      using errcode = '40001';
  end if;

  if new.event_type = 'REVERSION' then
    v_last := private.last_effective_route_event(new.document_id);
    if v_last.id is null or v_last.id is distinct from new.reverses_event_id then
      raise exception 'SIGED_RUTA_INVALIDA: Solo puede revertirse el último movimiento vigente.' using errcode = 'P0001';
    end if;
    if v_last.to_status is distinct from v_doc.status
       or new.to_status is distinct from v_last.from_status
       or new.to_department_id is distinct from private.restore_department_for(v_doc.direction, v_last) then
      raise exception 'SIGED_RUTA_INVALIDA: La reversión debe restaurar exactamente la etapa anterior.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if v_doc.direction = 'SALIENTE' then
    if new.event_type <> 'TRANSICION' then
      raise exception 'SIGED_RUTA_INVALIDA: Los documentos salientes solo avanzan mediante transiciones de la ruta obligatoria.'
        using errcode = 'P0001';
    end if;

    select * into v_rule from public.outgoing_transition_rule(v_doc.status, new.to_status);
    if not found then
      if new.to_status in ('REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO', 'RECIBIDO_EN_DECANATO')
         and not private.has_effective_stage(new.document_id, 'RECIBIDO_EN_DIRECCION_INVESTIGACION') then
        raise exception 'SIGED_RUTA_INVALIDA: Ruta obligatoria: el documento debe pasar por la Dirección de Investigación de la Facultad de Ciencias de la Educación antes de remitirse al Decanato.'
          using errcode = 'P0001';
      end if;
      raise exception 'SIGED_RUTA_INVALIDA: Transición no permitida en la ruta obligatoria (% → %).', v_doc.status, new.to_status
        using errcode = 'P0001';
    end if;

    -- Prerrequisito en el historial efectivo (defensa adicional ante
    -- inconsistencias): la etapa previa exigida debe constar registrada.
    if not private.has_effective_stage(new.document_id, v_rule.required_prior_status) then
      raise exception 'SIGED_RUTA_INVALIDA: Falta registrar la etapa previa obligatoria (%).', v_rule.required_prior_status
        using errcode = 'P0001';
    end if;

    new.from_department_id := private.department_id(v_rule.origin_code);
    new.to_department_id := private.department_id(v_rule.destination_code);
    new.action := v_rule.action_label;
    return new;
  end if;

  -- Entrantes: flujo flexible con reglas mínimas.
  if new.event_type not in ('TRANSICION', 'MOVIMIENTO') then
    raise exception 'SIGED_RUTA_INVALIDA: Tipo de evento no válido.' using errcode = 'P0001';
  end if;
  if not public.is_incoming_status(new.to_status) then
    raise exception 'SIGED_RUTA_INVALIDA: Estado no válido para un documento entrante.' using errcode = 'P0001';
  end if;
  if v_doc.status = 'ARCHIVADO' then
    raise exception 'SIGED_RUTA_INVALIDA: El documento está archivado.' using errcode = 'P0001';
  end if;
  if new.to_status = 'ARCHIVADO' and v_doc.status <> 'COMPLETADO' then
    raise exception 'SIGED_RUTA_INVALIDA: Solo se archivan documentos completados.' using errcode = 'P0001';
  end if;
  if new.to_department_id is null or not exists (
    select 1 from public.departments where id = new.to_department_id and active
  ) then
    raise exception 'SIGED_VALIDACION: Seleccione una dependencia de destino activa.' using errcode = 'P0001';
  end if;
  new.from_department_id := v_doc.current_department_id;
  return new;
end;
$$;

create trigger route_events_before_insert
  before insert on public.document_route_events
  for each row execute function private.route_events_before_insert();

create or replace function private.block_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.purge_allowed() then
    return old;
  end if;
  raise exception 'SIGED_PROTEGIDO: Este historial es de solo anexado; registre una corrección en lugar de modificarlo.'
    using errcode = 'P0001';
end;
$$;

create trigger route_events_append_only
  before update or delete on public.document_route_events
  for each row execute function private.block_append_only();

-- -----------------------------------------------------------------------------
-- Triggers de adjuntos
-- -----------------------------------------------------------------------------
create or replace function private.attachments_before_write()
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
    if exists (select 1 from public.documents where id = new.document_id and status = 'ARCHIVADO') then
      raise exception 'SIGED_PROTEGIDO: El documento está archivado.' using errcode = 'P0001';
    end if;
    if new.replaces_attachment_id is not null and not exists (
      select 1 from public.document_attachments
      where id = new.replaces_attachment_id and document_id = new.document_id
    ) then
      raise exception 'SIGED_VALIDACION: El adjunto reemplazado no pertenece al documento.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if private.purge_allowed() then
      return old;
    end if;
    raise exception 'SIGED_PROTEGIDO: Los adjuntos no se eliminan del registro; utilice la opción de retirar.' using errcode = 'P0001';
  end if;

  -- UPDATE: únicamente se permite retirar (una sola vez) mediante la función.
  if coalesce(current_setting('siged.attachment_removal', true), '') <> 'on' then
    raise exception 'SIGED_PROTEGIDO: Los metadatos del adjunto no pueden modificarse.' using errcode = 'P0001';
  end if;
  if old.removed_at is not null then
    raise exception 'SIGED_PROTEGIDO: El adjunto ya fue retirado.' using errcode = 'P0001';
  end if;
  if (to_jsonb(new) - array['removed_at', 'removed_by', 'removal_reason'])
     is distinct from (to_jsonb(old) - array['removed_at', 'removed_by', 'removal_reason']) then
    raise exception 'SIGED_PROTEGIDO: Solo puede registrarse el retiro del adjunto.' using errcode = 'P0001';
  end if;
  new.removed_at := now();
  new.removed_by := auth.uid();
  return new;
end;
$$;

create trigger attachments_before_write
  before insert or update or delete on public.document_attachments
  for each row execute function private.attachments_before_write();

-- -----------------------------------------------------------------------------
-- Operaciones de flujo (RPC). Se ejecutan como propietario, validan el rol y
-- son atómicas: si algo falla no se modifica nada.
-- -----------------------------------------------------------------------------
create or replace function private.apply_outgoing_milestone(
  p_doc public.documents,
  p_to public.document_status,
  p_clear boolean
)
returns public.documents
language plpgsql
set search_path = ''
as $$
declare
  v_doc public.documents := p_doc;
  v_ts timestamptz := case when p_clear then null else now() end;
begin
  case p_to
    when 'REMITIDO_A_DIRECCION_INVESTIGACION' then v_doc.remitted_to_di_at := v_ts;
    when 'RECIBIDO_EN_DIRECCION_INVESTIGACION' then v_doc.received_at_di_at := v_ts;
    when 'REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO' then v_doc.remitted_to_decanato_at := v_ts;
    when 'RECIBIDO_EN_DECANATO' then v_doc.received_at_decanato_at := v_ts;
    when 'COMPLETADO' then v_doc.completed_at := v_ts;
    when 'ARCHIVADO' then v_doc.archived_at := v_ts;
    else null;
  end case;
  return v_doc;
end;
$$;

create or replace function public.record_outgoing_transition(
  p_document_id uuid,
  p_to_status public.document_status,
  p_expected_status public.document_status,
  p_notes text default null,
  p_attachment_id uuid default null
)
returns public.document_route_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documents;
  v_rule record;
  v_event public.document_route_events;
begin
  perform private.require_admin();

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'SIGED_NO_ENCONTRADO: El documento no existe.' using errcode = 'P0002';
  end if;
  if v_doc.direction <> 'SALIENTE' then
    raise exception 'SIGED_RUTA_INVALIDA: Esta operación aplica solo a documentos salientes.' using errcode = 'P0001';
  end if;
  if v_doc.status is distinct from p_expected_status then
    raise exception 'SIGED_CONFLICTO: El documento cambió de etapa mientras se registraba el movimiento. Actualice la página e intente de nuevo.'
      using errcode = '40001';
  end if;

  select * into v_rule from public.outgoing_transition_rule(v_doc.status, p_to_status);
  if not found then
    if p_to_status in ('REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO', 'RECIBIDO_EN_DECANATO')
       and not private.has_effective_stage(v_doc.id, 'RECIBIDO_EN_DIRECCION_INVESTIGACION') then
      raise exception 'SIGED_RUTA_INVALIDA: Ruta obligatoria: el documento debe pasar por la Dirección de Investigación de la Facultad de Ciencias de la Educación antes de remitirse al Decanato.'
        using errcode = 'P0001';
    end if;
    raise exception 'SIGED_RUTA_INVALIDA: Transición no permitida en la ruta obligatoria (% → %).', v_doc.status, p_to_status
      using errcode = 'P0001';
  end if;

  perform set_config('siged.workflow', 'on', true);

  insert into public.document_route_events (
    document_id, event_type, from_status, to_status, action, notes, attachment_id,
    from_responsible_id, to_responsible_id
  ) values (
    v_doc.id, 'TRANSICION', v_doc.status, p_to_status, v_rule.action_label,
    nullif(btrim(p_notes), ''), p_attachment_id, v_doc.responsible_id, v_doc.responsible_id
  )
  returning * into v_event;

  v_doc := private.apply_outgoing_milestone(v_doc, p_to_status, false);

  update public.documents set
    status = p_to_status,
    current_department_id = private.department_id(v_rule.destination_code),
    remitted_to_di_at = v_doc.remitted_to_di_at,
    received_at_di_at = v_doc.received_at_di_at,
    remitted_to_decanato_at = v_doc.remitted_to_decanato_at,
    received_at_decanato_at = v_doc.received_at_decanato_at,
    completed_at = v_doc.completed_at,
    archived_at = v_doc.archived_at
  where id = v_doc.id;

  perform set_config('siged.workflow', 'off', true);
  return v_event;
end;
$$;

create or replace function public.record_incoming_movement(
  p_document_id uuid,
  p_to_status public.document_status,
  p_expected_status public.document_status,
  p_to_department_id uuid default null,
  p_notes text default null,
  p_attachment_id uuid default null
)
returns public.document_route_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documents;
  v_event public.document_route_events;
  v_to_dept uuid;
  v_action text;
begin
  perform private.require_admin();

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'SIGED_NO_ENCONTRADO: El documento no existe.' using errcode = 'P0002';
  end if;
  if v_doc.direction <> 'ENTRANTE' then
    raise exception 'SIGED_RUTA_INVALIDA: Los documentos salientes deben seguir la ruta obligatoria.' using errcode = 'P0001';
  end if;
  if v_doc.status is distinct from p_expected_status then
    raise exception 'SIGED_CONFLICTO: El documento cambió de estado mientras se registraba el movimiento. Actualice la página e intente de nuevo.'
      using errcode = '40001';
  end if;

  v_to_dept := coalesce(p_to_department_id, v_doc.current_department_id);
  if v_to_dept = v_doc.current_department_id and p_to_status = v_doc.status then
    raise exception 'SIGED_VALIDACION: El movimiento no cambia el estado ni la dependencia. Use una observación.' using errcode = 'P0001';
  end if;

  v_action := case
    when v_to_dept <> v_doc.current_department_id then
      'Trasladado a ' || (select name from public.departments where id = v_to_dept)
    when p_to_status = 'COMPLETADO' then 'Trámite completado'
    when p_to_status = 'ARCHIVADO' then 'Documento archivado'
    else 'Estado actualizado'
  end;

  perform set_config('siged.workflow', 'on', true);

  insert into public.document_route_events (
    document_id, event_type, from_status, to_status, to_department_id, action, notes, attachment_id,
    from_responsible_id, to_responsible_id
  ) values (
    v_doc.id,
    case when v_to_dept <> v_doc.current_department_id then 'MOVIMIENTO' else 'TRANSICION' end::public.route_event_type,
    v_doc.status, p_to_status, v_to_dept, left(v_action, 200), nullif(btrim(p_notes), ''), p_attachment_id,
    v_doc.responsible_id, v_doc.responsible_id
  )
  returning * into v_event;

  update public.documents set
    status = p_to_status,
    current_department_id = v_to_dept,
    completed_at = case
      when p_to_status = 'COMPLETADO' then now()
      when p_to_status = 'ARCHIVADO' then completed_at
      else null end,
    archived_at = case when p_to_status = 'ARCHIVADO' then now() else null end
  where id = v_doc.id;

  perform set_config('siged.workflow', 'off', true);
  return v_event;
end;
$$;

-- Corrección autorizada: revierte el último movimiento vigente conservando el
-- evento original y dejando constancia del motivo y de quien la registra.
create or replace function public.reverse_last_movement(
  p_document_id uuid,
  p_expected_status public.document_status,
  p_reason text
)
returns public.document_route_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documents;
  v_last public.document_route_events;
  v_event public.document_route_events;
begin
  perform private.require_admin();

  if p_reason is null or length(btrim(p_reason)) < 10 then
    raise exception 'SIGED_VALIDACION: Explique el motivo de la corrección (mínimo 10 caracteres).' using errcode = 'P0001';
  end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'SIGED_NO_ENCONTRADO: El documento no existe.' using errcode = 'P0002';
  end if;
  if v_doc.status is distinct from p_expected_status then
    raise exception 'SIGED_CONFLICTO: El documento cambió de etapa. Actualice la página e intente de nuevo.' using errcode = '40001';
  end if;
  if v_doc.status = 'ARCHIVADO' then
    raise exception 'SIGED_PROTEGIDO: No se pueden revertir movimientos de un documento archivado.' using errcode = 'P0001';
  end if;

  v_last := private.last_effective_route_event(v_doc.id);
  if v_last.id is null then
    raise exception 'SIGED_VALIDACION: No hay movimientos que revertir.' using errcode = 'P0001';
  end if;

  perform set_config('siged.workflow', 'on', true);

  insert into public.document_route_events (
    document_id, event_type, from_status, to_status, from_department_id, to_department_id,
    action, notes, reverses_event_id, from_responsible_id, to_responsible_id
  ) values (
    v_doc.id, 'REVERSION', v_doc.status, v_last.from_status, v_doc.current_department_id,
    private.restore_department_for(v_doc.direction, v_last),
    left('Corrección: se revierte «' || v_last.action || '»', 200), btrim(p_reason), v_last.id,
    v_doc.responsible_id, v_doc.responsible_id
  )
  returning * into v_event;

  if v_doc.direction = 'SALIENTE' then
    v_doc := private.apply_outgoing_milestone(v_doc, v_last.to_status, true);
  else
    v_doc.completed_at := case when v_last.from_status = 'COMPLETADO' then v_doc.completed_at else null end;
    v_doc.archived_at := null;
  end if;

  update public.documents set
    status = v_last.from_status,
    current_department_id = v_event.to_department_id,
    remitted_to_di_at = v_doc.remitted_to_di_at,
    received_at_di_at = v_doc.received_at_di_at,
    remitted_to_decanato_at = v_doc.remitted_to_decanato_at,
    received_at_decanato_at = v_doc.received_at_decanato_at,
    completed_at = v_doc.completed_at,
    archived_at = v_doc.archived_at
  where id = v_doc.id;

  perform set_config('siged.workflow', 'off', true);
  return v_event;
end;
$$;

create or replace function public.add_document_observation(
  p_document_id uuid,
  p_notes text,
  p_attachment_id uuid default null
)
returns public.document_route_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.document_route_events;
begin
  perform private.require_admin();
  if p_notes is null or length(btrim(p_notes)) < 3 then
    raise exception 'SIGED_VALIDACION: Escriba la observación.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.documents where id = p_document_id and status = 'ARCHIVADO') then
    raise exception 'SIGED_PROTEGIDO: El documento está archivado.' using errcode = 'P0001';
  end if;

  insert into public.document_route_events (document_id, event_type, action, notes, attachment_id)
  values (p_document_id, 'OBSERVACION', 'Observación de seguimiento', btrim(p_notes), p_attachment_id)
  returning * into v_event;
  return v_event;
end;
$$;

create or replace function public.remove_attachment(p_attachment_id uuid, p_reason text)
returns public.document_attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.document_attachments;
begin
  perform private.require_admin();
  if p_reason is null or length(btrim(p_reason)) < 5 then
    raise exception 'SIGED_VALIDACION: Indique el motivo del retiro (mínimo 5 caracteres).' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.document_attachments a join public.documents d on d.id = a.document_id
    where a.id = p_attachment_id and d.status = 'ARCHIVADO'
  ) then
    raise exception 'SIGED_PROTEGIDO: El documento está archivado.' using errcode = 'P0001';
  end if;

  perform set_config('siged.attachment_removal', 'on', true);
  update public.document_attachments
    set removed_at = now(), removed_by = auth.uid(), removal_reason = btrim(p_reason)
  where id = p_attachment_id
  returning * into v_row;
  perform set_config('siged.attachment_removal', 'off', true);

  if v_row.id is null then
    raise exception 'SIGED_NO_ENCONTRADO: El adjunto no existe.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- >>>>>>>>>>>>>>>>>>>> 20261021000300_procedures.sql <<<<<<<<<<<<<<<<<<<<
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

-- >>>>>>>>>>>>>>>>>>>> 20261021000400_audit_notifications_admin.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================================
-- SIGED-INEDUC · Migración 0400 · Auditoría, notificaciones y administración
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Bitácora de auditoría (solo anexar; lectura exclusiva de administradores)
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  action text not null,
  table_name text,
  record_id text,
  summary text,
  changes jsonb
);

create index audit_logs_occurred_idx on public.audit_logs (occurred_at desc);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id);

create or replace function private.write_audit(
  p_action text,
  p_table text,
  p_record_id text,
  p_summary text,
  p_changes jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (occurred_at, actor_id, actor_email, action, table_name, record_id, summary, changes)
  values (
    now(),
    auth.uid(),
    (select email from public.profiles where id = auth.uid()),
    p_action, p_table, p_record_id, p_summary, p_changes
  );
end;
$$;

create or replace function private.audit_logs_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.occurred_at := now();
  return new;
end;
$$;

create trigger audit_logs_before_insert before insert on public.audit_logs
  for each row execute function private.audit_logs_before_insert();
create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function private.block_append_only();

create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_excluded text[] := array['search_text', 'updated_at', 'updated_by'];
  v_changes jsonb;
  v_id text;
begin
  if tg_op = 'INSERT' then
    v_changes := to_jsonb(new) - v_excluded;
    v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'code', to_jsonb(new) ->> 'document_id');
    perform private.write_audit('CREACION', tg_table_name, v_id, null, v_changes);
    return null;
  elsif tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('anterior', o.value, 'nuevo', n.value))
      into v_changes
    from jsonb_each(to_jsonb(new) - v_excluded) n
    join jsonb_each(to_jsonb(old)) o on o.key = n.key
    where n.value is distinct from o.value;
    if v_changes is null then
      return null;
    end if;
    v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'code', to_jsonb(new) ->> 'document_id');
    perform private.write_audit('ACTUALIZACION', tg_table_name, v_id, null, v_changes);
    return null;
  else
    v_id := coalesce(to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'code', to_jsonb(old) ->> 'document_id');
    perform private.write_audit('ELIMINACION', tg_table_name, v_id, null, to_jsonb(old) - v_excluded);
    return null;
  end if;
end;
$$;

create trigger audit_documents after insert or update or delete on public.documents
  for each row execute function private.audit_row();
create trigger audit_procedures after insert or update or delete on public.procedures
  for each row execute function private.audit_row();
create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function private.audit_row();
create trigger audit_departments after insert or update or delete on public.departments
  for each row execute function private.audit_row();
create trigger audit_document_types after insert or update or delete on public.document_types
  for each row execute function private.audit_row();
create trigger audit_priorities after insert or update or delete on public.priorities
  for each row execute function private.audit_row();
create trigger audit_procedure_categories after insert or update or delete on public.procedure_categories
  for each row execute function private.audit_row();
create trigger audit_app_settings after insert or update or delete on public.app_settings
  for each row execute function private.audit_row();
create trigger audit_document_access after insert or update or delete on public.document_access
  for each row execute function private.audit_row();
create trigger audit_document_attachments after insert or update or delete on public.document_attachments
  for each row execute function private.audit_row();
create trigger audit_route_events after insert on public.document_route_events
  for each row execute function private.audit_row();

create or replace function private.document_access_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.granted_by := auth.uid();
  new.granted_at := now();
  return new;
end;
$$;

create trigger document_access_before_insert before insert on public.document_access
  for each row execute function private.document_access_before_insert();

-- -----------------------------------------------------------------------------
-- Notificaciones internas
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text check (link is null or link ~ '^/[A-Za-z0-9/_\-?=&%.]*$'),
  document_id uuid references public.documents (id) on delete cascade,
  procedure_id uuid references public.procedures (id) on delete cascade,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (recipient_id, dedupe_key)
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

create or replace function private.notifications_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Solo se permite marcar como leída/no leída.
  if (to_jsonb(new) - 'read_at') is distinct from (to_jsonb(old) - 'read_at') then
    raise exception 'SIGED_PROTEGIDO: Solo puede cambiarse el estado de lectura.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger notifications_before_update before update on public.notifications
  for each row execute function private.notifications_before_update();

-- Inserta una notificación por destinatario, omitiendo al autor del evento,
-- usuarios inactivos y usuarios sin acceso al documento. Evita duplicados.
create or replace function private.notify(
  p_recipients uuid[],
  p_kind text,
  p_title text,
  p_body text,
  p_link text,
  p_document_id uuid,
  p_procedure_id uuid,
  p_dedupe_key text,
  p_skip_actor boolean default true
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notifications (recipient_id, kind, title, body, link, document_id, procedure_id, dedupe_key)
  select distinct r.id, p_kind, left(p_title, 200), left(p_body, 1000), p_link, p_document_id, p_procedure_id, p_dedupe_key
  from unnest(p_recipients) as u(id)
  join public.profiles r on r.id = u.id and r.status = 'ACTIVO'
  where u.id is not null
    and (not p_skip_actor or auth.uid() is null or u.id <> auth.uid())
    and (p_document_id is null or private.user_can_view_document(u.id, p_document_id))
  on conflict (recipient_id, dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function private.active_admin_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(id), '{}') from public.profiles where role = 'ADMINISTRADOR' and status = 'ACTIVO'
$$;

create or replace function private.document_label(p_doc public.documents)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(p_doc.official_number, p_doc.internal_reference) || ' · ' || left(p_doc.subject, 120)
$$;

create or replace function private.route_events_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documents;
  v_dept text;
  v_link text;
  v_label text;
  v_title text;
  v_kind text;
begin
  select * into v_doc from public.documents where id = new.document_id;
  v_link := '/documentos/' || v_doc.id;
  v_label := private.document_label(v_doc);
  select name into v_dept from public.departments where id = new.to_department_id;

  if new.event_type = 'REGISTRO' then
    if v_doc.direction = 'ENTRANTE' then
      perform private.notify(private.active_admin_ids() || array[v_doc.responsible_id],
        'DOCUMENTO_ENTRANTE', 'Nuevo documento entrante registrado', v_label, v_link,
        v_doc.id, null, 'route-event:' || new.id);
    end if;
    if v_doc.responsible_id is not null then
      perform private.notify(array[v_doc.responsible_id],
        'ASIGNACION', 'Se le asignó un documento', v_label, v_link,
        v_doc.id, null, 'assign:' || new.id);
    end if;
    return null;
  end if;

  if new.event_type = 'ASIGNACION' then
    if new.to_responsible_id is not null then
      perform private.notify(array[new.to_responsible_id],
        'ASIGNACION', 'Se le asignó un documento', v_label, v_link,
        v_doc.id, null, 'assign:' || new.id);
    end if;
    return null;
  end if;

  if new.event_type = 'OBSERVACION' then
    perform private.notify(array[v_doc.responsible_id],
      'OBSERVACION', 'Nueva observación en un documento asignado', v_label, v_link,
      v_doc.id, null, 'route-event:' || new.id);
    return null;
  end if;

  if new.event_type = 'REVERSION' then
    v_kind := 'CORRECCION';
    v_title := 'Movimiento corregido';
  elsif new.to_status = 'REMITIDO_A_DIRECCION_INVESTIGACION' then
    v_kind := 'REMISION';
    v_title := 'Documento remitido a la Dirección de Investigación';
  elsif new.to_status = 'REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO' then
    v_kind := 'REMISION';
    v_title := 'Documento remitido al Decanato';
  elsif new.to_status in ('RECIBIDO_EN_DIRECCION_INVESTIGACION', 'RECIBIDO_EN_DECANATO') then
    v_kind := 'RECEPCION';
    v_title := 'Recepción registrada en ' || coalesce(v_dept, 'la dependencia');
  elsif new.event_type = 'MOVIMIENTO' then
    v_kind := 'MOVIMIENTO';
    v_title := 'Documento trasladado a ' || coalesce(v_dept, 'otra dependencia');
  else
    v_kind := 'CAMBIO_ETAPA';
    v_title := 'Cambio de etapa: ' || new.action;
  end if;

  perform private.notify(
    private.active_admin_ids() || array[v_doc.responsible_id, v_doc.created_by],
    v_kind, v_title, v_label, v_link, v_doc.id, null, 'route-event:' || new.id);
  return null;
end;
$$;

create trigger route_events_notify after insert on public.document_route_events
  for each row execute function private.route_events_notify();

create or replace function private.procedures_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.responsible_id is not null
     and (tg_op = 'INSERT' or new.responsible_id is distinct from old.responsible_id) then
    perform private.notify(array[new.responsible_id],
      'TRAMITE_ASIGNADO', 'Se le asignó un trámite', new.reference || ' · ' || left(new.title, 120),
      '/tramites/' || new.id, new.document_id, new.id,
      'proc-assign:' || new.id || ':' || new.responsible_id || ':' || extract(epoch from now())::bigint);
  end if;
  return null;
end;
$$;

create trigger procedures_notify after insert or update on public.procedures
  for each row execute function private.procedures_notify();

-- -----------------------------------------------------------------------------
-- Alertas de plazos (idempotente; se ejecuta por pg_cron y al abrir el panel)
-- -----------------------------------------------------------------------------
create table private.job_state (
  name text primary key,
  last_run_at timestamptz not null
);

create or replace function public.refresh_deadline_notifications(p_force boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.app_settings;
  v_today date := private.today_do();
  v_total integer := 0;
  v_n integer;
  r record;
begin
  -- Usuarios autenticados inactivos no pueden ejecutarla.
  if auth.uid() is not null and not private.is_active_user() then
    raise exception 'SIGED_NO_AUTORIZADO: Cuenta no autorizada.' using errcode = '42501';
  end if;

  -- Limita la frecuencia cuando la invoca la interfaz (10 minutos).
  if not p_force or auth.uid() is not null then
    if exists (
      select 1 from private.job_state
      where name = 'deadline_notifications' and last_run_at > now() - interval '10 minutes'
    ) then
      return 0;
    end if;
  end if;
  insert into private.job_state (name, last_run_at) values ('deadline_notifications', now())
  on conflict (name) do update set last_run_at = excluded.last_run_at;

  select * into v_settings from public.app_settings where id;

  for r in
    select p.* from public.procedures p
    where p.status not in ('COMPLETADO', 'CANCELADO') and p.due_date is not null
      and p.due_date <= v_today + v_settings.deadline_warning_days
  loop
    if r.due_date < v_today then
      v_n := private.notify(private.active_admin_ids() || array[r.responsible_id],
        'TRAMITE_VENCIDO', 'Trámite vencido', r.reference || ' · ' || left(r.title, 120),
        '/tramites/' || r.id, r.document_id, r.id, 'proc-overdue:' || r.id || ':' || r.due_date, false);
    else
      v_n := private.notify(array[r.responsible_id] || private.active_admin_ids(),
        'TRAMITE_POR_VENCER', 'Trámite próximo a vencer', r.reference || ' · ' || left(r.title, 120),
        '/tramites/' || r.id, r.document_id, r.id, 'proc-due-soon:' || r.id || ':' || r.due_date, false);
    end if;
    v_total := v_total + v_n;
  end loop;

  for r in
    select d.* from public.documents d
    where d.status not in ('COMPLETADO', 'ARCHIVADO') and d.due_date is not null
      and d.due_date <= v_today + v_settings.deadline_warning_days
  loop
    if r.due_date < v_today then
      v_n := private.notify(private.active_admin_ids() || array[r.responsible_id],
        'DOCUMENTO_VENCIDO', 'Documento con plazo vencido', coalesce(r.official_number, r.internal_reference) || ' · ' || left(r.subject, 120),
        '/documentos/' || r.id, r.id, null, 'doc-overdue:' || r.id || ':' || r.due_date, false);
    else
      v_n := private.notify(private.active_admin_ids() || array[r.responsible_id],
        'DOCUMENTO_POR_VENCER', 'Documento próximo a su fecha límite', coalesce(r.official_number, r.internal_reference) || ' · ' || left(r.subject, 120),
        '/documentos/' || r.id, r.id, null, 'doc-due-soon:' || r.id || ':' || r.due_date, false);
    end if;
    v_total := v_total + v_n;
  end loop;

  for r in
    select d.* from public.documents d
    where d.status not in ('COMPLETADO', 'ARCHIVADO')
      and d.stage_changed_at < now() - make_interval(days => v_settings.stale_stage_days)
  loop
    v_n := private.notify(private.active_admin_ids() || array[r.responsible_id],
      'REQUIERE_ATENCION', 'Documento sin movimiento: requiere atención',
      coalesce(r.official_number, r.internal_reference) || ' · ' || left(r.subject, 120),
      '/documentos/' || r.id, r.id, null,
      'doc-stale:' || r.id || ':' || extract(epoch from r.stage_changed_at)::bigint, false);
    v_total := v_total + v_n;
  end loop;

  return v_total;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if not private.is_active_user() then
    raise exception 'SIGED_NO_AUTORIZADO: Cuenta no autorizada.' using errcode = '42501';
  end if;
  update public.notifications set read_at = now()
  where recipient_id = auth.uid() and read_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- -----------------------------------------------------------------------------
-- Administración de usuarios
-- -----------------------------------------------------------------------------
create or replace function private.ensure_other_admin_remains(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where role = 'ADMINISTRADOR' and status = 'ACTIVO' and id <> p_user_id
  ) then
    raise exception 'SIGED_VALIDACION: Debe existir al menos un administrador activo.' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.app_role)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.profiles;
begin
  perform private.require_admin();
  if p_user_id = auth.uid() then
    raise exception 'SIGED_NO_AUTORIZADO: No puede cambiar el rol de su propia cuenta.' using errcode = '42501';
  end if;
  select * into v_row from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'SIGED_NO_ENCONTRADO: Usuario inexistente.' using errcode = 'P0002';
  end if;
  if v_row.role = 'ADMINISTRADOR' and p_role <> 'ADMINISTRADOR' then
    perform private.ensure_other_admin_remains(p_user_id);
  end if;
  perform set_config('siged.role_admin', 'on', true);
  update public.profiles set role = p_role where id = p_user_id returning * into v_row;
  perform set_config('siged.role_admin', 'off', true);
  return v_row;
end;
$$;

create or replace function public.admin_set_user_status(p_user_id uuid, p_status public.account_status)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.profiles;
begin
  perform private.require_admin();
  if p_user_id = auth.uid() then
    raise exception 'SIGED_NO_AUTORIZADO: No puede cambiar el estado de su propia cuenta.' using errcode = '42501';
  end if;
  select * into v_row from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'SIGED_NO_ENCONTRADO: Usuario inexistente.' using errcode = 'P0002';
  end if;
  if v_row.role = 'ADMINISTRADOR' and p_status <> 'ACTIVO' then
    perform private.ensure_other_admin_remains(p_user_id);
  end if;
  perform set_config('siged.role_admin', 'on', true);
  update public.profiles set status = p_status where id = p_user_id returning * into v_row;
  perform set_config('siged.role_admin', 'off', true);
  return v_row;
end;
$$;

create or replace function public.admin_update_user_profile(
  p_user_id uuid,
  p_full_name text,
  p_job_title text,
  p_department_id uuid default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.profiles;
begin
  perform private.require_admin();
  if p_full_name is null or length(btrim(p_full_name)) < 3 then
    raise exception 'SIGED_VALIDACION: Escriba el nombre completo.' using errcode = 'P0001';
  end if;
  update public.profiles set
    full_name = btrim(p_full_name),
    job_title = nullif(btrim(p_job_title), ''),
    department_id = p_department_id
  where id = p_user_id
  returning * into v_row;
  if v_row.id is null then
    raise exception 'SIGED_NO_ENCONTRADO: Usuario inexistente.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

create or replace function public.update_my_profile(p_full_name text, p_job_title text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.profiles;
begin
  if not private.is_active_user() then
    raise exception 'SIGED_NO_AUTORIZADO: Cuenta no autorizada.' using errcode = '42501';
  end if;
  if p_full_name is null or length(btrim(p_full_name)) < 3 then
    raise exception 'SIGED_VALIDACION: Escriba su nombre completo.' using errcode = 'P0001';
  end if;
  update public.profiles set
    full_name = btrim(p_full_name),
    job_title = nullif(btrim(p_job_title), '')
  where id = auth.uid()
  returning * into v_row;
  return v_row;
end;
$$;

-- Designación del PRIMER administrador durante el despliegue. Solo puede
-- invocarla el rol de servicio (o el editor SQL) y únicamente si aún no existe
-- ningún administrador activo.
create or replace function public.bootstrap_first_admin(p_email text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.profiles;
begin
  if exists (select 1 from public.profiles where role = 'ADMINISTRADOR' and status = 'ACTIVO') then
    raise exception 'SIGED_NO_AUTORIZADO: Ya existe un administrador activo. Use la sección de Administración.'
      using errcode = '42501';
  end if;
  select * into v_row from public.profiles where lower(email) = lower(btrim(p_email)) for update;
  if not found then
    raise exception 'SIGED_NO_ENCONTRADO: No existe una cuenta con ese correo. Créela o invítela primero.'
      using errcode = 'P0002';
  end if;
  perform set_config('siged.role_admin', 'on', true);
  update public.profiles set role = 'ADMINISTRADOR', status = 'ACTIVO' where id = v_row.id returning * into v_row;
  perform set_config('siged.role_admin', 'off', true);
  perform private.write_audit('ADMINISTRADOR_INICIAL', 'profiles', v_row.id::text,
    'Designación del primer administrador durante el despliegue', jsonb_build_object('email', v_row.email));
  return v_row;
end;
$$;

create or replace function public.log_report_export(p_report text, p_format text, p_filters jsonb, p_rows integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_user() then
    raise exception 'SIGED_NO_AUTORIZADO: Cuenta no autorizada.' using errcode = '42501';
  end if;
  perform private.write_audit('EXPORTACION', 'reportes', left(p_report, 80),
    'Exportación de reporte (' || left(p_format, 10) || ')',
    jsonb_build_object('filtros', p_filters, 'filas', p_rows));
end;
$$;

-- Limpieza de datos de demostración (solo rol de servicio / editor SQL).
create or replace function public.purge_demo_data()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  perform set_config('siged.allow_purge', 'on', true);
  delete from public.notifications where document_id in (select id from public.documents where is_demo)
    or procedure_id in (select id from public.procedures where is_demo);
  delete from public.procedures where is_demo or document_id in (select id from public.documents where is_demo);
  delete from public.documents where is_demo;
  get diagnostics v_n = row_count;
  perform set_config('siged.allow_purge', 'off', true);
  perform private.write_audit('PURGA_DEMOSTRACION', 'documents', null,
    'Eliminación de datos ficticios de demostración', jsonb_build_object('documentos', v_n));
  return v_n;
end;
$$;

-- >>>>>>>>>>>>>>>>>>>> 20261021000500_security_views.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================================
-- SIGED-INEDUC · Migración 0500 · Seguridad (RLS y permisos), vistas y panel
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Vistas de consulta (security_invoker: aplican la RLS del usuario que consulta)
-- -----------------------------------------------------------------------------
create or replace view public.document_overview
with (security_invoker = true) as
select
  d.id,
  d.direction,
  d.internal_reference,
  d.official_number,
  d.subject,
  d.description,
  d.document_type_id,
  dt.name as document_type_name,
  d.priority_code,
  pr.name as priority_name,
  pr.weight as priority_weight,
  d.status,
  d.current_department_id,
  cd.code as current_department_code,
  cd.name as current_department_name,
  coalesce(cd.short_name, cd.name) as current_department_short_name,
  d.sender_name,
  d.sender_institution,
  d.origin_department_id,
  d.recipient_department_id,
  rd.name as recipient_department_name,
  d.received_on,
  d.received_by_name,
  d.recipient_name,
  d.destination_institution,
  d.issued_on,
  d.responsible_id,
  rp.full_name as responsible_name,
  d.due_date,
  d.next_action,
  d.observations,
  d.visibility,
  d.registered_at,
  d.remitted_to_di_at,
  d.received_at_di_at,
  d.remitted_to_decanato_at,
  d.received_at_decanato_at,
  d.completed_at,
  d.archived_at,
  d.stage_changed_at,
  d.created_by,
  cb.full_name as created_by_name,
  d.updated_by,
  ub.full_name as updated_by_name,
  d.created_at,
  d.updated_at,
  d.search_text,
  (d.status not in ('COMPLETADO', 'ARCHIVADO')) as is_open,
  (d.status = 'ARCHIVADO') as is_archived,
  (d.status not in ('COMPLETADO', 'ARCHIVADO') and d.due_date is not null and d.due_date < private.today_do()) as is_overdue,
  (d.status not in ('COMPLETADO', 'ARCHIVADO') and d.due_date is not null
     and d.due_date between private.today_do() and private.today_do() + s.deadline_warning_days) as is_due_soon,
  (d.status in ('REMITIDO_A_DIRECCION_INVESTIGACION', 'REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO', 'REMITIDO')) as awaiting_handoff,
  (d.status not in ('COMPLETADO', 'ARCHIVADO')
     and d.stage_changed_at < now() - make_interval(days => s.stale_stage_days)) as is_stale,
  case when d.due_date is null then null else d.due_date - private.today_do() end as days_to_due
from public.documents d
cross join public.app_settings s
left join public.document_types dt on dt.id = d.document_type_id
left join public.priorities pr on pr.code = d.priority_code
left join public.departments cd on cd.id = d.current_department_id
left join public.departments rd on rd.id = d.recipient_department_id
left join public.profiles rp on rp.id = d.responsible_id
left join public.profiles cb on cb.id = d.created_by
left join public.profiles ub on ub.id = d.updated_by;

create or replace view public.procedure_overview
with (security_invoker = true) as
select
  p.id,
  p.reference,
  p.title,
  p.description,
  p.document_id,
  d.direction as document_direction,
  coalesce(d.official_number, d.internal_reference) as document_reference,
  d.subject as document_subject,
  p.category_id,
  c.name as category_name,
  p.responsible_id,
  rp.full_name as responsible_name,
  p.responsible_department_id,
  dep.name as responsible_department_name,
  coalesce(dep.short_name, dep.name) as responsible_department_short_name,
  dep.code as responsible_department_code,
  p.status,
  p.priority_code,
  pr.name as priority_name,
  pr.weight as priority_weight,
  p.start_date,
  p.due_date,
  p.next_action,
  p.notes,
  p.completed_at,
  p.created_by,
  cb.full_name as created_by_name,
  p.updated_by,
  ub.full_name as updated_by_name,
  p.created_at,
  p.updated_at,
  p.search_text,
  (p.status not in ('COMPLETADO', 'CANCELADO')) as is_open,
  (p.status not in ('COMPLETADO', 'CANCELADO') and p.due_date is not null and p.due_date < private.today_do()) as is_overdue,
  (p.status not in ('COMPLETADO', 'CANCELADO') and p.due_date is not null
     and p.due_date between private.today_do() and private.today_do() + s.deadline_warning_days) as is_due_soon,
  case when p.due_date is null then null else p.due_date - private.today_do() end as days_to_due
from public.procedures p
cross join public.app_settings s
left join public.documents d on d.id = p.document_id
left join public.procedure_categories c on c.id = p.category_id
left join public.profiles rp on rp.id = p.responsible_id
left join public.departments dep on dep.id = p.responsible_department_id
left join public.priorities pr on pr.code = p.priority_code
left join public.profiles cb on cb.id = p.created_by
left join public.profiles ub on ub.id = p.updated_by;

create or replace view public.route_event_overview
with (security_invoker = true) as
select
  e.id,
  e.seq,
  e.document_id,
  d.direction as document_direction,
  d.internal_reference as document_internal_reference,
  d.official_number as document_official_number,
  d.subject as document_subject,
  e.event_type,
  e.from_status,
  e.to_status,
  e.from_department_id,
  fd.name as from_department_name,
  coalesce(fd.short_name, fd.name) as from_department_short_name,
  e.to_department_id,
  td.name as to_department_name,
  coalesce(td.short_name, td.name) as to_department_short_name,
  e.action,
  e.notes,
  e.attachment_id,
  e.reverses_event_id,
  (exists (select 1 from public.document_route_events r where r.reverses_event_id = e.id)) as is_reversed,
  e.from_responsible_id,
  e.to_responsible_id,
  tr.full_name as to_responsible_name,
  e.recorded_by,
  rb.full_name as recorded_by_name,
  rb.email as recorded_by_email,
  e.occurred_at,
  e.created_at
from public.document_route_events e
join public.documents d on d.id = e.document_id
left join public.departments fd on fd.id = e.from_department_id
left join public.departments td on td.id = e.to_department_id
left join public.profiles rb on rb.id = e.recorded_by
left join public.profiles tr on tr.id = e.to_responsible_id;

create or replace view public.procedure_event_overview
with (security_invoker = true) as
select
  e.id,
  e.seq,
  e.procedure_id,
  p.reference as procedure_reference,
  p.title as procedure_title,
  e.event_type,
  e.from_status,
  e.to_status,
  e.from_responsible_id,
  fr.full_name as from_responsible_name,
  e.to_responsible_id,
  tr.full_name as to_responsible_name,
  e.changes,
  e.notes,
  e.recorded_by,
  rb.full_name as recorded_by_name,
  e.occurred_at
from public.procedure_events e
join public.procedures p on p.id = e.procedure_id
left join public.profiles fr on fr.id = e.from_responsible_id
left join public.profiles tr on tr.id = e.to_responsible_id
left join public.profiles rb on rb.id = e.recorded_by;

-- -----------------------------------------------------------------------------
-- Indicadores del panel principal (respetan la RLS del usuario)
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_summary(p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_from date := p_from;
  v_to date := coalesce(p_to, private.today_do());
  v_unit text;
  v_result jsonb;
begin
  if not private.is_active_user() then
    raise exception 'SIGED_NO_AUTORIZADO: Cuenta no autorizada.' using errcode = '42501';
  end if;
  if v_from is null then
    -- Sin fecha inicial: desde el registro más antiguo (documentos o trámites).
    v_from := coalesce(
      least(
        (select min((registered_at at time zone 'America/Santo_Domingo')::date) from public.documents),
        (select min(start_date) from public.procedures)
      ),
      v_to - 365
    );
  end if;
  if v_from > v_to then
    raise exception 'SIGED_VALIDACION: La fecha inicial no puede ser posterior a la final.' using errcode = '22007';
  end if;
  v_unit := case when v_to - v_from <= 31 then 'day' when v_to - v_from <= 184 then 'week' else 'month' end;

  with docs as (
    select * from public.document_overview o
    where (o.registered_at at time zone 'America/Santo_Domingo')::date between v_from and v_to
  ),
  procs as (
    select * from public.procedure_overview o
    where o.start_date between v_from and v_to
  ),
  buckets as (
    select generate_series(date_trunc(v_unit, v_from::timestamp), date_trunc(v_unit, v_to::timestamp), ('1 ' || v_unit)::interval)::date as bucket
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', v_from, 'to', v_to, 'unit', v_unit),
    'kpis', jsonb_build_object(
      'incoming_total', (select count(*) from docs where direction = 'ENTRANTE'),
      'outgoing_total', (select count(*) from docs where direction = 'SALIENTE'),
      'procedures_pending', (select count(*) from procs where is_open),
      'procedures_overdue', (select count(*) from procs where is_overdue),
      'documents_in_follow_up', (select count(*) from docs where is_open),
      'documents_completed', (select count(*) from docs where not is_open),
      'documents_needing_attention', (select count(*) from docs where is_open and (is_overdue or is_stale or responsible_id is null)),
      'documents_awaiting_handoff', (select count(*) from docs where awaiting_handoff),
      'documents_updated_recently', (select count(*) from docs where updated_at > now() - interval '7 days')
    ),
    'by_department', coalesce((
      select jsonb_agg(x order by x.sort_order, x.name) from (
        select dep.id, dep.code, dep.name, coalesce(dep.short_name, dep.name) as short_name, dep.sort_order,
               dep.contact_name, dep.contact_title,
               count(d.id) filter (where d.is_open) as open_count,
               count(d.id) filter (where d.is_open and d.awaiting_handoff) as awaiting_count,
               count(d.id) filter (where d.is_open and d.is_overdue) as overdue_count
        from public.departments dep
        left join docs d on d.current_department_id = dep.id
        where dep.is_system or exists (select 1 from docs d2 where d2.current_department_id = dep.id and d2.is_open)
        group by dep.id
      ) x
    ), '[]'::jsonb),
    'by_status', coalesce((
      select jsonb_agg(jsonb_build_object('direction', direction, 'status', status, 'count', n) order by direction, status)
      from (select direction, status, count(*) as n from docs group by direction, status) s
    ), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'bucket', b.bucket,
        'incoming', (select count(*) from docs d where d.direction = 'ENTRANTE'
                       and date_trunc(v_unit, (d.registered_at at time zone 'America/Santo_Domingo'))::date = b.bucket),
        'outgoing', (select count(*) from docs d where d.direction = 'SALIENTE'
                       and date_trunc(v_unit, (d.registered_at at time zone 'America/Santo_Domingo'))::date = b.bucket)
      ) order by b.bucket)
      from buckets b
    ), '[]'::jsonb),
    'procedures_by_department', coalesce((
      select jsonb_agg(jsonb_build_object('department', name, 'pending', pending, 'overdue', overdue) order by pending desc, name)
      from (
        select coalesce(responsible_department_short_name, 'Sin dependencia') as name,
               count(*) filter (where is_open) as pending,
               count(*) filter (where is_overdue) as overdue
        from procs group by 1
      ) q where pending > 0
    ), '[]'::jsonb),
    'by_priority', coalesce((
      select jsonb_agg(jsonb_build_object('code', pr.code, 'name', pr.name,
        'documents', (select count(*) from docs d where d.is_open and d.priority_code = pr.code),
        'procedures', (select count(*) from procs p where p.is_open and p.priority_code = pr.code)
      ) order by pr.weight)
      from public.priorities pr
    ), '[]'::jsonb),
    'procedures_completion', jsonb_build_object(
      'completed', (select count(*) from procs where status = 'COMPLETADO'),
      'pending', (select count(*) from procs where is_open),
      'cancelled', (select count(*) from procs where status = 'CANCELADO')
    )
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.departments enable row level security;
alter table public.priorities enable row level security;
alter table public.document_types enable row level security;
alter table public.procedure_categories enable row level security;
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.document_counters enable row level security;
alter table public.documents enable row level security;
alter table public.document_access enable row level security;
alter table public.document_attachments enable row level security;
alter table public.document_route_events enable row level security;
alter table public.procedure_counters enable row level security;
alter table public.procedures enable row level security;
alter table public.procedure_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

-- Catálogos: lectura para personal activo; escritura solo administradores.
create policy departments_select on public.departments for select to authenticated
  using ((select private.is_active_user()));
create policy departments_insert on public.departments for insert to authenticated
  with check ((select private.is_admin()));
create policy departments_update on public.departments for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy priorities_select on public.priorities for select to authenticated
  using ((select private.is_active_user()));
create policy priorities_insert on public.priorities for insert to authenticated
  with check ((select private.is_admin()));
create policy priorities_update on public.priorities for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy document_types_select on public.document_types for select to authenticated
  using ((select private.is_active_user()));
create policy document_types_insert on public.document_types for insert to authenticated
  with check ((select private.is_admin()));
create policy document_types_update on public.document_types for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy procedure_categories_select on public.procedure_categories for select to authenticated
  using ((select private.is_active_user()));
create policy procedure_categories_insert on public.procedure_categories for insert to authenticated
  with check ((select private.is_admin()));
create policy procedure_categories_update on public.procedure_categories for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy app_settings_select on public.app_settings for select to authenticated
  using ((select private.is_active_user()));
create policy app_settings_update on public.app_settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Perfiles: el personal activo ve el directorio; cada quien ve su propio
-- perfil aunque esté suspendido (para mostrar el aviso correspondiente).
-- No hay políticas de escritura: los cambios pasan por funciones validadas.
create policy profiles_select on public.profiles for select to authenticated
  using ((select private.is_active_user()) or id = (select auth.uid()));

-- Documentos.
create policy documents_select on public.documents for select to authenticated
  using (
    (select private.is_admin())
    or (
      (select private.is_active_user())
      and (
        visibility = 'GENERAL'
        or responsible_id = (select auth.uid())
        or private.has_document_access(id)
      )
    )
  );
create policy documents_insert on public.documents for insert to authenticated
  with check ((select private.is_admin()));
create policy documents_update on public.documents for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy document_access_select on public.document_access for select to authenticated
  using ((select private.is_admin()) or user_id = (select auth.uid()));
create policy document_access_insert on public.document_access for insert to authenticated
  with check ((select private.is_admin()));
create policy document_access_delete on public.document_access for delete to authenticated
  using ((select private.is_admin()));

create policy attachments_select on public.document_attachments for select to authenticated
  using (
    (select private.is_admin())
    or (removed_at is null and private.can_view_document(document_id))
  );
create policy attachments_insert on public.document_attachments for insert to authenticated
  with check ((select private.is_admin()));

create policy route_events_select on public.document_route_events for select to authenticated
  using ((select private.is_admin()) or private.can_view_document(document_id));

create policy procedures_select on public.procedures for select to authenticated
  using (
    (select private.is_admin())
    or (
      (select private.is_active_user())
      and (document_id is null or private.can_view_document(document_id) or responsible_id = (select auth.uid()))
    )
  );
create policy procedures_insert on public.procedures for insert to authenticated
  with check ((select private.is_admin()));
create policy procedures_update on public.procedures for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy procedure_events_select on public.procedure_events for select to authenticated
  using ((select private.is_admin()) or private.can_view_procedure(procedure_id));

create policy audit_logs_select on public.audit_logs for select to authenticated
  using ((select private.is_admin()));

create policy notifications_select on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()) and (select private.is_active_user()));
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()) and (select private.is_active_user()))
  with check (recipient_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Permisos (mínimo privilegio). `anon` no tiene acceso a ningún dato.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon, public;

grant select on
  public.departments, public.priorities, public.document_types, public.procedure_categories,
  public.app_settings, public.profiles, public.documents, public.document_access,
  public.document_attachments, public.document_route_events, public.procedures,
  public.procedure_events, public.audit_logs, public.notifications,
  public.document_overview, public.procedure_overview, public.route_event_overview,
  public.procedure_event_overview
to authenticated;

grant insert, update on public.departments, public.priorities, public.document_types,
  public.procedure_categories, public.documents, public.procedures to authenticated;
grant update on public.app_settings to authenticated;
grant insert on public.document_attachments to authenticated;
grant insert, delete on public.document_access to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Funciones auxiliares que las políticas y vistas evalúan como el usuario.
grant execute on function
  private.is_active_user(), private.is_admin(), private.can_view_document(uuid),
  private.has_document_access(uuid), private.can_view_procedure(uuid), private.today_do(),
  private.department_id(text)
to authenticated;

-- Funciones públicas (RPC) disponibles para usuarios autenticados. Cada una
-- valida internamente el rol requerido.
grant execute on function
  public.normalize_search(text),
  public.outgoing_stage_department_code(public.document_status),
  public.is_outgoing_status(public.document_status),
  public.is_incoming_status(public.document_status),
  public.outgoing_transition_rule(public.document_status, public.document_status),
  public.get_outgoing_route_definition(),
  public.record_outgoing_transition(uuid, public.document_status, public.document_status, text, uuid),
  public.record_incoming_movement(uuid, public.document_status, public.document_status, uuid, text, uuid),
  public.reverse_last_movement(uuid, public.document_status, text),
  public.add_document_observation(uuid, text, uuid),
  public.remove_attachment(uuid, text),
  public.change_procedure_status(uuid, public.procedure_status, text),
  public.add_procedure_observation(uuid, text),
  public.refresh_deadline_notifications(boolean),
  public.mark_all_notifications_read(),
  public.admin_set_user_role(uuid, public.app_role),
  public.admin_set_user_status(uuid, public.account_status),
  public.admin_update_user_profile(uuid, text, text, uuid),
  public.update_my_profile(text, text),
  public.log_report_export(text, text, jsonb, integer),
  public.dashboard_summary(date, date)
to authenticated;

-- Operaciones de despliegue: exclusivamente rol de servicio.
grant execute on function public.bootstrap_first_admin(text), public.purge_demo_data() to service_role;
grant execute on function public.refresh_deadline_notifications(boolean) to service_role;

-- -----------------------------------------------------------------------------
-- Almacenamiento privado de adjuntos
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos', 'documentos', false, 52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lectura: administradores, o personal con acceso al documento cuando el
-- adjunto está vigente (no retirado).
create policy siged_documentos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and (
      (select private.is_admin())
      or exists (
        select 1 from public.document_attachments a
        where a.storage_path = objects.name
          and a.removed_at is null
          and private.can_view_document(a.document_id)
      )
    )
  );

-- Carga: solo administradores, dentro de la carpeta de un documento existente
-- y no archivado.
create policy siged_documentos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (select private.is_admin())
    and exists (
      select 1 from public.documents d
      where d.id::text = (storage.foldername(objects.name))[1]
        and d.status <> 'ARCHIVADO'
    )
  );

-- Borrado: solo de cargas huérfanas (sin registro de adjunto). Los archivos
-- registrados se conservan para la trazabilidad.
create policy siged_documentos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'documentos'
    and (select private.is_admin())
    and not exists (select 1 from public.document_attachments a where a.storage_path = objects.name)
  );

-- -----------------------------------------------------------------------------
-- Realtime (los cambios se entregan aplicando la RLS de cada suscriptor)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.documents, public.document_route_events, public.document_attachments,
      public.procedures, public.procedure_events, public.notifications;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Tarea programada de alertas de plazos (si pg_cron está disponible)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('siged-alertas-plazos', '7 * * * *',
      'select public.refresh_deadline_notifications(true)');
  end if;
exception when others then
  raise notice 'pg_cron no disponible (%); las alertas se generarán al abrir el panel.', sqlerrm;
end
$$;

-- >>>>>>>>>>>>>>>>>>>> 20261023000100_projects.sql <<<<<<<<<<<<<<<<<<<<
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

-- >>>>>>>>>>>>>>>>>>>> Registro de migraciones aplicadas <<<<<<<<<<<<<<<<<<<<
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261021000100', 'base'),
  ('20261021000200', 'documents_workflow'),
  ('20261021000300', 'procedures'),
  ('20261021000400', 'audit_notifications_admin'),
  ('20261021000500', 'security_views'),
  ('20261023000100', 'projects')
on conflict (version) do nothing;

commit;

-- Comprobación: debe mostrar las tres dependencias de la ruta obligatoria.
select code, name, contact_name from public.departments order by sort_order;
