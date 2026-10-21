# Seguridad y autorización

## Roles

| Rol | Puede | No puede |
|---|---|---|
| **Administrador** | Registrar y editar documentos y trámites, registrar movimientos válidos, adjuntar y retirar archivos, gestionar usuarios, catálogos y parámetros, ver la auditoría | Omitir la ruta obligatoria, reescribir o borrar el historial, cambiar su propio rol o suspenderse, dejar el sistema sin administradores |
| **Personal de consulta** | Ver panel, listados, detalles, historial, trámites, notificaciones propias y reportes; descargar adjuntos autorizados; exportar lo que puede ver | Crear, editar, mover, archivar, administrar usuarios o configuración |

- Las cuentas se crean solo por invitación o alta administrativa; el registro público está desactivado.
- Toda cuenta nueva nace como **Personal de consulta**, aunque los metadatos enviados digan otra cosa.
- El rol y el estado solo cambian mediante funciones administrativas (`admin_set_user_role`, `admin_set_user_status`) o `bootstrap_first_admin` (solo rol de servicio, solo si no hay administradores). Un trigger rechaza cualquier otro intento, incluso con la clave de servicio vía API.
- La suspensión bloquea el acceso a datos al instante (todas las políticas exigen cuenta activa) y bloquea el inicio de sesión en Auth.

## Capas de control

1. **Proxy** (`src/proxy.ts`): renueva la sesión y redirige a `/login` a quien no la tiene.
2. **Servidor**: cada página y acción del servidor verifica sesión y rol (`requireUser` / `requireAdmin`) y valida los datos con Zod.
3. **Base de datos**: RLS en todas las tablas expuestas, permisos mínimos (`anon` no tiene ningún acceso), triggers que fijan actor y fechas, funciones `SECURITY DEFINER` con `search_path` vacío que validan el rol.

Ocultar un botón nunca es la única barrera.

## Visibilidad de documentos

- `GENERAL`: todo el personal activo.
- `RESTRINGIDO`: administradores, el responsable asignado y quienes figuren en `document_access`.

La regla se aplica a documentos, historial, adjuntos (metadatos y archivos), trámites asociados, búsqueda, indicadores del panel, exportaciones, notificaciones y eventos en tiempo real.

## Archivos

- Bucket `documentos` **privado**; límite de tamaño y tipos MIME en el propio bucket.
- Carga: el servidor valida nombre, extensión y tamaño (parámetros configurables), emite una URL de carga firmada de un solo uso; tras la carga **verifica el contenido real** (firma binaria) y, si no corresponde, elimina el archivo.
- Descarga: `/api/adjuntos/<id>` comprueba la autorización con la sesión del usuario y redirige a una URL firmada de **60 segundos**. Las políticas de Storage repiten la comprobación.
- Retirar un adjunto lo oculta al personal de consulta pero **conserva** el archivo y el registro (auditoría). Los objetos registrados no pueden borrarse desde la aplicación.

## Auditoría

`audit_logs` registra (por triggers, independientes de la vía de acceso) creación y cambios de documentos, trámites, perfiles y roles, dependencias, catálogos, parámetros, accesos restringidos, adjuntos y movimientos, además de exportaciones de reportes y la designación del administrador inicial. Actor (`auth.uid()`) y fecha (`now()`) los fija la base de datos. La tabla es de solo anexado y solo la leen administradores.

## Secretos

- La clave secreta solo existe en el servidor (`src/lib/supabase/admin.ts` importa `server-only`) y se usa exclusivamente para operaciones de Auth.
- No hay secretos en el repositorio; `.env.example` contiene solo marcadores.
- Los errores se traducen a mensajes en español sin detalles internos (`src/lib/errors.ts`).

## Tiempo real

La aplicación se suscribe con la sesión del usuario a `postgres_changes`; Supabase Realtime evalúa la RLS de cada suscriptor antes de entregar cada cambio. Las pruebas verifican que el personal de consulta recibe documentos generales y no los restringidos, y que una suscripción sin autenticación solo recibe un aviso vacío con error 401 (sin datos).

## Cabeceras HTTP

`X-Frame-Options: DENY`, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` y HSTS (ver `next.config.ts`).

## Exportaciones

Los reportes se generan en el servidor con la sesión del usuario (RLS), aplican exactamente los filtros de la pantalla, nunca incluyen adjuntos, neutralizan fórmulas en CSV y quedan registrados en la auditoría.
