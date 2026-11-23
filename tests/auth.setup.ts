import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../playwright/.auth/user.json");
const username = process.env.USER_NAME || "";
const password = process.env.PASSWORD || "";

setup("authenticate", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByPlaceholder("Your email").fill(username);
  await page.getByPlaceholder("Your password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();

  await page.waitForURL("https://practicesoftwaretesting.com/account");
  await expect(
    page.getByRole("heading", { name: "My account", level: 1 }),
  ).toBeVisible();

  await page.context().storageState({ path: authFile });
});
