import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { anonClient, closeDb, createIncoming, createOutgoing, createUser, db, localEnv, type Client, type TestUser } from "./helpers";

let admin: TestUser;
let viewer: TestUser;

const PDF = new TextEncoder().encode("%PDF-1.4\n% Documento ficticio de prueba\n%%EOF\n");

beforeAll(async () => {
  admin = await createUser("admin-adj", "ADMINISTRADOR");
  viewer = await createUser("consulta-adj");
});

afterAll(async () => {
  await closeDb();
});

async function uploadAttachment(client: Client, documentId: string) {
  const path = `${documentId}/${randomUUID()}-oficio.pdf`;
  const up = await client.storage.from("documentos").upload(path, PDF, { contentType: "application/pdf" });
  if (up.error) throw up.error;
  const { data, error } = await client
    .from("document_attachments")
    .insert({
      document_id: documentId,
      storage_path: path,
      original_filename: "oficio.pdf",
      mime_type: "application/pdf",
      extension: "pdf",
      size_bytes: PDF.byteLength,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

describe("Adjuntos privados", () => {
  it("el bucket es privado: la URL pública no sirve el archivo", async () => {
    const doc = await createOutgoing(admin.client);
    const att = await uploadAttachment(admin.client, doc.id);
    const publicUrl = `${localEnv().url}/storage/v1/object/public/documentos/${att.storage_path}`;
    const res = await fetch(publicUrl);
    expect(res.ok).toBe(false);
    const anonDownload = await anonClient().storage.from("documentos").download(att.storage_path);
    expect(anonDownload.error).not.toBeNull();
  });

  it("el personal autorizado descarga mediante URL firmada de corta duración", async () => {
    const doc = await createIncoming(admin.client);
    const att = await uploadAttachment(admin.client, doc.id);
    const { data, error } = await viewer.client.storage.from("documentos").createSignedUrl(att.storage_path, 60);
    expect(error).toBeNull();
    const res = await fetch(data!.signedUrl);
    expect(res.ok).toBe(true);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF);
  });

  it("no se pueden descargar adjuntos de documentos restringidos sin autorización", async () => {
    const doc = await createOutgoing(admin.client, { visibility: "RESTRINGIDO" });
    const att = await uploadAttachment(admin.client, doc.id);
    const signed = await viewer.client.storage.from("documentos").createSignedUrl(att.storage_path, 60);
    expect(signed.error).not.toBeNull();
    const download = await viewer.client.storage.from("documentos").download(att.storage_path);
    expect(download.error).not.toBeNull();
    const meta = await viewer.client.from("document_attachments").select("id").eq("id", att.id);
    expect(meta.data).toEqual([]);
  });

  it("un adjunto retirado deja de estar disponible para consulta pero se conserva", async () => {
    const doc = await createIncoming(admin.client);
    const att = await uploadAttachment(admin.client, doc.id);
    const { error } = await admin.client.rpc("remove_attachment", { p_attachment_id: att.id, p_reason: "Versión incorrecta" });
    expect(error).toBeNull();
    const signed = await viewer.client.storage.from("documentos").createSignedUrl(att.storage_path, 60);
    expect(signed.error).not.toBeNull();
    const adminView = await admin.client.from("document_attachments").select("removed_at,removed_by,removal_reason").eq("id", att.id).single();
    expect(adminView.data!.removed_by).toBe(admin.id);
    // El archivo registrado no puede borrarse del almacenamiento.
    await admin.client.storage.from("documentos").remove([att.storage_path]);
    const still = await admin.client.storage.from("documentos").download(att.storage_path);
    expect(still.error).toBeNull();
  });

  it("el personal de consulta no puede cargar archivos y nadie puede cargar fuera de un documento", async () => {
    const doc = await createIncoming(admin.client);
    const viewerUpload = await viewer.client.storage.from("documentos").upload(`${doc.id}/x.pdf`, PDF, { contentType: "application/pdf" });
    expect(viewerUpload.error).not.toBeNull();
    const orphan = await admin.client.storage.from("documentos").upload(`${randomUUID()}/x.pdf`, PDF, { contentType: "application/pdf" });
    expect(orphan.error).not.toBeNull();
    const badType = await admin.client.storage
      .from("documentos")
      .upload(`${doc.id}/script.html`, new TextEncoder().encode("<script>"), { contentType: "text/html" });
    expect(badType.error).not.toBeNull();
  });
});

function waitForSubscribed(channel: RealtimeChannel) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Tiempo de espera de suscripción agotado")), 15_000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

describe("Tiempo real autorizado", () => {
  it("entrega cambios a usuarios autorizados y respeta la visibilidad y la autenticación", async () => {
    const received: { viewer: string[] } = { viewer: [] };
    const anonPayloads: { new: Record<string, unknown>; errors?: string[] }[] = [];
    const { rows: baseline } = await db().query("select count(*)::int as n from realtime.subscription");

    const viewerChannel = viewer.client
      .channel(`docs-viewer-${randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "documents" }, (payload) => {
        received.viewer.push((payload.new as { id: string }).id);
      });
    const anon = anonClient();
    const anonChannel = anon
      .channel(`docs-anon-${randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "documents" }, (payload) => {
        anonPayloads.push(payload as unknown as { new: Record<string, unknown>; errors?: string[] });
      });

    await Promise.all([waitForSubscribed(viewerChannel), waitForSubscribed(anonChannel)]);
    // Espera a que el servidor registre la suscripción autenticada.
    for (let i = 0; i < 60; i++) {
      const { rows } = await db().query("select count(*)::int as n from realtime.subscription");
      if (rows[0].n > baseline[0].n) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    await new Promise((r) => setTimeout(r, 500));

    const general = await createIncoming(admin.client);
    const restricted = await createOutgoing(admin.client, { visibility: "RESTRINGIDO" });

    const deadline = Date.now() + 10_000;
    while (!received.viewer.includes(general.id) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250));
    }
    await new Promise((r) => setTimeout(r, 1500));

    expect(received.viewer).toContain(general.id);
    expect(received.viewer).not.toContain(restricted.id);
    // Una suscripción sin autenticación no recibe ningún dato: Supabase solo
    // emite un aviso vacío con error 401.
    for (const payload of anonPayloads) {
      expect(payload.new).toEqual({});
      expect(payload.errors?.join(" ")).toMatch(/401/);
    }
    expect(JSON.stringify(anonPayloads)).not.toContain(general.subject);

    await viewer.client.removeChannel(viewerChannel);
    await anon.removeChannel(anonChannel);
  });
});
