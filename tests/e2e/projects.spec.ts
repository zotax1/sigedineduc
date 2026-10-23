import { expect, test } from "@playwright/test";
import { ADMIN, VIEWER, login, unique } from "./fixtures";

const PDF = { name: "aval-etico.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%prueba\n%%EOF\n") };

test.describe("Proyectos de investigación", () => {
  test("registra un proyecto con documentos, gestiona su trámite y el personal de consulta solo visualiza", async ({ page, browser }) => {
    test.slow();
    await login(page, ADMIN);
    await page.getByRole("link", { name: "Proyectos" }).first().click();
    await expect(page.getByRole("heading", { name: "Proyectos de investigación" })).toBeVisible();
    await expect(page.getByText("Total de proyectos")).toBeVisible();

    await page.getByRole("link", { name: "Nuevo proyecto" }).click();
    const title = unique("Proyecto E2E sobre lectura inicial");
    const code = `E2E-${Date.now().toString(36).toUpperCase()}`;
    await page.getByLabel("Código o ID del proyecto").fill(code);
    await page.getByLabel("Título del proyecto").fill(title);
    await page.getByLabel("Investigador principal (IP)").fill("Investigadora E2E");
    await page.getByLabel("Coinvestigadores").fill("Coinvestigador Uno\nCoinvestigador Dos");
    await page.getByLabel("Fuente de financiamiento").fill("Fondo E2E");

    await page.getByRole("button", { name: "Agregar documento" }).click();
    await page.getByLabel(/^Tipo/).selectOption("AVAL_ETICO");
    await page.getByLabel("Prioridad").selectOption("URGENTE");
    await page.getByLabel("Archivo (opcional)").setInputFiles(PDF);
    await page.getByRole("button", { name: "Registrar proyecto" }).click();

    await expect(page).toHaveURL(/\/proyectos\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("Coinvestigador Dos")).toBeVisible();
    const documents = page.locator("#documentos");
    await expect(documents.getByText("aval-etico.pdf")).toBeVisible();
    await expect(documents.getByText("aval etico", { exact: true })).toBeVisible();
    await expect(documents.getByText("Prioridad urgente", { exact: true })).toBeVisible();

    // Estado del documento: pendiente de firma → alerta visible.
    await documents.getByRole("button", { name: "Actualizar estado" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nuevo estado").selectOption("PENDIENTE_FIRMA");
    await dialog.getByLabel("Observación").fill("Falta la firma del decano");
    await dialog.getByRole("button", { name: "Confirmar" }).click();
    await expect(documents.getByText("Pendiente de firma").first()).toBeVisible();
    await expect(page.getByText(/1 pendiente\(s\) de firma/)).toBeVisible();

    // Estado del proyecto y nota interna.
    await page.getByRole("button", { name: "Cambiar estado del proyecto" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nuevo estado").selectOption("APROBADO");
    await dialog.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Aprobado").first()).toBeVisible();

    await page.getByRole("button", { name: "Agregar observación", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Observación").fill("Nota interna E2E reservada");
    await dialog.getByRole("checkbox", { name: /Nota interna/ }).check();
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Nota interna E2E reservada")).toBeVisible();
    await expect(page.getByText("Falta la firma del decano")).toBeVisible();

    // Filtros del listado.
    await page.goto(`/proyectos?financiamiento=${encodeURIComponent("Fondo E2E")}&alerta=firma`);
    await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
    await page.goto(`/proyectos?q=${encodeURIComponent(code)}&estado=EN_FORMULACION`);
    await expect(page.getByRole("link", { name: title, exact: true })).toHaveCount(0);

    // Personal de consulta.
    const viewerContext = await browser.newContext();
    const viewer = await viewerContext.newPage();
    await login(viewer, VIEWER);
    await viewer.goto(`/proyectos?q=${encodeURIComponent(code)}`);
    await expect(viewer.getByRole("link", { name: "Nuevo proyecto" })).toHaveCount(0);
    await viewer.getByRole("link", { name: title, exact: true }).click();
    await expect(viewer.getByText("Falta la firma del decano")).toBeVisible();
    await expect(viewer.getByText("Nota interna E2E reservada")).toHaveCount(0);
    await expect(viewer.getByRole("button", { name: "Actualizar estado" })).toHaveCount(0);
    const href = await viewer.getByRole("link", { name: "Descargar" }).first().getAttribute("href");
    const res = await viewer.request.get(href!);
    expect(res.ok()).toBe(true);
    expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
    await viewer.goto("/proyectos/nuevo");
    await expect(viewer).toHaveURL(/acceso-denegado/);
    await viewerContext.close();
  });
});
