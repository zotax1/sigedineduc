/**
 * Genera supabase/deploy/esquema-completo.sql a partir de las migraciones,
 * para instalar la base de datos pegando un solo archivo en el SQL Editor de
 * Supabase (sin necesidad de la CLI). Uso: npm run db:bundle
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

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
