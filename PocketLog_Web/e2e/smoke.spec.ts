import { expect, test } from "@playwright/test";

test("private web entry renders sign in", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
});

test("versioned OpenAPI contract is available", async ({ request }) => {
  const response = await request.get("/api/v1/openapi");
  expect(response.ok()).toBeTruthy();
  const contract = await response.json();
  expect(contract.data.openapi).toBe("3.0.3");
  expect(contract.data.info.title).toBe("PocketLog API");
});
