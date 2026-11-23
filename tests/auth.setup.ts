import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import {
  UI_AUTH_FILE,
  API_AUTH_FILE,
  AUTH_DIR,
} from "@constants/auth.constants";

const username = process.env.USER_NAME || "";
const password = process.env.PASSWORD || "";
const apiBaseURL = process.env.API_BASE_URL || "";

setup("authenticate via UI", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByPlaceholder("Your email").fill(username);
  await page.getByPlaceholder("Your password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();

  await page.waitForURL("https://practicesoftwaretesting.com/account");
  await expect(
    page.getByRole("heading", { name: "My account", level: 1 }),
  ).toBeVisible();

  await page.context().storageState({ path: UI_AUTH_FILE });
});

setup("authenticate via API", async ({ request }) => {
  const response = await request.post(apiBaseURL + "/users/login", {
    data: {
      email: username,
      password: password,
    },
  });
  expect(response).toBeOK();
  const responseBody = await response.json();

  // Ensure storage directory exists before writing file
  fs.mkdirSync(path.dirname(AUTH_DIR), { recursive: true });
  fs.writeFileSync(
    API_AUTH_FILE,
    JSON.stringify(
      {
        access_token: responseBody.access_token,
      },
      null,
      2,
    ),
  );
});
