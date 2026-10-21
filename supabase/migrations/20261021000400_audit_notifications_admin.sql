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
