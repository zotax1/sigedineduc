/**
 * Genera, a partir de las migraciones:
 *  - supabase/deploy/esquema-completo.sql: instalación completa en un proyecto
 *    nuevo pegando un solo archivo en el SQL Editor de Supabase.
 *  - supabase/deploy/actualizaciones/<migración>.sql: cada migración por
 *    separado, para actualizar una base ya instalada (en orden, una vez).
 * Uso: npm run db:bundle
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const versions = files.map((f) => {
  const [version, ...rest] = f.replace(/\.sql$/, "").split("_");
  return { version, name: rest.join("_") };
});

const header = `-- =============================================================================
-- SIGED-INEDUC · ESQUEMA COMPLETO PARA INSTALACIÓN DESDE EL SQL EDITOR
-- =============================================================================
-- Archivo GENERADO a partir de supabase/migrations/ (no editar a mano;
-- regenerar con: npm run db:bundle).
-- Uso: Supabase → SQL Editor → New query → pegar todo → Run.
-- Se ejecuta en UNA transacción: si algo falla, no queda nada a medias.
-- Ejecútelo una sola vez, en un proyecto nuevo.
-- Al final registra las migraciones como aplicadas para que
-- \`supabase db push\` no intente repetirlas en el futuro.
-- =============================================================================

begin;
`;

const body = files.map((f) => `\n-- >>>>>>>>>>>>>>>>>>>> ${f} <<<<<<<<<<<<<<<<<<<<\n${readFileSync(`${dir}/${f}`, "utf8")}`).join("");

const footer = `
-- >>>>>>>>>>>>>>>>>>>> Registro de migraciones aplicadas <<<<<<<<<<<<<<<<<<<<
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values
${versions.map((v) => `  ('${v.version}', '${v.name}')`).join(",\n")}
on conflict (version) do nothing;

commit;

-- Comprobación: debe mostrar las tres dependencias de la ruta obligatoria.
select code, name, contact_name from public.departments order by sort_order;
`;

writeFileSync("supabase/deploy/esquema-completo.sql", header + body + footer);
console.log(`Generado supabase/deploy/esquema-completo.sql (${files.length} migraciones).`);

// Las bases instaladas con la primera versión del esquema completo ya tienen
// hasta esta migración; solo las posteriores necesitan archivo de actualización.
const INITIAL_INSTALL = "20261021000500";

mkdirSync("supabase/deploy/actualizaciones", { recursive: true });
for (const [i, f] of files.entries()) {
  const { version, name } = versions[i];
  if (version <= INITIAL_INSTALL) continue;
  const update = `-- =============================================================================
-- SIGED-INEDUC · ACTUALIZACIÓN ${version} (${name})
-- =============================================================================
-- Archivo GENERADO (npm run db:bundle); no editar a mano.
-- Uso: Supabase → SQL Editor → New query → pegar todo → Run.
-- Aplíquelo una sola vez en una base ya instalada que aún no tenga esta
-- versión. Se ejecuta en una transacción: si algo falla, no cambia nada.
-- Si la versión ya está aplicada, se detiene sin modificar la base.
-- =============================================================================

begin;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'supabase_migrations' and table_name = 'schema_migrations')
     and exists (select 1 from supabase_migrations.schema_migrations where version = '${version}') then
    raise exception 'La actualización ${version} ya está aplicada en esta base de datos; no es necesario ejecutarla otra vez.';
  end if;
end
$$;

${readFileSync(`${dir}/${f}`, "utf8")}
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${name}')
on conflict (version) do nothing;

commit;

select 'Actualización ${version} aplicada correctamente' as resultado;
`;
  writeFileSync(`supabase/deploy/actualizaciones/${f}`, update);
}
console.log("Generadas las actualizaciones en supabase/deploy/actualizaciones/.");
