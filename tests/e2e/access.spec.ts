import { expect, test } from "@playwright/test";
import { VIEWER, login } from "./fixtures";

test.describe("Acceso y permisos", () => {
  test("un visitante no autenticado es redirigido al inicio de sesión", async ({ page, request }) => {
    for (const path of ["/panel", "/salientes", "/documentos/00000000-0000-0000-0000-000000000000", "/administracion"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    const exportRes = await request.get("/api/reportes?tipo=salientes&formato=csv", { maxRedirects: 0 });
    expect([302, 307, 401]).toContain(exportRes.status());
  });

  test("el manual de usuario se abre desde el inicio de sesión sin autenticarse", async ({ page }) => {
    await page.goto("/login");
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("link", { name: "MANUAL DE USUARIO PLATAFORMA" }).click();
    const manual = await popupPromise;
    await expect(manual).toHaveURL(/\/manual-usuario\.html$/);
    await expect(manual.getByRole("heading", { level: 1 })).toContainText("Seguimiento documental");
  });

  test("muestra un error en español con credenciales incorrectas", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(VIEWER);
    await page.getByLabel("Contraseña").fill("incorrecta-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Correo o contraseña incorrectos" })).toBeVisible();
  });

  test("el personal de consulta solo visualiza", async ({ page }) => {
    await login(page, VIEWER);
    await expect(page.getByRole("link", { name: "Administración" })).toHaveCount(0);
    await page.goto("/salientes");
    await expect(page.getByRole("heading", { name: "Documentos salientes" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Registrar saliente/ })).toHaveCount(0);
    await page.goto("/salientes/nuevo");
    await expect(page.getByRole("heading", { name: "Acceso no autorizado" })).toBeVisible();
    await page.goto("/administracion/usuarios");
    await expect(page.getByRole("heading", { name: "Acceso no autorizado" })).toBeVisible();
  });

  test("la recuperación de contraseña no revela si la cuenta existe", async ({ page }) => {
    await page.goto("/recuperar");
    await page.getByLabel("Correo electrónico").fill("no-existe@siged.test");
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(page.getByText(/Si el correo corresponde a una cuenta autorizada/)).toBeVisible();
  });
});
