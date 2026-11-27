import { test as base, APIRequestContext } from "@playwright/test";
import fs from "fs";
import { API_AUTH_FILE } from "@constants/auth.constants";

export type ApiTestOptions = {
  apiBaseURL: string;
};

type ApiFixtures = {
  authRequest: APIRequestContext;
  unauthRequest: APIRequestContext;
};

export const test = base.extend<ApiTestOptions & ApiFixtures>({
  // Set in playwright.config.ts (or overridden per-file with test.use).
  apiBaseURL: ["", { option: true }],

  // Authenticated request fixture injecting bearer token from storage
  authRequest: async ({ playwright, apiBaseURL }, use) => {
    if (!fs.existsSync(API_AUTH_FILE)) {
      throw new Error(
        `API auth state not found at ${API_AUTH_FILE}. ` +
          `Ensure tests/auth.setup.ts has run.`,
      );
    }

    const { access_token } = JSON.parse(
      fs.readFileSync(API_AUTH_FILE, "utf-8"),
    );

    const context = await playwright.request.newContext({
      baseURL: apiBaseURL,
      extraHTTPHeaders: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    await use(context);
    await context.dispose();
  },

  unauthRequest: async ({ playwright, apiBaseURL }, use) => {
    const context = await playwright.request.newContext({
      baseURL: apiBaseURL,
      extraHTTPHeaders: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    await use(context);
    await context.dispose();
  },
});
