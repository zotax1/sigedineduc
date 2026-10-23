import { expect, test, type Page } from "@playwright/test";
import { ADMIN, VIEWER, login, unique } from "./fixtures";

async function registerOutgoing(page: Page, subject: string, options: { restricted?: boolean } = {}) {
  await page.goto("/salientes/nuevo");
  await expect(page.getByText("Ruta institucional obligatoria")).toBeVisible();
  await page.getByLabel("Número de oficio").fill(`E2E-${Date.now()}`);
  await page.getByLabel("Asunto").fill(subject);
  await page.getByLabel("Destinatario", { exact: true }).fill("Destinatario de prueba");
  if (options.restricted) await page.getByLabel("Nivel de visibilidad").selectOption("RESTRINGIDO");
  await page.getByRole("button", { name: "Registrar documento" }).click();
  await expect(page).toHaveURL(/\/documentos\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop()!;
}

test.describe("Ruta obligatoria de documentos salientes (interfaz)", () => {
  test("registra en INEDUC y solo ofrece remitir a la Dirección de Investigación", async ({ page }) => {
    await login(page, ADMIN);
    const subject = unique("Oficio E2E ruta");
    await registerOutgoing(page, subject);

    await expect(page.getByRole("heading", { name: subject })).toBeVisible();
    const actions = page.locator("aside");
    await expect(actions.getByRole("button", { name: "Remitido a la Dirección de Investigación" })).toBeVisible();
    await expect(actions.getByRole("button", { name: /Decanato/ })).toHaveCount(0);
    await expect(page.getByText("Director: Dr. Máximo Díaz").first()).toBeVisible();

    // Paso 1: remitir con vista previa y confirmación.
    await actions.getByRole("button", { name: "Remitido a la Dirección de Investigación" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Vista previa")).toBeVisible();
    await dialog.getByLabel("Observaciones del movimiento").fill("Entregado en ventanilla (prueba)");
    await dialog.getByRole("button", { name: "Confirmar movimiento" }).click();
    await expect(page.getByText("Esperando registro de recepción")).toBeVisible();

    // Aún no se ofrece remitir al Decanato: falta registrar la recepción.
    await expect(actions.getByRole("button", { name: /Remitido desde la Dirección/ })).toHaveCount(0);
    await actions.getByRole("button", { name: "Recepción registrada en la Dirección de Investigación" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar movimiento" }).click();
    await expect(actions.getByRole("button", { name: "Remitido desde la Dirección de Investigación al Decanato" })).toBeVisible();

    // El historial conserva los movimientos con el usuario que los registró.
    const history = page.getByRole("heading", { name: "Historial de movimientos" }).locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
    await expect(history.getByText("Remitido a la Dirección de Investigación").first()).toBeVisible();
    await expect(history.getByText("Entregado en ventanilla (prueba)")).toBeVisible();
    await expect(history.getByText(/Administración E2E/).first()).toBeVisible();
  });

  test("valida campos obligatorios y conserva lo escrito", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/entrantes/nuevo");
    await page.getByLabel("Remitente", { exact: true }).fill("Remitente conservado");
    await page.getByRole("button", { name: "Registrar documento" }).click();
    await expect(page.getByText("Escriba el asunto (mínimo 3 caracteres).")).toBeVisible();
    await expect(page.getByLabel("Remitente", { exact: true })).toHaveValue("Remitente conservado");
  });

  test("las actualizaciones llegan en tiempo real al personal de consulta", async ({ browser }) => {
    const viewerCtx = await browser.newContext();
    const viewer = await viewerCtx.newPage();
    await login(viewer, VIEWER);
    await viewer.goto("/salientes");
    await expect(viewer.getByRole("button", { name: "En vivo" })).toBeVisible({ timeout: 30_000 });

    const adminCtx = await browser.newContext();
    const admin = await adminCtx.newPage();
    await login(admin, ADMIN);
    const subject = unique("Tiempo real E2E");
    await registerOutgoing(admin, subject);

    // Sin recargar la página del personal de consulta.
    await expect(viewer.locator("table").getByText(subject)).toBeVisible({ timeout: 30_000 });

    // Un documento restringido no aparece para el personal de consulta.
    const secret = unique("Restringido E2E");
    await registerOutgoing(admin, secret, { restricted: true });
    await viewer.waitForTimeout(4000);
    await expect(viewer.getByText(secret)).toHaveCount(0);

    await viewerCtx.close();
    await adminCtx.close();
  });
});
