import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, createIncoming, createOutgoing, createUser, db, departmentId, eventsOf, type TestUser } from "./helpers";

let admin: TestUser;
let viewer: TestUser;

function isoDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(d);
}

beforeAll(async () => {
  admin = await createUser("admin-doc", "ADMINISTRADOR");
  viewer = await createUser("consulta-doc");
});

afterAll(async () => {
  await closeDb();
});

describe("Documentos entrantes", () => {
  it("un administrador registra un documento entrante con fecha y actor del servidor", async () => {
    const doc = await createIncoming(admin.client, { official_number: null, subject: "Solicitud de colaboración académica" });
    expect(doc.status).toBe("RECIBIDO");
    expect(doc.official_number).toBeNull();
    expect(doc.internal_reference).toMatch(/^SIGED-E-/);
    expect(doc.created_by).toBe(admin.id);
    expect(doc.current_department_id).toBe(await departmentId("INEDUC"));
  });

  it("valida los campos obligatorios", async () => {
    await expect(createIncoming(admin.client, { received_on: null })).rejects.toMatchObject({ code: "23514" });
    await expect(createIncoming(admin.client, { sender_name: null, sender_institution: null })).rejects.toMatchObject({ code: "23514" });
    await expect(createIncoming(admin.client, { subject: "  " })).rejects.toMatchObject({ code: "23514" });
    await expect(createIncoming(admin.client, { received_on: isoDate(5) })).rejects.toThrow(/futura/);
  });

  it("permite el mismo número oficial si proviene de instituciones distintas", async () => {
    const number = `OF-${Date.now()}`;
    await createIncoming(admin.client, { official_number: number, sender_institution: "Institución A" });
    await createIncoming(admin.client, { official_number: number, sender_institution: "Institución B" });
    await expect(createIncoming(admin.client, { official_number: number, sender_institution: "institución a" })).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("el personal de consulta puede buscar y consultar el registro", async () => {
    const marker = `Convenio ${Date.now()}`;
    const doc = await createIncoming(admin.client, { subject: `${marker} de investigación educativa` });
    // Búsqueda sin tildes ni mayúsculas.
    const term = marker.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const { data } = await viewer.client.from("document_overview").select("id,subject").ilike("search_text", `%${term}%`);
    expect(data?.map((d) => d.id)).toContain(doc.id);
  });

  it("registra traslados flexibles entre dependencias y su historial", async () => {
    const doc = await createIncoming(admin.client);
    const decanato = await departmentId("DECANATO");
    const { error } = await admin.client.rpc("record_incoming_movement", {
      p_document_id: doc.id,
      p_expected_status: "RECIBIDO",
      p_to_status: "REMITIDO",
      p_to_department_id: decanato,
      p_notes: "Se remite para conocimiento",
    });
    expect(error).toBeNull();
    const archiveEarly = await admin.client.rpc("record_incoming_movement", {
      p_document_id: doc.id,
      p_expected_status: "REMITIDO",
      p_to_status: "ARCHIVADO",
    });
    expect(archiveEarly.error?.message).toMatch(/completados/);
    const events = await eventsOf(doc.id);
    expect(events.map((e) => e.event_type)).toEqual(["REGISTRO", "MOVIMIENTO"]);
    expect(events[1].to_department_id).toBe(decanato);
  });

  it("la asignación de responsable queda en el historial y genera notificación", async () => {
    const doc = await createIncoming(admin.client);
    const { error } = await admin.client.from("documents").update({ responsible_id: viewer.id }).eq("id", doc.id);
    expect(error).toBeNull();
    const events = await eventsOf(doc.id);
    expect(events.at(-1).event_type).toBe("ASIGNACION");
    const { data } = await viewer.client.from("notifications").select("*").eq("document_id", doc.id);
    expect(data?.some((n) => n.kind === "ASIGNACION")).toBe(true);
    // Sin duplicados por el mismo evento.
    const keys = data!.map((n) => n.dedupe_key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("un documento archivado no admite cambios", async () => {
    const doc = await createIncoming(admin.client);
    await admin.client.rpc("record_incoming_movement", { p_document_id: doc.id, p_expected_status: "RECIBIDO", p_to_status: "COMPLETADO" });
    await admin.client.rpc("record_incoming_movement", { p_document_id: doc.id, p_expected_status: "COMPLETADO", p_to_status: "ARCHIVADO" });
    const { error } = await admin.client.from("documents").update({ subject: "Cambio tardío" }).eq("id", doc.id);
    expect(error?.message).toMatch(/archivado/);
  });
});

describe("Trámites y procedimientos", () => {
  it("se crea un trámite asociado a un documento con su historial", async () => {
    const doc = await createOutgoing(admin.client);
    const { data, error } = await admin.client
      .from("procedures")
      .insert({
        title: "Preparar respuesta institucional",
        document_id: doc.id,
        responsible_id: viewer.id,
        responsible_department_id: await departmentId("INEDUC"),
        start_date: isoDate(0),
        due_date: isoDate(10),
        priority_code: "ALTA",
      })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data!.reference).toMatch(/^TRM-\d{4}-\d{5}$/);
    expect(data!.created_by).toBe(admin.id);

    const { data: overview } = await viewer.client.from("procedure_overview").select("*").eq("id", data!.id).single();
    expect(overview!.document_id).toBe(doc.id);
    expect(overview!.is_overdue).toBe(false);

    const { data: notes } = await viewer.client.from("notifications").select("kind").eq("procedure_id", data!.id);
    expect(notes?.map((n) => n.kind)).toContain("TRAMITE_ASIGNADO");
  });

  it("calcula correctamente los avisos por fecha límite", async () => {
    const dep = await departmentId("DIRECCION_INVESTIGACION");
    const base = { responsible_department_id: dep, priority_code: "MEDIA" };
    const { data: overdue } = await admin.client
      .from("procedures")
      .insert({ ...base, title: "Trámite vencido de prueba", start_date: isoDate(-20), due_date: isoDate(-1) })
      .select("id")
      .single();
    const { data: soon } = await admin.client
      .from("procedures")
      .insert({ ...base, title: "Trámite por vencer de prueba", start_date: isoDate(0), due_date: isoDate(1) })
      .select("id")
      .single();
    const { data: later } = await admin.client
      .from("procedures")
      .insert({ ...base, title: "Trámite holgado de prueba", start_date: isoDate(0), due_date: isoDate(30) })
      .select("id")
      .single();

    const { data } = await viewer.client
      .from("procedure_overview")
      .select("id,is_overdue,is_due_soon,days_to_due")
      .in("id", [overdue!.id, soon!.id, later!.id]);
    const byId = Object.fromEntries(data!.map((r) => [r.id, r]));
    expect(byId[overdue!.id]).toMatchObject({ is_overdue: true, is_due_soon: false, days_to_due: -1 });
    expect(byId[soon!.id]).toMatchObject({ is_overdue: false, is_due_soon: true, days_to_due: 1 });
    expect(byId[later!.id]).toMatchObject({ is_overdue: false, is_due_soon: false });

    // Completar un trámite vencido elimina el aviso: es un indicador calculado.
    await admin.client.rpc("change_procedure_status", { p_procedure_id: overdue!.id, p_status: "COMPLETADO", p_notes: "Listo" });
    const { data: after } = await viewer.client.from("procedure_overview").select("is_overdue,status,completed_at").eq("id", overdue!.id).single();
    expect(after).toMatchObject({ is_overdue: false, status: "COMPLETADO" });
    expect(after!.completed_at).not.toBeNull();

    // Las alertas de plazos son idempotentes.
    await db().query("delete from private.job_state");
    const first = await admin.client.rpc("refresh_deadline_notifications", {});
    expect(first.error).toBeNull();
    await db().query("delete from private.job_state");
    const second = await admin.client.rpc("refresh_deadline_notifications", {});
    expect(second.data).toBe(0);
    const { rows } = await db().query(
      "select count(*)::int as n from public.notifications where procedure_id = $1 and kind = 'TRAMITE_POR_VENCER'",
      [soon!.id],
    );
    expect(rows[0].n).toBeGreaterThan(0);
  });

  it("completar un trámite actualiza los conteos del panel", async () => {
    const { data: before } = await admin.client.rpc("dashboard_summary", {});
    const k0 = (before as { kpis: Record<string, number> }).kpis;
    const { data: proc } = await admin.client
      .from("procedures")
      .insert({ title: "Trámite para conteo", responsible_department_id: await departmentId("DECANATO"), start_date: isoDate(0) })
      .select("id")
      .single();
    const { data: mid } = await admin.client.rpc("dashboard_summary", {});
    expect((mid as { kpis: Record<string, number> }).kpis.procedures_pending).toBe(k0.procedures_pending + 1);
    await admin.client.rpc("change_procedure_status", { p_procedure_id: proc!.id, p_status: "COMPLETADO" });
    const { data: after } = await admin.client.rpc("dashboard_summary", {});
    const k2 = (after as { kpis: Record<string, number>; procedures_completion: Record<string, number> });
    expect(k2.kpis.procedures_pending).toBe(k0.procedures_pending);
  });

  it("permite filtrar por estado, prioridad, responsable y dependencia", async () => {
    const dep = await departmentId("DECANATO");
    const { data: created } = await admin.client
      .from("procedures")
      .insert({
        title: "Trámite filtrable",
        responsible_id: viewer.id,
        responsible_department_id: dep,
        priority_code: "URGENTE",
        start_date: isoDate(0),
      })
      .select("id")
      .single();
    const { data } = await viewer.client
      .from("procedure_overview")
      .select("id")
      .eq("status", "PENDIENTE")
      .eq("priority_code", "URGENTE")
      .eq("responsible_id", viewer.id)
      .eq("responsible_department_id", dep);
    expect(data?.map((r) => r.id)).toContain(created!.id);
  });

  it("el personal de consulta no puede crear ni modificar trámites", async () => {
    const insert = await viewer.client
      .from("procedures")
      .insert({ title: "No autorizado", responsible_department_id: await departmentId("INEDUC"), start_date: isoDate(0) });
    expect(insert.error).not.toBeNull();
  });
});

describe("Panel principal", () => {
  it("los indicadores provienen de datos persistidos y responden a los filtros", async () => {
    const { data: before } = await viewer.client.rpc("dashboard_summary", {});
    const kpis0 = (before as { kpis: Record<string, number> }).kpis;
    await createIncoming(admin.client);
    await createOutgoing(admin.client);
    const { data: after } = await viewer.client.rpc("dashboard_summary", {});
    const kpis1 = (after as { kpis: Record<string, number> }).kpis;
    expect(kpis1.incoming_total).toBe(kpis0.incoming_total + 1);
    expect(kpis1.outgoing_total).toBe(kpis0.outgoing_total + 1);

    // Un período sin registros devuelve ceros.
    const { data: past } = await viewer.client.rpc("dashboard_summary", { p_from: "2000-01-01", p_to: "2000-01-31" });
    const kpisPast = (past as { kpis: Record<string, number>; period: { unit: string } });
    expect(kpisPast.kpis.incoming_total).toBe(0);
    expect(kpisPast.period.unit).toBe("day");

    const byDept = (after as { by_department: { code: string; open_count: number }[] }).by_department;
    expect(byDept.map((d) => d.code)).toEqual(expect.arrayContaining(["INEDUC", "DIRECCION_INVESTIGACION", "DECANATO"]));
  });

  it("los conteos respetan la visibilidad de cada usuario", async () => {
    const { data: v0 } = await viewer.client.rpc("dashboard_summary", {});
    const { data: a0 } = await admin.client.rpc("dashboard_summary", {});
    await createOutgoing(admin.client, { visibility: "RESTRINGIDO" });
    const { data: v1 } = await viewer.client.rpc("dashboard_summary", {});
    const { data: a1 } = await admin.client.rpc("dashboard_summary", {});
    const k = (x: unknown) => (x as { kpis: Record<string, number> }).kpis.outgoing_total;
    expect(k(v1)).toBe(k(v0));
    expect(k(a1)).toBe(k(a0) + 1);
  });
});

describe("Notificaciones", () => {
  it("cada usuario solo ve y marca sus propias notificaciones", async () => {
    const doc = await createIncoming(admin.client, { responsible_id: viewer.id });
    const { data: mine } = await viewer.client.from("notifications").select("id,recipient_id").eq("document_id", doc.id);
    expect(mine!.length).toBeGreaterThan(0);
    expect(mine!.every((n) => n.recipient_id === viewer.id)).toBe(true);

    const tamper = await viewer.client.from("notifications").update({ title: "Alterada" } as never).eq("id", mine![0].id);
    expect(tamper.error).not.toBeNull();

    const read = await viewer.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", mine![0].id).select();
    expect(read.error).toBeNull();
    expect(read.data![0].read_at).not.toBeNull();
  });
});
