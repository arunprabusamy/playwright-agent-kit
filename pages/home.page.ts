import { Locator, Page, expect } from "@playwright/test";

export class HomePage {
  constructor(private page: Page) {}

  get pliersImage(): Locator {
    return this.page.getByRole("img", { name: "Pliers", exact: true });
  }

  // async checkTitle(): Promise<void>{
  //   await this.page
  // }
}
