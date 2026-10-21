import { expect, test, type Page } from "@playwright/test";
import { ADMIN, login } from "./fixtures";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const NEW_PASSWORD = "Nueva-Clave-2026";

async function openProvisionDialog(page: Page, email: string, method: "invitacion" | "temporal") {
  await page.goto("/administracion/usuarios");
  await page.getByRole("button", { name: "Agregar personal" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Correo electrónico").fill(email);
  await dialog.getByLabel("Nombre completo").fill("Personal de prueba E2E");
  await dialog.getByLabel("Método de alta").selectOption(method);
  await dialog.getByRole("button", { name: "Agregar" }).click();
  return dialog;
}

async function setPassword(page: Page) {
  await expect(page).toHaveURL(/\/actualizar-contrasena/);
  await page.getByLabel("Nueva contraseña").fill(NEW_PASSWORD);
  await page.getByLabel("Confirmar contraseña").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page).toHaveURL(/\/panel/);
}

test.describe("Alta de personal autorizado", () => {
  test("invitación por correo: el enlace activa la cuenta como personal de consulta", async ({ page, browser, baseURL }) => {
    const email = `invitado.${Date.now()}@siged.test`;
    await login(page, ADMIN);
    await openProvisionDialog(page, email, "invitacion");
    await expect(page.getByText(`Invitación enviada a ${email}.`)).toBeVisible();

    // Lee el correo real entregado por Supabase Auth al servidor SMTP local.
    let html = "";
    await expect
      .poll(async () => {
        const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
        const id = list.messages?.[0]?.ID;
        if (!id) return "";
        const msg = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
        html = msg.HTML;
        expect(msg.Subject).toBe("Invitación a SIGED-INEDUC");
        return html;
      }, { timeout: 20_000 })
      .toContain("/auth/confirm?token_hash=");
    const link = /href="([^"]*\/auth\/confirm\?[^"]+)"/.exec(html)![1].replace(/&amp;/g, "&");
    const url = new URL(link);

    const ctx = await browser.newContext();
    const invited = await ctx.newPage();
    await invited.goto(`${baseURL}${url.pathname}${url.search}`);
    await setPassword(invited);
    await expect(invited.getByText("Personal de consulta").first()).toBeVisible();
    await expect(invited.getByRole("link", { name: "Administración" })).toHaveCount(0);
    await ctx.close();
  });

  test("contraseña temporal: se muestra una vez y obliga a cambiarla", async ({ page, browser }) => {
    const email = `temporal.${Date.now()}@siged.test`;
    await login(page, ADMIN);
    const dialog = await openProvisionDialog(page, email, "temporal");
    await expect(dialog.getByText("Cuenta creada")).toBeVisible();
    const temp = (await dialog.locator(".font-mono span").first().textContent())!.trim();
    expect(temp.length).toBeGreaterThanOrEqual(12);

    const ctx = await browser.newContext();
    const user = await ctx.newPage();
    await user.goto("/login");
    await user.getByLabel("Correo electrónico").fill(email);
    await user.getByLabel("Contraseña").fill(temp);
    await user.getByRole("button", { name: "Entrar" }).click();
    await expect(user).toHaveURL(/\/actualizar-contrasena\?motivo=temporal/);
    // Mientras no la cambie, cualquier ruta lo devuelve al cambio de contraseña.
    await user.goto("/salientes");
    await expect(user).toHaveURL(/\/actualizar-contrasena/);
    await setPassword(user);
    await user.goto("/salientes");
    await expect(user.getByRole("heading", { name: "Documentos salientes" })).toBeVisible();
    await ctx.close();
  });

  test("suspender una cuenta impide iniciar sesión y reactivarla lo restablece", async ({ page, browser }) => {
    const email = `suspendible.${Date.now()}@siged.test`;
    await login(page, ADMIN);
    const dialog = await openProvisionDialog(page, email, "temporal");
    const temp = (await dialog.locator(".font-mono span").first().textContent())!.trim();
    await dialog.getByRole("button", { name: "Listo" }).click();

    const row = page.getByRole("row").filter({ hasText: email });
    await row.getByRole("button", { name: "Suspender" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(row.getByText("Suspendida")).toBeVisible();

    const ctx = await browser.newContext();
    const user = await ctx.newPage();
    await user.goto("/login");
    await user.getByLabel("Correo electrónico").fill(email);
    await user.getByLabel("Contraseña").fill(temp);
    await user.getByRole("button", { name: "Entrar" }).click();
    await expect(user.getByRole("alert").filter({ hasText: "suspendida" })).toBeVisible();

    await row.getByRole("button", { name: "Reactivar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(row.getByText("Activa")).toBeVisible();
    await expect(user.getByLabel("Correo electrónico")).toHaveValue(email);
    await user.getByLabel("Contraseña").fill(temp);
    await user.getByRole("button", { name: "Entrar" }).click();
    await expect(user).toHaveURL(/\/actualizar-contrasena/);
    await ctx.close();
  });
});
