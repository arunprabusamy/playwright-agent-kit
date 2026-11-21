import { Locator, Page, expect } from "@playwright/test";

export class HomePage {
  constructor(readonly page: Page) {}

  get pliersImage(): Locator {
    return this.page.getByRole("img", { name: "Pliers", exact: true });
  }

  get homePageLink(): Locator {
    return this.page.getByRole("link", { name: "Practice Software Testing -" });
  }

  async goToHomePage(): Promise<void> {
    await this.homePageLink.click();
    await expect(this.page).toHaveTitle(
      "Practice Software Testing - Toolshop - v5.0",
    );
  }
}
