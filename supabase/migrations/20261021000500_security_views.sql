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
