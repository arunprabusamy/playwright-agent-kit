import { expect, Locator, Page } from "@playwright/test";

export class ContactPage {
  constructor(readonly page: Page) {}

  get firstNameInput(): Locator {
    return this.page.getByPlaceholder("Your first name *");
  }

  get contactLink(): Locator {
    return this.page.getByRole("link", { name: "Contact" });
  }

  get contactHeading(): Locator {
    return this.page.getByRole("heading", { name: "Contact", level: 3 });
  }

  get sendButton(): Locator {
    return this.page.getByRole("button", { name: "Send" });
  }

  async goto(): Promise<void> {
    await this.page.goto("/contact");
    await expect(this.contactHeading).toBeVisible();
  }

  async goToContactPage(): Promise<void> {
    await this.contactLink.click();
    await expect(this.contactHeading).toBeVisible();
  }
}
