import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, closeDb, createUser, db, type Client, type TestUser } from "./helpers";

let admin: TestUser;
let viewer: TestUser;

// JPEG mínimo (solo la firma; el bucket valida tipo y tamaño).
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

beforeAll(async () => {
  admin = await createUser("admin-inv", "ADMINISTRADOR");
  viewer = await createUser("consulta-inv");
});

afterAll(async () => {
  await closeDb();
});

async function createResearcher(client: Client, overrides: Record<string, unknown> = {}) {
  const { data, error } = await client
    .from("researchers")
    .insert({
      code: `inv-t-${randomUUID().slice(0, 6)}`,
      full_name: "  Dra.   Investigadora   Ficticia ",
      academic_titles: ["Doctorado en Educación", " ", "Doctorado en Educación", "Maestría en Investigación"],
      affiliation: "AMBOS",
      ...overrides,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

describe("Investigadores", () => {
  it("un administrador registra; el servidor normaliza código, nombre y títulos", async () => {
    const r = await createResearcher(admin.client);
    expect(r.code).toMatch(/^INV-T-/);
    expect(r.full_name).toBe("Dra. Investigadora Ficticia");
    expect(r.academic_titles).toEqual(["Doctorado en Educación", "Maestría en Investigación"]);
    expect(r.created_by).toBe(admin.id);
  });

  it("el código es único y la afiliación solo admite Facultad, INEDUC o ambos", async () => {
    const r = await createResearcher(admin.client);
    await expect(createResearcher(admin.client, { code: r.code.toLowerCase() })).rejects.toMatchObject({ code: "23505" });
    await expect(createResearcher(admin.client, { affiliation: "OTRA" })).rejects.toMatchObject({ code: "22P02" });
  });

  it("el personal de consulta ve el directorio pero no registra ni edita", async () => {
    const r = await createResearcher(admin.client);
    const { data } = await viewer.client.from("researchers").select("id").eq("id", r.id);
    expect(data).toHaveLength(1);
    await expect(createResearcher(viewer.client)).rejects.toBeTruthy();
    const upd = await viewer.client.from("researchers").update({ full_name: "Cambio no autorizado" }).eq("id", r.id).select();
    expect(upd.data ?? []).toHaveLength(0);
    const { data: anon } = await anonClient().from("researchers").select("id").limit(1);
    expect(anon ?? []).toHaveLength(0);
  });

  it("los registros no se eliminan y los cambios quedan en la auditoría", async () => {
    const r = await createResearcher(admin.client);
    await expect(db().query("delete from public.researchers where id = $1", [r.id])).rejects.toThrow(/no se eliminan/);
    await admin.client.from("researchers").update({ affiliation: "INEDUC" }).eq("id", r.id);
    const { rows } = await db().query("select action from public.audit_logs where table_name = 'researchers' and record_id = $1 order by id", [r.id]);
    expect(rows.map((x) => x.action)).toEqual(["CREACION", "ACTUALIZACION"]);
  });

  it("fotos privadas: solo administradores cargan en la carpeta del investigador; la foto en uso no se borra", async () => {
    const r = await createResearcher(admin.client);
    const path = `${r.id}/${randomUUID()}.jpg`;
    expect((await viewer.client.storage.from("investigadores").upload(`${r.id}/x.jpg`, JPEG, { contentType: "image/jpeg" })).error).toBeTruthy();
    expect((await admin.client.storage.from("investigadores").upload(`${randomUUID()}/x.jpg`, JPEG, { contentType: "image/jpeg" })).error).toBeTruthy();
    expect((await admin.client.storage.from("investigadores").upload(`${r.id}/x.html`, new TextEncoder().encode("<b>"), { contentType: "text/html" })).error).toBeTruthy();
    expect((await admin.client.storage.from("investigadores").upload(path, JPEG, { contentType: "image/jpeg" })).error).toBeNull();

    const bad = await admin.client.from("researchers").update({ photo_path: `${randomUUID()}/otra.jpg` }).eq("id", r.id);
    expect(bad.error).toBeTruthy();
    expect((await admin.client.from("researchers").update({ photo_path: path }).eq("id", r.id)).error).toBeNull();

    expect((await viewer.client.storage.from("investigadores").createSignedUrl(path, 60)).error).toBeNull();
    expect((await anonClient().storage.from("investigadores").download(path)).error).toBeTruthy();

    await admin.client.storage.from("investigadores").remove([path]);
    expect((await admin.client.storage.from("investigadores").download(path)).error).toBeNull();
  });
});
