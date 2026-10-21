import { describe, expect, it } from "vitest";
import { incomingSchema, outgoingSchema, toIncomingPayload } from "./documents";
import { addDaysISO, todayISO } from "@/lib/format";

const baseIncoming = {
  official_number: "",
  subject: "Comunicación de prueba",
  description: "",
  document_type_id: "",
  priority_code: "MEDIA",
  issued_on: "",
  responsible_id: "",
  due_date: "",
  next_action: "",
  observations: "",
  visibility: "GENERAL" as const,
  sender_name: "",
  sender_institution: "Institución ficticia",
  origin_department_id: "",
  recipient_department_id: "6f1c1f0e-4a8e-4d5b-9b55-1d2c3e4f5a6b",
  received_on: todayISO(),
  received_by_name: "",
};

describe("validación de documentos entrantes", () => {
  it("acepta un registro válido sin número oficial", () => {
    const r = incomingSchema.safeParse(baseIncoming);
    expect(r.success).toBe(true);
    expect(toIncomingPayload(r.data!).official_number).toBeNull();
  });

  it("exige asunto, remitente y fecha de recepción", () => {
    const r = incomingSchema.safeParse({ ...baseIncoming, subject: "a", sender_institution: "", received_on: "" });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["subject", "received_on"]));
  });

  it("rechaza fechas futuras y recepción anterior a la emisión", () => {
    expect(incomingSchema.safeParse({ ...baseIncoming, received_on: addDaysISO(todayISO(), 2) }).success).toBe(false);
    expect(
      incomingSchema.safeParse({ ...baseIncoming, issued_on: todayISO(), received_on: addDaysISO(todayISO(), -3) }).success,
    ).toBe(false);
  });

  it("rechaza valores arbitrarios en campos controlados", () => {
    expect(incomingSchema.safeParse({ ...baseIncoming, visibility: "PUBLICO" }).success).toBe(false);
    expect(incomingSchema.safeParse({ ...baseIncoming, recipient_department_id: "DECANATO" }).success).toBe(false);
    expect(incomingSchema.safeParse({ ...baseIncoming, priority_code: "drop table" }).success).toBe(false);
  });
});

describe("validación de documentos salientes", () => {
  it("no admite campos de etapa o dependencia (los fija el servidor)", () => {
    const r = outgoingSchema.safeParse({
      ...baseIncoming,
      recipient_name: "",
      destination_institution: "",
      recipient_department_id: "",
      status: "RECIBIDO_EN_DECANATO",
      current_department_id: "x",
    });
    expect(r.success).toBe(true);
    expect(r.data).not.toHaveProperty("status");
    expect(r.data).not.toHaveProperty("current_department_id");
  });
});
