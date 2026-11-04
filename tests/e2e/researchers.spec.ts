import { expect, test } from "@playwright/test";
import { ADMIN, VIEWER, login, unique } from "./fixtures";

// PNG válido de 60×40 píxeles (rectangular: el formulario lo recorta en cuadrado).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAADwAAAAoCAIAAAAt2Q6oAAAAS0lEQVR4nO3OQQ3AIAAAMcDEHnjDv4x52OPIklZB53n2+Jt1O/CFdEW6Il2RrkhXpCvSFemKdEW6Il2RrkhXpCvSFemKdEW6Il15AXBXAOBHsph6AAAAAElFTkSuQmCC",
  "base64",
);

test.describe("Directorio de investigadores", () => {
  test("registra un investigador con foto, aparece en el directorio y el contador aumenta", async ({ page, browser }) => {
    await login(page, ADMIN);
    await page.getByRole("link", { name: "Investigadores" }).first().click();
    await expect(page.getByRole("heading", { name: "Directorio de investigadores" })).toBeVisible();
    const counter = page.getByRole("region", { name: "Total de investigadores" }).locator("p.tabular");
    const before = Number((await counter.innerText()).replace(/\D/g, ""));

    await page.getByRole("link", { name: "Registrar investigador" }).click();
    const name = unique("Dra. Investigadora E2E");
    const code = `INV-E2E-${Date.now().toString(36).toUpperCase()}`;
    await page.getByLabel("Nombre completo").fill(name);
    await page.getByLabel("Código de investigador").fill(code);
    await page.getByText("Facultad e INEDUC", { exact: true }).click();
    await page.getByLabel("Títulos académicos").fill("Doctorado en Educación\nMaestría en Investigación Educativa\nLicenciatura en Educación");
    await page.getByLabel("Foto de perfil").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("La foto se guardará al registrar.")).toBeVisible();
    await page.getByRole("button", { name: "Registrar investigador" }).click();

    await expect(page).toHaveURL(/\/investigadores$/);
    await expect(counter).toHaveText(String(before + 1));
    await page.locator("#r-q").fill(code);
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    const card = page.getByRole("article", { name });
    await expect(card).toBeVisible();
    await expect(card.getByText(code)).toBeVisible();
    await expect(card.getByText(/Doctorado en Educación · Maestría en Investigación Educativa · y 1 más/)).toBeVisible();
    await expect(card.getByText("Facultad e INEDUC")).toBeVisible();
    const src = await card.locator("img").getAttribute("src");
    expect(src).toMatch(/\/storage\/v1\/object\/sign\/investigadores\//);

    // Código duplicado.
    await page.goto("/investigadores/nuevo");
    await page.getByLabel("Nombre completo").fill("Otro investigador E2E");
    await page.getByLabel("Código de investigador").fill(code.toLowerCase());
    await page.getByRole("button", { name: "Registrar investigador" }).click();
    await expect(page.getByText("Ya existe un investigador con ese código.").first()).toBeVisible();

    // Personal de consulta: solo visualiza.
    const ctx = await browser.newContext();
    const viewer = await ctx.newPage();
    await login(viewer, VIEWER);
    await viewer.goto(`/investigadores?q=${encodeURIComponent(code)}`);
    await expect(viewer.getByRole("article", { name })).toBeVisible();
    await expect(viewer.getByRole("link", { name: "Registrar investigador" })).toHaveCount(0);
    await expect(viewer.getByRole("link", { name: `Editar a ${name}` })).toHaveCount(0);
    await viewer.goto("/investigadores/nuevo");
    await expect(viewer).toHaveURL(/acceso-denegado/);
    await ctx.close();
  });
});
