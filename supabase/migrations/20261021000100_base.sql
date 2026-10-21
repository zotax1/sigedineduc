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
