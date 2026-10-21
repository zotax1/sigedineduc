import { describe, expect, it } from "vitest";
import {
  OUTGOING_STAGES,
  OUTGOING_TRANSITIONS,
  ROUTE_SEGMENTS,
  computeStageStates,
  findOutgoingTransition,
  nextOutgoingTransitions,
  stageDepartment,
} from "./outgoing";

describe("ruta obligatoria (copia de la interfaz)", () => {
  it("desde INEDUC solo se puede remitir a la Dirección de Investigación", () => {
    const next = nextOutgoingTransitions("REGISTRADO_EN_INEDUC");
    expect(next.map((t) => t.to)).toEqual(["REMITIDO_A_DIRECCION_INVESTIGACION"]);
    expect(next[0].destination).toBe("DIRECCION_INVESTIGACION");
  });

  it("ninguna transición lleva de INEDUC directamente al Decanato", () => {
    for (const t of OUTGOING_TRANSITIONS) {
      if (t.origin === "INEDUC") expect(t.destination).not.toBe("DECANATO");
    }
    expect(findOutgoingTransition("REGISTRADO_EN_INEDUC", "REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO")).toBeUndefined();
    expect(findOutgoingTransition("REGISTRADO_EN_INEDUC", "RECIBIDO_EN_DECANATO")).toBeUndefined();
    expect(findOutgoingTransition("REMITIDO_A_DIRECCION_INVESTIGACION", "REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO")).toBeUndefined();
  });

  it("la remisión al Decanato exige la recepción previa en la Dirección", () => {
    const toDecanato = OUTGOING_TRANSITIONS.filter((t) => t.to === "REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO");
    expect(toDecanato.length).toBeGreaterThan(0);
    for (const t of toDecanato) expect(t.requiredPrior).toBe("RECIBIDO_EN_DIRECCION_INVESTIGACION");
    expect(findOutgoingTransition("REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO", "RECIBIDO_EN_DECANATO")?.requiredPrior).toBe(
      "REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO",
    );
  });

  it("cada transición termina en la dependencia que corresponde a la nueva etapa", () => {
    for (const t of OUTGOING_TRANSITIONS) expect(stageDepartment(t.to)).toBe(t.destination);
  });

  it("el archivo es terminal y solo se archiva lo completado", () => {
    expect(nextOutgoingTransitions("ARCHIVADO")).toEqual([]);
    expect(OUTGOING_TRANSITIONS.filter((t) => t.to === "ARCHIVADO").map((t) => t.from)).toEqual(["COMPLETADO"]);
  });

  it("los tramos visuales cubren todas las etapas exactamente una vez", () => {
    const all = ROUTE_SEGMENTS.flatMap((s) => s.stages);
    expect([...all].sort()).toEqual([...OUTGOING_STAGES].sort());
  });
});

describe("estado visual de las etapas", () => {
  it("solo marca como completadas las etapas con evento registrado", () => {
    const states = computeStageStates(
      "RECIBIDO_EN_DIRECCION_INVESTIGACION",
      new Set(["REGISTRADO_EN_INEDUC", "REMITIDO_A_DIRECCION_INVESTIGACION", "RECIBIDO_EN_DIRECCION_INVESTIGACION"]),
      false,
    );
    expect(states.REGISTRADO_EN_INEDUC).toBe("completada");
    expect(states.REMITIDO_A_DIRECCION_INVESTIGACION).toBe("completada");
    expect(states.RECIBIDO_EN_DIRECCION_INVESTIGACION).toBe("actual");
    expect(states.REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO).toBe("pendiente");
    expect(states.RECIBIDO_EN_DECANATO).toBe("pendiente");
  });

  it("una remisión sin recepción registrada no muestra la recepción como completada", () => {
    const states = computeStageStates("REMITIDO_A_DIRECCION_INVESTIGACION", new Set(["REGISTRADO_EN_INEDUC", "REMITIDO_A_DIRECCION_INVESTIGACION"]), false);
    expect(states.RECIBIDO_EN_DIRECCION_INVESTIGACION).toBe("pendiente");
  });

  it("marca la etapa actual como demorada y las opcionales omitidas como no aplicadas", () => {
    const states = computeStageStates(
      "REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO",
      new Set(["REGISTRADO_EN_INEDUC", "REMITIDO_A_DIRECCION_INVESTIGACION", "RECIBIDO_EN_DIRECCION_INVESTIGACION", "REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO"]),
      true,
    );
    expect(states.REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO).toBe("demorada");
    expect(states.EN_GESTION_DIRECCION_INVESTIGACION).toBe("omitida");
  });
});
