import { Locator, Page, expect } from "@playwright/test";

export class HomePage {
  constructor(readonly page: Page) {}

  get pliersImage(): Locator {
    return this.page.getByRole("img", { name: "Pliers", exact: true });
  }
}
