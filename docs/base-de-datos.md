# Base de datos

Todas las estructuras se crean con migraciones en `supabase/migrations/` (aplicar con `npx supabase db push`).

| Migración | Contenido |
|---|---|
| `…0100_base.sql` | Extensiones, esquema `private`, tipos enumerados, dependencias (con las tres del sistema y Dr. Máximo Díaz), catálogos, parámetros, perfiles y funciones de autorización |
| `…0200_documents_workflow.sql` | Documentos, accesos restringidos, adjuntos, historial de movimientos, ruta obligatoria y funciones de flujo |
| `…0300_procedures.sql` | Trámites e historial de trámites |
| `…0400_audit_notifications_admin.sql` | Auditoría, notificaciones, alertas de plazos, administración de usuarios, administrador inicial, purga de demostración |
| `…0500_security_views.sql` | Vistas de consulta, panel, RLS, permisos, bucket privado y políticas de Storage, Realtime, pg_cron |

## Tablas

| Tabla | Propósito |
|---|---|
| `profiles` | Identidad, rol y estado de la cuenta (rol protegido) |
| `departments` | Dependencias; `is_system` marca las tres de la ruta obligatoria (protegidas) |
| `document_types`, `priorities`, `procedure_categories` | Catálogos configurables |
| `app_settings` | Umbrales de alertas y límites de adjuntos (fila única) |
| `documents` | Documentos entrantes y salientes. Clave primaria UUID; el número oficial nunca es clave |
| `document_access` | Accesos explícitos a documentos restringidos |
| `document_attachments` | Metadatos de adjuntos (archivo en Storage) |
| `document_route_events` | Historial de movimientos, solo anexado |
| `procedures`, `procedure_events` | Trámites y su historial (solo anexado) |
| `projects` | Proyectos de investigación (código único, IP, coinvestigadores, unidad, año, financiamiento, estado) |
| `project_documents` | Documentos especiales de cada proyecto, con su propio estado, prioridad y fecha límite |
| `project_files` | Metadatos de los archivos de proyectos (Storage: `proyectos/<proyecto>/<documento>/`) |
| `project_events` | Línea de tiempo del proyecto, solo anexado; `is_internal` marca notas visibles solo para administradores |
| `notifications` | Notificaciones por destinatario, sin duplicados (`dedupe_key`) |
| `audit_logs` | Bitácora de auditoría, solo anexado |
| `document_counters`, `procedure_counters` | Numeración interna (`SIGED-S-2026-00001`, `TRM-2026-00001`) |

## Unicidad del número oficial

- **Salientes**: único (sin distinguir mayúsculas ni espacios).
- **Entrantes**: único por institución remitente, porque instituciones distintas pueden usar la misma numeración.
- El número oficial es opcional y nunca se genera automáticamente; la referencia interna sí se genera y es independiente.

## Vistas (`security_invoker`, aplican la RLS de quien consulta)

`document_overview`, `procedure_overview`, `route_event_overview`, `procedure_event_overview`, `project_overview`, `project_document_overview`, `project_file_overview`, `project_event_overview`: añaden nombres legibles e indicadores calculados (`is_overdue`, `is_due_soon`, `awaiting_handoff`, `is_stale`, `days_to_due`) con la fecha de Santo Domingo.

## Funciones públicas (RPC)

| Función | Uso | Rol |
|---|---|---|
| `record_outgoing_transition` | Avanzar un saliente por la ruta | Administrador |
| `record_incoming_movement` | Cambiar estado/dependencia de un entrante | Administrador |
| `reverse_last_movement` | Corrección auditada del último movimiento | Administrador |
| `add_document_observation` | Observación en el historial | Administrador |
| `remove_attachment` | Retirar un adjunto con motivo | Administrador |
| `change_procedure_status`, `add_procedure_observation` | Trámites | Administrador |
| `change_project_status`, `change_project_document_status`, `add_project_note`, `remove_project_file` | Proyectos (el estado solo cambia por estas funciones; rechazar, cancelar y devolver exigen motivo) | Administrador |
| `admin_set_user_role`, `admin_set_user_status`, `admin_update_user_profile` | Usuarios | Administrador |
| `update_my_profile`, `mark_all_notifications_read`, `dashboard_summary`, `refresh_deadline_notifications`, `log_report_export`, `get_outgoing_route_definition` | Uso general | Personal activo |
| `bootstrap_first_admin`, `purge_demo_data` | Despliegue | Solo rol de servicio |

## Zona horaria

Las marcas de tiempo se guardan como `timestamptz` (UTC). La fecha «de hoy» para plazos se calcula con `America/Santo_Domingo` (`private.today_do()`), y la interfaz muestra todas las fechas en esa zona horaria.
