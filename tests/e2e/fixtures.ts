import { expect, type Page } from "@playwright/test";

export const E2E_PASSWORD = "E2e-Prueba-2026";
export const ADMIN = "admin.e2e@siged.test";
export const VIEWER = "consulta.e2e@siged.test";

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/panel/);
}

export function unique(label: string) {
  return `${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
