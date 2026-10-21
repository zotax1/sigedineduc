import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDb,
  createOutgoing,
  createUser,
  db,
  departmentId,
  documentRow,
  eventsOf,
  serviceClient,
  transition,
  type TestUser,
} from "./helpers";
import { OUTGOING_TRANSITIONS } from "@/lib/workflow/outgoing";

let admin: TestUser;
let viewer: TestUser;
let ineduc: string;
let direccion: string;
let decanato: string;

beforeAll(async () => {
  admin = await createUser("admin-flujo", "ADMINISTRADOR");
  viewer = await createUser("consulta-flujo");
  ineduc = await departmentId("INEDUC");
  direccion = await departmentId("DIRECCION_INVESTIGACION");
  decanato = await departmentId("DECANATO");
});

afterAll(async () => {
  await closeDb();
});

describe("Ruta obligatoria de documentos salientes", () => {
  it("registra el documento en la etapa INEDUC aunque el cliente envíe otros valores", async () => {
    const doc = await createOutgoing(admin.client, {
      status: "RECIBIDO_EN_DECANATO",
      current_department_id: decanato,
      created_by: viewer.id,
    });
    expect(doc.status).toBe("REGISTRADO_EN_INEDUC");
    expect(doc.current_department_id).toBe(ineduc);
    expect(doc.origin_department_id).toBe(ineduc);
    expect(doc.created_by).toBe(admin.id);
    expect(doc.internal_reference).toMatch(/^SIGED-S-\d{4}-\d{5}$/);
    expect(doc.internal_reference).not.toBe(doc.official_number);

    const events = await eventsOf(doc.id);
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe("REGISTRO");
    expect(events[0].recorded_by).toBe(admin.id);
  });

  it("identifica la Dirección de Investigación como único primer destino", async () => {
    const { data, error } = await admin.client.rpc("get_outgoing_route_definition");
    expect(error).toBeNull();
    const fromRegistered = data!.filter((t) => t.from_status === "REGISTRADO_EN_INEDUC");
    expect(fromRegistered).toHaveLength(1);
    expect(fromRegistered[0].to_status).toBe("REMITIDO_A_DIRECCION_INVESTIGACION");
    expect(fromRegistered[0].destination_code).toBe("DIRECCION_INVESTIGACION");
  });

  it("la copia de la ruta en la aplicación coincide exactamente con la base de datos", async () => {
    const { data } = await admin.client.rpc("get_outgoing_route_definition");
    const dbPairs = data!.map((t) => `${t.from_status}>${t.to_status}:${t.origin_code}>${t.destination_code}:${t.required_prior_status}`).sort();
    const appPairs = OUTGOING_TRANSITIONS.map(
      (t) => `${t.from}>${t.to}:${t.origin}>${t.destination}:${t.requiredPrior}`,
    ).sort();
    expect(appPairs).toEqual(dbPairs);
  });

  it("rechaza enviar un documento directamente de INEDUC al Decanato", async () => {
    const doc = await createOutgoing(admin.client);
    for (const target of ["REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO", "RECIBIDO_EN_DECANATO"] as const) {
      const { error } = await transition(admin.client, doc.id, "REGISTRADO_EN_INEDUC", target);
      expect(error?.message).toMatch(/Dirección de Investigación/);
    }
    const row = await documentRow(doc.id);
    expect(row.status).toBe("REGISTRADO_EN_INEDUC");
    expect(row.current_department_id).toBe(ineduc);
    expect(await eventsOf(doc.id)).toHaveLength(1);
  });

  it("no permite registrar la recepción en el Decanato antes de la remisión desde la Dirección", async () => {
    const doc = await createOutgoing(admin.client);
    expect((await transition(admin.client, doc.id, "REGISTRADO_EN_INEDUC", "REMITIDO_A_DIRECCION_INVESTIGACION")).error).toBeNull();
    expect((await transition(admin.client, doc.id, "REMITIDO_A_DIRECCION_INVESTIGACION", "RECIBIDO_EN_DIRECCION_INVESTIGACION")).error).toBeNull();

    const { error } = await transition(admin.client, doc.id, "RECIBIDO_EN_DIRECCION_INVESTIGACION", "RECIBIDO_EN_DECANATO");
    expect(error?.message).toMatch(/SIGED_RUTA_INVALIDA/);
    const row = await documentRow(doc.id);
    expect(row.status).toBe("RECIBIDO_EN_DIRECCION_INVESTIGACION");
    expect(row.received_at_decanato_at).toBeNull();
  });

  it("no permite marcar la remisión desde la Dirección sin su recepción previa", async () => {
    const doc = await createOutgoing(admin.client);
    await transition(admin.client, doc.id, "REGISTRADO_EN_INEDUC", "REMITIDO_A_DIRECCION_INVESTIGACION");
    const { error } = await transition(
      admin.client,
      doc.id,
      "REMITIDO_A_DIRECCION_INVESTIGACION",
      "REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO",
    );
    expect(error?.message).toMatch(/Dirección de Investigación/);
  });

  it("no marca un documento como recibido por el solo hecho de remitirlo", async () => {
    const doc = await createOutgoing(admin.client);
    await transition(admin.client, doc.id, "REGISTRADO_EN_INEDUC", "REMITIDO_A_DIRECCION_INVESTIGACION");
    const row = await documentRow(doc.id);
    expect(row.status).toBe("REMITIDO_A_DIRECCION_INVESTIGACION");
    expect(row.remitted_to_di_at).not.toBeNull();
    expect(row.received_at_di_at).toBeNull();
  });

  it("completa la ruta válida registrando actor, origen, destino y fecha del servidor", async () => {
    const doc = await createOutgoing(admin.client);
    const steps = [
      ["REGISTRADO_EN_INEDUC", "REMITIDO_A_DIRECCION_INVESTIGACION", ineduc, direccion],
      ["REMITIDO_A_DIRECCION_INVESTIGACION", "RECIBIDO_EN_DIRECCION_INVESTIGACION", ineduc, direccion],
      ["RECIBIDO_EN_DIRECCION_INVESTIGACION", "EN_GESTION_DIRECCION_INVESTIGACION", direccion, direccion],
      ["EN_GESTION_DIRECCION_INVESTIGACION", "REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO", direccion, decanato],
      ["REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO", "RECIBIDO_EN_DECANATO", direccion, decanato],
      ["RECIBIDO_EN_DECANATO", "EN_SEGUIMIENTO", decanato, decanato],
      ["EN_SEGUIMIENTO", "COMPLETADO", decanato, decanato],
      ["COMPLETADO", "ARCHIVADO", decanato, decanato],
    ] as const;

    const before = Date.now();
    for (const [from, to, origin, destination] of steps) {
      const { data, error } = await transition(admin.client, doc.id, from, to, `Paso ${to}`);
      expect(error).toBeNull();
      expect(data!.recorded_by).toBe(admin.id);
      expect(data!.from_status).toBe(from);
      expect(data!.to_status).toBe(to);
      expect(data!.from_department_id).toBe(origin);
      expect(data!.to_department_id).toBe(destination);
      expect(new Date(data!.occurred_at).getTime()).toBeGreaterThanOrEqual(before - 5000);
    }

    const row = await documentRow(doc.id);
    expect(row.status).toBe("ARCHIVADO");
    expect(row.current_department_id).toBe(decanato);
    for (const col of ["remitted_to_di_at", "received_at_di_at", "remitted_to_decanato_at", "received_at_decanato_at", "completed_at", "archived_at"]) {
      expect(row[col], col).not.toBeNull();
    }

    // El historial conserva todos los movimientos en orden cronológico.
    const events = await eventsOf(doc.id);
    expect(events.map((e) => e.to_status)).toEqual(["REGISTRADO_EN_INEDUC", ...steps.map((s) => s[1])]);
    const times = events.map((e) => new Date(e.occurred_at).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("una transición inválida no deja actualizaciones parciales", async () => {
    const doc = await createOutgoing(admin.client);
    const before = await documentRow(doc.id);
    const { error } = await transition(admin.client, doc.id, "REGISTRADO_EN_INEDUC", "ARCHIVADO");
    expect(error).not.toBeNull();
    const after = await documentRow(doc.id);
    expect(after.status).toBe(before.status);
    expect(after.current_department_id).toBe(before.current_department_id);
    expect(after.updated_at.getTime()).toBe(before.updated_at.getTime());
    expect(await eventsOf(doc.id)).toHaveLength(1);
  });

  it("controla la concurrencia: dos registros simultáneos del mismo paso, solo uno prospera", async () => {
    const doc = await createOutgoing(admin.client);
    const results = await Promise.all([
      transition(admin.client, doc.id, "REGISTRADO_EN_INEDUC", "REMITIDO_A_DIRECCION_INVESTIGACION"),
      transition(admin.client, doc.id, "REGISTRADO_EN_INEDUC", "REMITIDO_A_DIRECCION_INVESTIGACION"),
    ]);
    const ok = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);
    expect(ok).toHaveLength(1);
    expect(failed[0].error!.message).toMatch(/SIGED_CONFLICTO/);
    expect((await eventsOf(doc.id)).filter((e) => e.event_type === "TRANSICION")).toHaveLength(1);
  });

  it("impide cambiar la etapa o la dependencia editando el registro directamente", async () => {
    const doc = await createOutgoing(admin.client);
    const { error } = await admin.client
      .from("documents")
      .update({ status: "RECIBIDO_EN_DECANATO", current_department_id: decanato })
      .eq("id", doc.id);
    expect(error?.message).toMatch(/SIGED_RUTA_INVALIDA/);

    // Ni siquiera la clave de servicio puede saltarse la ruta.
    const { error: serviceError } = await serviceClient()
      .from("documents")
      .update({ status: "RECIBIDO_EN_DECANATO", current_department_id: decanato })
      .eq("id", doc.id);
    expect(serviceError?.message).toMatch(/SIGED_RUTA_INVALIDA/);

    // Ni insertando un evento de historial por su cuenta.
    const { error: eventError } = await serviceClient()
      .from("document_route_events")
      .insert({
        document_id: doc.id,
        event_type: "TRANSICION",
        from_status: "REGISTRADO_EN_INEDUC",
        to_status: "RECIBIDO_EN_DECANATO",
        action: "Intento de omisión",
      });
    expect(eventError?.message).toMatch(/SIGED_RUTA_INVALIDA/);

    // Ni con acceso de superusuario directo a la base de datos.
    await expect(
      db().query("update public.documents set status = 'RECIBIDO_EN_DECANATO', current_department_id = $2 where id = $1", [doc.id, decanato]),
    ).rejects.toThrow(/SIGED_RUTA_INVALIDA/);

    const row = await documentRow(doc.id);
    expect(row.status).toBe("REGISTRADO_EN_INEDUC");
  });

  it("el historial es de solo anexado", async () => {
    const doc = await createOutgoing(admin.client);
    const [event] = await eventsOf(doc.id);
    await expect(
      db().query("update public.document_route_events set notes = 'alterado' where id = $1", [event.id]),
    ).rejects.toThrow(/solo anexado/);
    await expect(db().query("delete from public.document_route_events where id = $1", [event.id])).rejects.toThrow(
      /solo anexado/,
    );
    const { error } = await admin.client.from("document_route_events").delete().eq("id", event.id);
    expect(error).not.toBeNull();
  });

  it("permite una corrección autorizada que conserva el evento original y explica el motivo", async () => {
    const doc = await createOutgoing(admin.client);
    await transition(admin.client, doc.id, "REGISTRADO_EN_INEDUC", "REMITIDO_A_DIRECCION_INVESTIGACION");
    await transition(admin.client, doc.id, "REMITIDO_A_DIRECCION_INVESTIGACION", "RECIBIDO_EN_DIRECCION_INVESTIGACION");

    const short = await admin.client.rpc("reverse_last_movement", {
      p_document_id: doc.id,
      p_expected_status: "RECIBIDO_EN_DIRECCION_INVESTIGACION",
      p_reason: "error",
    });
    expect(short.error?.message).toMatch(/motivo/);

    const { data, error } = await admin.client.rpc("reverse_last_movement", {
      p_document_id: doc.id,
      p_expected_status: "RECIBIDO_EN_DIRECCION_INVESTIGACION",
      p_reason: "La recepción se registró por error antes de recibir el acuse.",
    });
    expect(error).toBeNull();
    expect(data!.event_type).toBe("REVERSION");
    expect(data!.recorded_by).toBe(admin.id);

    const row = await documentRow(doc.id);
    expect(row.status).toBe("REMITIDO_A_DIRECCION_INVESTIGACION");
    expect(row.current_department_id).toBe(direccion);
    expect(row.received_at_di_at).toBeNull();

    const events = await eventsOf(doc.id);
    expect(events.map((e) => e.event_type)).toEqual(["REGISTRO", "TRANSICION", "TRANSICION", "REVERSION"]);

    // Tras revertir la recepción, sigue sin poder remitirse al Decanato.
    const skip = await transition(
      admin.client,
      doc.id,
      "REMITIDO_A_DIRECCION_INVESTIGACION",
      "REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO",
    );
    expect(skip.error?.message).toMatch(/Dirección de Investigación/);

    // Y la recepción puede volver a registrarse correctamente.
    const redo = await transition(admin.client, doc.id, "REMITIDO_A_DIRECCION_INVESTIGACION", "RECIBIDO_EN_DIRECCION_INVESTIGACION");
    expect(redo.error).toBeNull();
  });

  it("el personal de consulta no puede registrar movimientos", async () => {
    const doc = await createOutgoing(admin.client);
    const { error } = await transition(viewer.client, doc.id, "REGISTRADO_EN_INEDUC", "REMITIDO_A_DIRECCION_INVESTIGACION");
    expect(error?.message).toMatch(/SIGED_NO_AUTORIZADO/);
    const obs = await viewer.client.rpc("add_document_observation", { p_document_id: doc.id, p_notes: "Intento" });
    expect(obs.error?.message).toMatch(/SIGED_NO_AUTORIZADO/);
    expect((await documentRow(doc.id)).status).toBe("REGISTRADO_EN_INEDUC");
  });

  it("evita números oficiales salientes duplicados", async () => {
    const number = `INEDUC-DUP-${Date.now()}`;
    await createOutgoing(admin.client, { official_number: number });
    await expect(createOutgoing(admin.client, { official_number: ` ${number.toLowerCase()} ` })).rejects.toMatchObject({
      code: "23505",
    });
  });
});
