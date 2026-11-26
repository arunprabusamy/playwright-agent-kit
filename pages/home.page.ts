import { Locator, Page, expect } from "@playwright/test";

export class HomePage {
  // Prefix match so version bumps in the title (e.g. v5.0) do not break tests.
  static readonly TITLE_PATTERN = /^Practice Software Testing - Toolshop/;

  constructor(readonly page: Page) {}

  get pliersImage(): Locator {
    return this.page.getByRole("img", { name: "Pliers", exact: true });
  }

  get homePageLink(): Locator {
    return this.page.getByRole("link", { name: "Practice Software Testing -" });
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
    await expect(this.page).toHaveTitle(HomePage.TITLE_PATTERN);
  }

  async goToHomePage(): Promise<void> {
    await this.homePageLink.click();
    await expect(this.page).toHaveTitle(HomePage.TITLE_PATTERN);
  }
}
