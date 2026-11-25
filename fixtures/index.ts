import { mergeTests } from "@playwright/test";
import { test as pageTest } from "@fixtures/pages.fixture";
import { test as apiTest } from "@fixtures/api.fixture";

export const test = mergeTests(pageTest, apiTest);

export { expect } from "@playwright/test";
