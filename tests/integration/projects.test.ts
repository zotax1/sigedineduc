import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, closeDb, createUser, db, type Client, type TestUser } from "./helpers";

let admin: TestUser;
let viewer: TestUser;

const PDF = new TextEncoder().encode("%PDF-1.4\n% Documento ficticio de prueba\n%%EOF\n");

beforeAll(async () => {
  admin = await createUser("admin-proy", "ADMINISTRADOR");
  viewer = await createUser("consulta-proy");
});

afterAll(async () => {
  await closeDb();
});

async function createProject(client: Client, overrides: Record<string, unknown> = {}) {
  const { data, error } = await client
    .from("projects")
    .insert({
      code: `fce-t-${randomUUID().slice(0, 6)}`,
      title: "Proyecto ficticio de investigación educativa",
      principal_investigator: "Investigadora Ficticia",
      co_investigators: ["  Coinvestigador A ", "", "Coinvestigador A", "Coinvestigador B"],
      funding_source: "Fondo ficticio",
      ...overrides,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function createDocument(client: Client, projectId: string, overrides: Record<string, unknown> = {}) {
  const { data, error } = await client
    .from("project_documents")
    .insert({ project_id: projectId, kind: "AVAL_ETICO", title: "Aval ético de prueba", ...overrides } as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function events(projectId: string) {
  const { rows } = await db().query("select * from public.project_events where project_id = $1 order by seq", [projectId]);
  return rows;
}

describe("Proyectos: registro y permisos", () => {
  it("un administrador registra un proyecto; el servidor normaliza y fija autor y fecha", async () => {
    const p = await createProject(admin.client);
    expect(p.code).toMatch(/^FCE-T-/);
    expect(p.co_investigators).toEqual(["Coinvestigador A", "Coinvestigador B"]);
    expect(p.status).toBe("EN_TRAMITE");
    expect(p.created_by).toBe(admin.id);
    const ev = await events(p.id);
    expect(ev.map((e) => e.event_type)).toEqual(["CREACION"]);
    expect(ev[0].recorded_by).toBe(admin.id);
  });

  it("el código es único sin distinguir mayúsculas", async () => {
    const p = await createProject(admin.client);
    await expect(createProject(admin.client, { code: p.code.toLowerCase() })).rejects.toMatchObject({ code: "23505" });
  });

  it("el personal de consulta ve los proyectos pero no puede crearlos ni modificarlos", async () => {
    const p = await createProject(admin.client);
    const { data } = await viewer.client.from("project_overview").select("id").eq("id", p.id);
    expect(data).toHaveLength(1);
    await expect(createProject(viewer.client)).rejects.toBeTruthy();
    const upd = await viewer.client.from("projects").update({ title: "Cambio no autorizado del título" }).eq("id", p.id).select();
    expect(upd.data ?? []).toHaveLength(0);
    const rpc = await viewer.client.rpc("change_project_status", { p_project_id: p.id, p_status: "APROBADO" });
    expect(rpc.error?.message).toMatch(/administrador/);
  });

  it("los visitantes sin sesión no ven nada", async () => {
    await createProject(admin.client);
    const { data } = await anonClient().from("project_overview").select("id").limit(1);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("Proyectos: estados e historial", () => {
  it("el estado solo cambia mediante la función, que registra el evento con la observación", async () => {
    const p = await createProject(admin.client);
    const direct = await admin.client.from("projects").update({ status: "APROBADO" } as never).eq("id", p.id);
    expect(direct.error?.message).toMatch(/Cambiar estado/);

    const ok = await admin.client.rpc("change_project_status", { p_project_id: p.id, p_status: "APROBADO", p_notes: "Aprobado por el consejo" });
    expect(ok.error).toBeNull();
    const ev = (await events(p.id)).filter((e) => e.event_type === "CAMBIO_ESTADO");
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ from_status: "EN_TRAMITE", to_status: "APROBADO", notes: "Aprobado por el consejo" });

    const reject = await admin.client.rpc("change_project_status", { p_project_id: p.id, p_status: "RECHAZADO" });
    expect(reject.error?.message).toMatch(/motivo/);
  });

  it("la edición de datos queda registrada con los campos cambiados", async () => {
    const p = await createProject(admin.client);
    await admin.client.from("projects").update({ funding_source: "Otro fondo ficticio" }).eq("id", p.id);
    const upd = (await events(p.id)).find((e) => e.event_type === "ACTUALIZACION");
    expect(Object.keys(upd.changes)).toEqual(["funding_source"]);
  });

  it("el historial no puede modificarse ni borrarse", async () => {
    const p = await createProject(admin.client);
    await expect(db().query("update public.project_events set notes = 'x' where project_id = $1", [p.id])).rejects.toThrow(/solo anexado/);
    await expect(db().query("delete from public.project_events where project_id = $1", [p.id])).rejects.toThrow(/solo anexado/);
    await expect(db().query("delete from public.projects where id = $1", [p.id])).rejects.toThrow(/no se eliminan/);
  });
});

describe("Documentos especiales del proyecto", () => {
  it("cada documento tiene su trámite; la devolución exige observaciones", async () => {
    const p = await createProject(admin.client);
    const d = await createDocument(admin.client, p.id, { priority_code: "URGENTE" });
    expect(d.status).toBe("INGRESADO");

    const direct = await admin.client.from("project_documents").update({ status: "APROBADO" } as never).eq("id", d.id);
    expect(direct.error?.message).toMatch(/Actualizar estado/);

    const returned = await admin.client.rpc("change_project_document_status", { p_document_id: d.id, p_status: "DEVUELTO" });
    expect(returned.error?.message).toMatch(/observaciones/);

    const sign = await admin.client.rpc("change_project_document_status", { p_document_id: d.id, p_status: "PENDIENTE_FIRMA", p_notes: "Firma del decano" });
    expect(sign.error).toBeNull();

    const { data: overview } = await viewer.client.from("project_overview").select("*").eq("id", p.id).single();
    expect(overview).toMatchObject({ documents_total: 1, documents_pending: 1, documents_pending_signature: 1, documents_priority: 1, has_alerts: true });

    const ev = await events(p.id);
    expect(ev.map((e) => e.event_type)).toEqual(["CREACION", "DOCUMENTO_REGISTRADO", "DOCUMENTO_ESTADO"]);
    expect(ev[2]).toMatchObject({ project_document_id: d.id, from_status: "INGRESADO", to_status: "PENDIENTE_FIRMA" });

    await admin.client.rpc("change_project_document_status", { p_document_id: d.id, p_status: "COMPLETADO" });
    const { data: after } = await viewer.client.from("project_overview").select("documents_pending, has_alerts").eq("id", p.id).single();
    expect(after).toMatchObject({ documents_pending: 0, has_alerts: false });
  });

  it("los documentos vencidos se marcan como alerta", async () => {
    const p = await createProject(admin.client);
    await createDocument(admin.client, p.id, { due_date: "2020-01-01", kind: "INFORME_AVANCE", title: "Informe de avance atrasado" });
    const { data } = await viewer.client.from("project_document_overview").select("is_overdue, days_to_due").eq("project_id", p.id).single();
    expect(data?.is_overdue).toBe(true);
    expect(data!.days_to_due!).toBeLessThan(0);
  });

  it("un documento no puede moverse a otro proyecto", async () => {
    const a = await createProject(admin.client);
    const b = await createProject(admin.client);
    const d = await createDocument(admin.client, a.id);
    const r = await admin.client.from("project_documents").update({ project_id: b.id } as never).eq("id", d.id);
    expect(r.error?.message).toMatch(/inmutable/);
  });
});

describe("Notas internas", () => {
  it("las notas internas solo las ven los administradores", async () => {
    const p = await createProject(admin.client);
    await admin.client.rpc("add_project_note", { p_project_id: p.id, p_notes: "Nota pública de seguimiento" });
    await admin.client.rpc("add_project_note", { p_project_id: p.id, p_notes: "Nota interna reservada", p_internal: true });

    const adminView = await admin.client.from("project_event_overview").select("notes").eq("project_id", p.id).eq("event_type", "OBSERVACION");
    expect(adminView.data?.map((e) => e.notes).sort()).toEqual(["Nota interna reservada", "Nota pública de seguimiento"]);

    const viewerView = await viewer.client.from("project_events").select("notes").eq("project_id", p.id).eq("event_type", "OBSERVACION");
    expect(viewerView.data?.map((e) => e.notes)).toEqual(["Nota pública de seguimiento"]);

    const viewerNote = await viewer.client.rpc("add_project_note", { p_project_id: p.id, p_notes: "Intento de consulta" });
    expect(viewerNote.error?.message).toMatch(/administrador/);
  });
});

describe("Archivos de proyectos (almacenamiento privado)", () => {
  async function upload(client: Client, projectId: string, documentId: string) {
    const path = `proyectos/${projectId}/${documentId}/${randomUUID()}-aval.pdf`;
    const up = await client.storage.from("documentos").upload(path, PDF, { contentType: "application/pdf" });
    return { path, error: up.error };
  }

  it("solo un administrador carga, dentro de la carpeta de un documento existente", async () => {
    const p = await createProject(admin.client);
    const d = await createDocument(admin.client, p.id);
    expect((await upload(viewer.client, p.id, d.id)).error).toBeTruthy();
    expect((await upload(admin.client, p.id, randomUUID())).error).toBeTruthy();
    expect((await upload(admin.client, p.id, d.id)).error).toBeNull();
  });

  it("el personal de consulta descarga archivos vigentes, no retirados; los registrados no se borran", async () => {
    const p = await createProject(admin.client);
    const d = await createDocument(admin.client, p.id);
    const { path } = await upload(admin.client, p.id, d.id);
    const { data: file, error } = await admin.client
      .from("project_files")
      .insert({
        project_id: p.id,
        project_document_id: d.id,
        storage_path: path,
        original_filename: "aval.pdf",
        mime_type: "application/pdf",
        extension: "pdf",
        size_bytes: PDF.byteLength,
      })
      .select()
      .single();
    expect(error).toBeNull();

    const signed = await viewer.client.storage.from("documentos").createSignedUrl(path, 60);
    expect(signed.error).toBeNull();

    // Ninguna política de borrado alcanza un archivo registrado.
    await admin.client.storage.from("documentos").remove([path]);
    expect((await admin.client.storage.from("documentos").download(path)).error).toBeNull();

    const removed = await admin.client.rpc("remove_project_file", { p_file_id: file!.id, p_reason: "Versión equivocada" });
    expect(removed.error).toBeNull();
    const after = await viewer.client.storage.from("documentos").createSignedUrl(path, 60);
    expect(after.error).toBeTruthy();
    const ev = (await events(p.id)).map((e) => e.event_type);
    expect(ev).toEqual(expect.arrayContaining(["ARCHIVO_CARGADO", "ARCHIVO_RETIRADO"]));
  });

  it("los visitantes sin sesión no acceden a los archivos", async () => {
    const p = await createProject(admin.client);
    const d = await createDocument(admin.client, p.id);
    const { path } = await upload(admin.client, p.id, d.id);
    expect((await anonClient().storage.from("documentos").download(path)).error).toBeTruthy();
  });
});
