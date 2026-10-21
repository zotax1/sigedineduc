import { expect, test } from "@playwright/test";
import { ADMIN, VIEWER, login, unique } from "./fixtures";

test.describe("Adjuntos y reportes", () => {
  test("carga un PDF verificado y rechaza un archivo renombrado", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/entrantes/nuevo");
    const subject = unique("Con adjunto E2E");
    await page.getByLabel("Asunto").fill(subject);
    await page.getByLabel("Institución o dependencia remitente").fill("Institución de prueba");
    await page.getByRole("button", { name: "Registrar documento" }).click();
    await expect(page).toHaveURL(/\/documentos\//);

    await page.getByRole("button", { name: "Adjuntar archivo" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Archivo").setInputFiles({ name: "falso.pdf", mimeType: "application/pdf", buffer: Buffer.from("esto no es un pdf") });
    await dialog.getByRole("button", { name: "Cargar archivo" }).click();
    await expect(dialog.getByText(/no corresponde a su extensión/)).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();

    await page.getByRole("button", { name: "Adjuntar archivo" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Archivo").setInputFiles({ name: "oficio-prueba.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%prueba\n%%EOF\n") });
    await dialog.getByRole("button", { name: "Cargar archivo" }).click();
    await expect(page.getByText("oficio-prueba.pdf")).toBeVisible();

    const href = await page.getByRole("link", { name: "Descargar" }).first().getAttribute("href");
    const res = await page.request.get(href!);
    expect(res.ok()).toBe(true);
    expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("las exportaciones respetan filtros y permisos", async ({ page, browser }) => {
    await login(page, ADMIN);
    const marker = unique("Exportable");
    const secret = unique("Secreto exportable");
    for (const [subject, visibility] of [
      [marker, "GENERAL"],
      [secret, "RESTRINGIDO"],
    ] as const) {
      await page.goto("/salientes/nuevo");
      await page.getByLabel("Asunto").fill(subject);
      await page.getByLabel("Nivel de visibilidad").selectOption(visibility);
      await page.getByRole("button", { name: "Registrar documento" }).click();
      await expect(page).toHaveURL(/\/documentos\//);
    }

    const filtered = await page.request.get(`/api/reportes?tipo=salientes&formato=csv&q=${encodeURIComponent(marker)}`);
    expect(filtered.ok()).toBe(true);
    const csv = await filtered.text();
    expect(csv).toContain("Número oficial");
    expect(csv).toContain(marker);
    expect(csv).not.toContain(secret);

    const xlsx = await page.request.get(`/api/reportes?tipo=movimientos&formato=xlsx`);
    expect((await xlsx.body()).subarray(0, 2).toString()).toBe("PK");
    const pdf = await page.request.get(`/api/reportes?tipo=tramites&formato=pdf`);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

    const viewerCtx = await browser.newContext();
    const viewer = await viewerCtx.newPage();
    await login(viewer, VIEWER);
    const viewerCsv = await (await viewer.request.get(`/api/reportes?tipo=salientes&formato=csv&ambito=todos`)).text();
    expect(viewerCsv).toContain(marker);
    expect(viewerCsv).not.toContain(secret);
    await viewerCtx.close();
  });
});
