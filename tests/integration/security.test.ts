import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  closeDb,
  createIncoming,
  createOutgoing,
  createUser,
  db,
  departmentId,
  serviceClient,
  type TestUser,
} from "./helpers";

let admin: TestUser;
let viewer: TestUser;
let otherViewer: TestUser;

beforeAll(async () => {
  admin = await createUser("admin-seg", "ADMINISTRADOR");
  viewer = await createUser("consulta-seg");
  otherViewer = await createUser("consulta2-seg");
});

afterAll(async () => {
  await closeDb();
});

describe("Acceso anónimo", () => {
  it("un visitante no autenticado no puede leer datos internos", async () => {
    await createIncoming(admin.client);
    const anon = anonClient();
    for (const table of ["documents", "document_overview", "procedures", "profiles", "departments", "audit_logs", "notifications", "document_route_events"] as const) {
      const { data, error } = await anon.from(table as "documents").select("*").limit(1);
      // Sin privilegios: PostgREST devuelve error de permiso o ninguna fila.
      expect(error !== null || (data ?? []).length === 0, table).toBe(true);
    }
  });

  it("un visitante no autenticado no puede ejecutar operaciones", async () => {
    const anon = anonClient();
    const { error } = await anon.rpc("dashboard_summary", {});
    expect(error).not.toBeNull();
    const boot = await anon.rpc("bootstrap_first_admin", { p_email: "x@y.z" });
    expect(boot.error).not.toBeNull();
  });
});

describe("Roles y perfiles", () => {
  it("una cuenta nueva siempre inicia como personal de consulta aunque los metadatos digan otra cosa", async () => {
    const { data } = await viewer.client.from("profiles").select("role,status").eq("id", viewer.id).single();
    expect(data).toEqual({ role: "CONSULTA", status: "ACTIVO" });
  });

  it("el personal de consulta no puede cambiar su propio rol", async () => {
    const direct = await viewer.client.from("profiles").update({ role: "ADMINISTRADOR" } as never).eq("id", viewer.id).select();
    expect(direct.error !== null || (direct.data ?? []).length === 0).toBe(true);
    const rpc = await viewer.client.rpc("admin_set_user_role", { p_user_id: viewer.id, p_role: "ADMINISTRADOR" });
    expect(rpc.error?.message).toMatch(/SIGED_NO_AUTORIZADO/);
    const { rows } = await db().query("select role from public.profiles where id = $1", [viewer.id]);
    expect(rows[0].role).toBe("CONSULTA");
  });

  it("ni siquiera la clave de servicio puede cambiar roles editando la tabla", async () => {
    const { error } = await serviceClient().from("profiles").update({ role: "ADMINISTRADOR" }).eq("id", viewer.id);
    expect(error?.message).toMatch(/SIGED_NO_AUTORIZADO/);
  });

  it("un administrador no puede cambiar su propio rol ni dejar el sistema sin administradores", async () => {
    const self = await admin.client.rpc("admin_set_user_role", { p_user_id: admin.id, p_role: "CONSULTA" });
    expect(self.error?.message).toMatch(/propia cuenta/);
  });

  it("un administrador puede cambiar el rol de otra cuenta y queda auditado", async () => {
    const target = await createUser("promovible");
    const { data, error } = await admin.client.rpc("admin_set_user_role", { p_user_id: target.id, p_role: "ADMINISTRADOR" });
    expect(error).toBeNull();
    expect(data!.role).toBe("ADMINISTRADOR");
    const { rows } = await db().query(
      "select actor_id, changes from public.audit_logs where table_name = 'profiles' and record_id = $1 and action = 'ACTUALIZACION' order by id desc limit 1",
      [target.id],
    );
    expect(rows[0].actor_id).toBe(admin.id);
    expect(rows[0].changes.role).toEqual({ anterior: "CONSULTA", nuevo: "ADMINISTRADOR" });
  });

  it("el administrador inicial solo puede designarse cuando no existe ninguno", async () => {
    const { error } = await serviceClient().rpc("bootstrap_first_admin", { p_email: viewer.email });
    expect(error?.message).toMatch(/Ya existe un administrador/);
    const asUser = await viewer.client.rpc("bootstrap_first_admin", { p_email: viewer.email });
    expect(asUser.error).not.toBeNull();
  });

  it("una cuenta suspendida pierde el acceso a los datos", async () => {
    const suspended = await createUser("suspendida");
    await createIncoming(admin.client);
    const before = await suspended.client.from("documents").select("id").limit(1);
    expect(before.data?.length).toBe(1);
    const { error } = await admin.client.rpc("admin_set_user_status", { p_user_id: suspended.id, p_status: "SUSPENDIDO" });
    expect(error).toBeNull();
    const after = await suspended.client.from("documents").select("id").limit(1);
    expect(after.data).toEqual([]);
  });
});

describe("Documentos: permisos de lectura y escritura", () => {
  it("el personal de consulta ve los documentos generales", async () => {
    const doc = await createIncoming(admin.client);
    const { data } = await viewer.client.from("document_overview").select("id,subject").eq("id", doc.id);
    expect(data).toHaveLength(1);
  });

  it("el personal de consulta no puede crear ni editar documentos", async () => {
    const insert = await viewer.client.from("documents").insert({
      direction: "SALIENTE",
      subject: "Intento no autorizado",
      status: "REGISTRADO_EN_INEDUC",
      current_department_id: await departmentId("INEDUC"),
      internal_reference: "x",
    });
    expect(insert.error).not.toBeNull();

    const doc = await createOutgoing(admin.client);
    const update = await viewer.client.from("documents").update({ subject: "Alterado" }).eq("id", doc.id).select();
    expect(update.error !== null || (update.data ?? []).length === 0).toBe(true);
    const { rows } = await db().query("select subject from public.documents where id = $1", [doc.id]);
    expect(rows[0].subject).toBe(doc.subject);
  });

  it("los documentos restringidos solo son visibles para administradores y personal autorizado", async () => {
    const doc = await createOutgoing(admin.client, { visibility: "RESTRINGIDO", subject: "Asunto confidencial de prueba" });
    expect((await viewer.client.from("documents").select("id").eq("id", doc.id)).data).toEqual([]);
    expect((await viewer.client.from("document_route_events").select("id").eq("document_id", doc.id)).data).toEqual([]);
    expect((await admin.client.from("documents").select("id").eq("id", doc.id)).data).toHaveLength(1);

    // Búsqueda: tampoco aparece en resultados.
    const search = await viewer.client.from("document_overview").select("id").ilike("search_text", "%confidencial de prueba%");
    expect(search.data?.find((d) => d.id === doc.id)).toBeUndefined();

    const grant = await admin.client.from("document_access").insert({ document_id: doc.id, user_id: viewer.id });
    expect(grant.error).toBeNull();
    expect((await viewer.client.from("documents").select("id").eq("id", doc.id)).data).toHaveLength(1);
    expect((await otherViewer.client.from("documents").select("id").eq("id", doc.id)).data).toEqual([]);
  });

  it("el personal de consulta no puede leer la bitácora de auditoría", async () => {
    const { data } = await viewer.client.from("audit_logs").select("id").limit(5);
    expect(data ?? []).toEqual([]);
    const adminLogs = await admin.client.from("audit_logs").select("id").limit(5);
    expect(adminLogs.data!.length).toBeGreaterThan(0);
  });

  it("la bitácora de auditoría no puede alterarse", async () => {
    const { rows } = await db().query("select id from public.audit_logs order by id limit 1");
    await expect(db().query("delete from public.audit_logs where id = $1", [rows[0].id])).rejects.toThrow(/solo anexado/);
  });

  it("los documentos no pueden eliminarse", async () => {
    const doc = await createIncoming(admin.client);
    await admin.client.from("documents").delete().eq("id", doc.id);
    await expect(db().query("delete from public.documents where id = $1", [doc.id])).rejects.toThrow(/no se eliminan/);
    const { rows } = await db().query("select count(*)::int as n from public.documents where id = $1", [doc.id]);
    expect(rows[0].n).toBe(1);
  });

  it("las dependencias de la ruta obligatoria no pueden desactivarse ni recodificarse", async () => {
    const id = await departmentId("DIRECCION_INVESTIGACION");
    const off = await admin.client.from("departments").update({ active: false }).eq("id", id);
    expect(off.error?.message).toMatch(/SIGED_PROTEGIDO/);
    const recode = await admin.client.from("departments").update({ code: "OTRA" }).eq("id", id);
    expect(recode.error?.message).toMatch(/SIGED_PROTEGIDO/);
    const { data } = await viewer.client.from("departments").select("contact_name").eq("id", id).single();
    expect(data!.contact_name).toBe("Dr. Máximo Díaz");
  });
});
