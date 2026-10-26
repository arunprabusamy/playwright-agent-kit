import { test as base, Page } from "@playwright/test";

type pageFixtures = {
  homePage: String;
  formsPage: Page;
  tablePage: Page;
};

export const test = base.extend<pageFixtures>({
  homePage: async ({}, use) => {
    use("hello World");
  }
});

export { expect } from "@playwright/test";
