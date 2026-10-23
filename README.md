# SIGED-INEDUC

**Sistema de Gestión y Seguimiento Documental** del Instituto de Investigación e Innovación Educativa (INEDUC), Facultad de Ciencias de la Educación, Universidad Autónoma de Santo Domingo (UASD).

Centraliza documentos entrantes y salientes, adjuntos, movimientos entre dependencias, trámites pendientes, responsables, plazos e historial, para que el personal pueda consultar en todo momento **dónde está cada documento, quién lo tiene y qué falta por hacer**.

> **Regla institucional obligatoria.** Todo documento saliente de INEDUC pasa por la **Dirección de Investigación de la Facultad de Ciencias de la Educación** (Director: Dr. Máximo Díaz) antes de remitirse al **Decanato de la Facultad de Ciencias de la Educación**. La regla se aplica en la base de datos y no puede omitirse desde la aplicación. Ver [docs/flujo-institucional.md](docs/flujo-institucional.md).

---

## Contenido

- [Funcionalidades](#funcionalidades)
- [Arquitectura y tecnologías](#arquitectura-y-tecnologías)
- [Requisitos](#requisitos)
- [Puesta en marcha local](#puesta-en-marcha-local)
- [Comandos](#comandos)
- [Pruebas](#pruebas)
- [Despliegue (Supabase + Vercel)](#despliegue)
- [Primer administrador](#primer-administrador)
- [Uso administrativo](#uso-administrativo)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Limitaciones conocidas](#limitaciones-conocidas)

Documentación adicional:

| Documento | Contenido |
|---|---|
| [docs/flujo-institucional.md](docs/flujo-institucional.md) | Máquina de estados de salientes, reglas, correcciones, flujo de entrantes |
| [docs/despliegue.md](docs/despliegue.md) | Configuración paso a paso de Supabase y Vercel |
| [docs/seguridad.md](docs/seguridad.md) | Roles, RLS, almacenamiento, auditoría, tiempo real |
| [docs/base-de-datos.md](docs/base-de-datos.md) | Tablas, vistas, funciones y migraciones |

## Funcionalidades

- **Panel principal** con indicadores calculados desde la base de datos (entrantes, salientes, trámites pendientes y vencidos, documentos en seguimiento, completados, pendientes de atención, actualizados recientemente), filtro por período, tarjetas de **documentos pendientes por dependencia**, gráficos, alertas y actividad reciente.
- **Documentos entrantes**: registro con o sin número oficial, remitente, recepción, responsable, plazos, confidencialidad; movimientos flexibles entre dependencias.
- **Documentos salientes**: número de oficio manual (nunca generado), referencia interna independiente, **ruta obligatoria** con diagrama de etapas, vista previa de cada movimiento, fechas de cada traspaso.
- **Historial de solo anexado** con actor, origen, destino, fecha y hora del servidor y observaciones. Correcciones mediante **reversión auditada** que conserva el movimiento original.
- **Adjuntos privados** (PDF, DOC, DOCX, XLS, XLSX, PNG, JPG): verificación del contenido real, carga directa con progreso, descarga con URL firmada de 60 s, retiro y reemplazo auditados.
- **Trámites y procedimientos** asociados o no a documentos, con estados, responsables, dependencias, plazos e historial. "Vencido" es un indicador calculado.
- **Proyectos de investigación**: expedientes con código, título, investigador principal, coinvestigadores, facultad o unidad, año y fuente de financiamiento; indicadores (total, en trámite, aprobados, documentos pendientes) y filtros por estado, investigador, año, financiamiento y alertas. Cada **documento especial** (oficio, propuesta, informe de avance o final, presupuesto, aval ético, carta institucional) tiene su propio trámite (Ingresado → En revisión → Pendiente de firma / Enviado a vía / Devuelto → Aprobado → Completado), archivos privados, alertas de firma, prioridad y plazo, y una **línea de tiempo** de solo anexado con observaciones públicas o **notas internas** (solo administradores).
- **Seguimiento por dependencia**: documentos remitidos esperando recepción y documentos presentes en cada dependencia.
- **Notificaciones internas** en tiempo real (asignaciones, remisiones, recepciones, plazos, documentos sin movimiento), sin duplicados.
- **Búsqueda global** y filtros combinables (dirección, fechas, estado, dependencia, prioridad, responsable, tipo, pendientes/completados/archivados, vencidos), ordenación y paginación en servidor.
- **Reportes** con vista previa y exportación a **Excel, CSV y PDF** respetando filtros y permisos.
- **Administración**: usuarios (invitación por correo o contraseña temporal), roles, suspensión, dependencias, catálogos, parámetros y bitácora de auditoría.
- **Tiempo real** autorizado (Supabase Realtime + RLS) con indicador de conexión y respaldo por consulta periódica.
- Interfaz en español, configuración regional `es-DO`, zona horaria `America/Santo_Domingo`, fechas `DD/MM/AAAA`, diseño adaptable y accesible.

## Arquitectura y tecnologías

| Capa | Tecnología |
|---|---|
| Aplicación | Next.js 16 (App Router, Server Components, Server Actions, `proxy.ts`), React 19, TypeScript estricto |
| Interfaz | Tailwind CSS 4, componentes accesibles sobre Radix UI (estilo shadcn/ui), Lucide, Recharts, Sonner |
| Formularios | React Hook Form + Zod (la misma validación se repite en el servidor) |
| Datos | Supabase PostgreSQL con RLS, funciones transaccionales y triggers |
| Autenticación | Supabase Auth (solo por invitación; `@supabase/ssr` con cookies) |
| Archivos | Supabase Storage, bucket privado `documentos` |
| Tiempo real | Supabase Realtime (`postgres_changes` con RLS) |
| Exportación | ExcelJS, jsPDF + AutoTable, CSV UTF-8 |
| Pruebas | Vitest (unitarias e integración contra Supabase local), Playwright (E2E) |
| Despliegue | Vercel (aplicación) + Supabase (base de datos, Auth, Storage, Realtime) |

Las reglas críticas viven en la base de datos (`supabase/migrations`): la aplicación nunca es la única barrera. El servidor de Next.js usa **la sesión del usuario** para leer y escribir (así se aplican la RLS y la auditoría con el actor real); la clave secreta solo se usa para operaciones de Auth (invitar, crear o suspender cuentas).

## Requisitos

- Node.js 20.9 o superior (probado con Node 22).
- Docker (para el stack local de Supabase).
- CLI de Supabase (incluida como dependencia de desarrollo: `npx supabase`).
- Para producción: un proyecto de Supabase y una cuenta de Vercel.

## Puesta en marcha local

```bash
npm install
npm run db:start                 # levanta Supabase local (Postgres, Auth, Storage, Realtime, Mailpit)
npx supabase status -o env       # muestra URL y claves locales
cp .env.example .env.local       # complete con los valores locales (ver abajo)
npm run db:reset                 # aplica todas las migraciones
npm run seed:demo                # OPCIONAL: datos FICTICIOS de demostración
npm run dev                      # http://localhost:3000
```

`.env.local` para desarrollo local:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY de supabase status>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SECRET_KEY=<SECRET_KEY de supabase status>
CRON_SECRET=<cualquier valor de 16+ caracteres>
```

Los correos (invitaciones, recuperación) se pueden ver en Mailpit: <http://127.0.0.1:54324>.

La semilla de demostración crea cuentas `admin.demo@siged.test`, `ana.demo@siged.test` y `luis.demo@siged.test` (contraseña local `Demo-Siged-2026`) y documentos **ficticios** marcados con `is_demo`. Se eliminan con `npm run seed:demo:purge`. Por seguridad, la semilla se niega a ejecutarse contra un proyecto que no sea local salvo que se defina `SIGED_ALLOW_DEMO_SEED=1`. **No la use en producción.**

> Si Docker no puede descargar imágenes de `public.ecr.aws`, defina `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io` antes de `npm run db:start`.

## Comandos

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Compilación y servidor de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | Verificación de tipos (TypeScript estricto) |
| `npm test` | Pruebas unitarias |
| `npm run test:integration` | Pruebas de integración contra Supabase **local** |
| `npm run test:e2e` | Pruebas E2E con Playwright (requiere `npm run build`) |
| `npm run db:start` / `npm run db:reset` | Supabase local / reaplicar migraciones |
| `npm run db:types` | Regenerar `src/lib/supabase/database.types.ts` |
| `npm run admin:bootstrap -- correo "Nombre"` | Designar el primer administrador |
| `npm run seed:demo` / `npm run seed:demo:purge` | Datos ficticios (solo local) |

## Pruebas

```bash
npm run lint && npm run typecheck
npm test                       # 34 pruebas unitarias
npm run test:integration       # 52 pruebas contra Supabase local (Auth, PostgREST, Storage, Realtime)
npm run build && npm run test:e2e   # 12 pruebas de navegador
```

Las pruebas de integración y E2E crean usuarios y datos en la base **local**; se niegan a ejecutarse contra otra URL. Si Playwright no encuentra su navegador, indique uno existente con `PW_CHROMIUM_PATH=/ruta/a/chromium`.

Cobertura principal: rechazo del envío directo INEDUC → Decanato, recepción en el Decanato sin remisión previa, edición directa de la etapa (incluso con clave de servicio o superusuario), concurrencia, ausencia de actualizaciones parciales, historial de solo anexado, correcciones, permisos por rol, RLS de documentos restringidos, autoelevación de rol, adjuntos privados y URL firmadas, Realtime autorizado, indicadores del panel, alertas de plazos, exportaciones con filtros y permisos, invitación por correo y contraseña temporal.

## Despliegue

Resumen (detalle en [docs/despliegue.md](docs/despliegue.md)):

1. Cree el proyecto en Supabase y aplique las migraciones: `npx supabase link --project-ref <ref>` y `npx supabase db push`.
2. En **Authentication**: desactive el registro público, configure *Site URL* y la URL de redirección `https://<dominio>/auth/confirm`, la política de contraseñas, las plantillas de correo de `supabase/templates/` y, preferiblemente, un SMTP propio.
3. Importe el repositorio en Vercel y defina las variables de entorno de `.env.example`.
4. Designe el primer administrador.

## Primer administrador

Las cuentas nuevas **siempre** inician como *Personal de consulta*; ningún usuario puede elevar su propio rol. El primer administrador se designa una sola vez, con acceso de despliegue:

**Opción A (script, desde un equipo de confianza):**

```bash
# .env.local con la URL del proyecto de producción y SUPABASE_SECRET_KEY
npm run admin:bootstrap -- direccion.ineduc@uasd.edu.do "Nombre Apellido"
# Sin --invitar: crea la cuenta con una contraseña temporal que se muestra una vez
# y debe cambiarse al primer inicio de sesión. Con --invitar: envía invitación por correo.
```

**Opción B (panel de Supabase):** cree el usuario en *Authentication → Users → Add user* y ejecute en el *SQL Editor*:

```sql
select public.bootstrap_first_admin('direccion.ineduc@uasd.edu.do');
```

`bootstrap_first_admin` solo funciona mientras **no exista ningún administrador activo**, no está disponible para usuarios autenticados y queda registrado en la auditoría. A partir de ahí, los roles se gestionan en *Administración → Usuarios*.

## Uso administrativo

- **Registrar un saliente**: *Documentos salientes → Registrar saliente*. Queda en INEDUC; en el detalle, el panel *Situación actual* muestra únicamente los pasos válidos de la ruta, con vista previa antes de confirmar.
- **Registrar la recepción**: cuando la dependencia acuse recibo, use el botón de recepción correspondiente. Remitir no implica recibir.
- **Corregir un error**: *Corregir último* registra una reversión con motivo obligatorio; el movimiento original se conserva marcado como revertido.
- **Documentos restringidos**: visibles solo para administradores, el responsable asignado y el personal autorizado en el panel *Acceso restringido*.
- **Plazos y alertas**: configure los umbrales en *Administración → Parámetros*.
- **Personal**: *Administración → Usuarios → Agregar personal* (invitación por correo o contraseña temporal). La suspensión bloquea de inmediato el acceso a los datos (RLS) y el inicio de sesión.

## Estructura del proyecto

```
supabase/
  migrations/          Esquema, flujo obligatorio, RLS, almacenamiento, Realtime, auditoría
  templates/           Plantillas de correo en español (invitación, recuperación)
  config.toml          Configuración del stack local
src/
  proxy.ts             Renovación de sesión y redirección de visitantes no autenticados
  app/(auth)/          Inicio de sesión, recuperación y cambio de contraseña
  app/(app)/           Panel, entrantes, salientes, documentos, trámites, dependencias,
                       notificaciones, reportes, búsqueda, perfil y administración
  app/api/             Descarga de adjuntos, exportación de reportes, tarea programada
  components/          Interfaz (ui, layout, documents, procedures, dashboard, admin)
  lib/                 Acceso a datos, acciones del servidor, validación, flujo, formatos
scripts/               Administrador inicial y datos de demostración
tests/integration/     Pruebas contra Supabase local
tests/e2e/             Pruebas de navegador (Playwright)
```

## Limitaciones conocidas

- Las **notificaciones** internas aún no cubren los proyectos: sus alertas (firma pendiente, prioridad, plazo vencido) se muestran en el módulo de Proyectos.
- Los **logotipos institucionales** (INEDUC y Facultad de Ciencias de la Educación) están en `public/brand/` y se muestran en la cabecera de las pantallas de acceso (`src/app/(auth)/layout.tsx`). La barra lateral interna conserva la identidad textual «SG» (`src/components/layout/brand.tsx`).
- La **paleta institucional** (vino `#5E171B`, crema `#FAF6E9`, texto `#2B1012`, superficies `#FFFFFF`) se define una sola vez como variables en `src/app/globals.css`; los reportes XLSX/PDF usan los mismos valores en `src/lib/reports/exporters.ts`.
- Los **selectores de fecha** son los nativos del navegador: su formato visual depende del idioma del navegador (en navegadores en español se muestran como DD/MM/AAAA). Las fechas mostradas por la aplicación siempre usan DD/MM/AAAA.
- Las **notificaciones por correo** de eventos internos no están implementadas (solo notificaciones en la aplicación). Supabase envía únicamente los correos de invitación y recuperación.
- Las **excepciones institucionales a la ruta** no están implementadas a propósito: la ruta se aplica sin excepciones. Solo existe la corrección (reversión) auditada del último movimiento.
- Un aviso de cambio en Realtime sin datos (con error 401) llega a suscripciones no autenticadas: no expone contenido, pero sí que ocurrió un cambio. La aplicación solo se suscribe con sesión iniciada.
