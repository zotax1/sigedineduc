# Despliegue: Supabase + Vercel

> Estas instrucciones no se han ejecutado contra servicios reales desde el entorno de desarrollo (no se disponía de credenciales). Se verificó todo contra el stack local oficial de Supabase y la compilación de producción.

## 1. Proyecto de Supabase

1. Cree un proyecto en <https://supabase.com/dashboard> (región recomendada: `us-east-1`, la más cercana a República Dominicana).
2. Anote en *Project Settings → API keys*: la URL del proyecto, la clave **publicable** (`sb_publishable_…`) y la clave **secreta** (`sb_secret_…`). En proyectos antiguos se llaman *anon* y *service_role*.
3. Aplique las migraciones desde el repositorio:

   ```bash
   npx supabase login
   npx supabase link --project-ref <referencia-del-proyecto>
   npx supabase db push
   ```

   Esto crea el esquema, la RLS, el bucket privado `documentos` con sus políticas, la publicación de Realtime y, si `pg_cron` está disponible, la tarea horaria de alertas. **No haga cambios manuales en producción**: cualquier cambio de esquema debe ser una nueva migración.

4. **pg_cron**: compruebe en *Integrations → Cron* que exista el trabajo `siged-alertas-plazos`. Si la extensión no estaba habilitada, habilítela y ejecute en el *SQL Editor*:

   ```sql
   select cron.schedule('siged-alertas-plazos', '7 * * * *', 'select public.refresh_deadline_notifications(true)');
   ```

   (Como respaldo, Vercel Cron llama a `/api/cron/alertas` una vez al día; además, el panel genera las alertas al abrirse.)

5. **Storage**: en *Storage* verifique que el bucket `documentos` es **privado**.

## 2. Autenticación

En *Authentication*:

| Ajuste | Valor |
|---|---|
| *Sign In / Providers → Allow new users to sign up* | **Desactivado** (solo invitación) |
| *Email provider* | Activado |
| *URL Configuration → Site URL* | `https://<su-dominio>` |
| *URL Configuration → Redirect URLs* | `https://<su-dominio>/auth/confirm` |
| *Policies / Passwords* | Longitud mínima 10; minúsculas, mayúsculas y números |
| *Email Templates → Invite user* | Asunto «Invitación a SIGED-INEDUC»; contenido de `supabase/templates/invitacion.html` |
| *Email Templates → Reset password* | Asunto «Restablecer contraseña · SIGED-INEDUC»; contenido de `supabase/templates/recuperacion.html` |
| *SMTP Settings* | Recomendado: un SMTP institucional. El correo integrado de Supabase tiene límites estrictos y puede no entregar a direcciones externas al equipo. |

Las plantillas usan enlaces `token_hash` hacia `/auth/confirm`, necesarios para el inicio de sesión basado en cookies (SSR).

Si no se configura SMTP, use el alta con **contraseña temporal** (Administración → Usuarios) y la recuperación de contraseña quedará limitada.

## 3. Vercel

1. Importe el repositorio en <https://vercel.com/new> (framework: Next.js; comandos por defecto).
2. Variables de entorno (*Settings → Environment Variables*, entorno *Production*):

   | Variable | Valor | Visibilidad |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto | pública |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | clave publicable | pública |
   | `NEXT_PUBLIC_SITE_URL` | `https://<su-dominio>` | pública |
   | `SUPABASE_SECRET_KEY` | clave secreta | **solo servidor; marcar como Sensitive** |
   | `CRON_SECRET` | cadena aleatoria de 32+ caracteres | solo servidor |

3. Despliegue. La aplicación valida las variables al arrancar (`src/instrumentation.ts`) y falla con un mensaje claro si falta alguna obligatoria.
4. `vercel.json` programa `/api/cron/alertas` diariamente a las 11:00 UTC (7:00 a. m. en Santo Domingo). Vercel envía `Authorization: Bearer <CRON_SECRET>` automáticamente.
5. Si usa un dominio propio, actualice *Site URL*, *Redirect URLs* y `NEXT_PUBLIC_SITE_URL`.

## 4. Primer administrador

Ver la sección «Primer administrador» del [README](../README.md#primer-administrador). Resumen:

```bash
# Con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY del proyecto de producción en .env.local
npm run admin:bootstrap -- correo@uasd.edu.do "Nombre Apellido"
```

o, en el *SQL Editor*, después de crear el usuario en *Authentication → Users*:

```sql
select public.bootstrap_first_admin('correo@uasd.edu.do');
```

## 5. Verificación posterior al despliegue

1. Abrir la URL sin sesión → debe redirigir a `/login`.
2. Iniciar sesión con el administrador inicial y cambiar la contraseña temporal.
3. Registrar un documento saliente de prueba, remitirlo a la Dirección y comprobar que no se ofrece remitir al Decanato hasta registrar la recepción.
4. Invitar a una cuenta de consulta y comprobar que solo puede visualizar.
5. Adjuntar un PDF y descargarlo; comprobar que la URL pública del bucket no lo sirve.
6. Eliminar el documento de prueba no es posible (por diseño): archívelo o, si fue creado como demostración, use `select public.purge_demo_data();` solo para registros con `is_demo = true`.

## 6. Actualizaciones futuras

- Nuevas migraciones en `supabase/migrations/` → `npx supabase db push`.
- Tras cambiar el esquema, regenere los tipos: `npm run db:types` (local) o `npx supabase gen types typescript --linked`.
