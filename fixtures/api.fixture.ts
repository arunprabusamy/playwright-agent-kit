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

const apiBaseURL = process.env.API_BASE_URL;
if (!apiBaseURL) {
  throw new Error("API_BASE_URL is required.");
}

export const test = base.extend<ApiTestOptions & ApiFixtures>({
  // Register apiBaseURL as a config-controllable option from the environment.
  apiBaseURL: [apiBaseURL, { option: true }],

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
