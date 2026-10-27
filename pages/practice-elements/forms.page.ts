import { Locator, Page, expect } from "@playwright/test";

export class FormsPage {
  constructor(private page: Page) {}

  get fullNameInput(): Locator {
    return this.page.getByLabel("Full name");
  }
}
