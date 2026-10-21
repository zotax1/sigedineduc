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
