import { test } from "@fixtures/api.fixture";
import { expect } from "@playwright/test";

test("API sample test", async ({ authRequest }) => {
  const response = await authRequest.get("/users/me");
  expect(response).toBeOK();
  console.log(await response.json());
});

test("API sample test without Authentication", async ({ request }) => {
  const response = await request.get(
    "https://api.practicesoftwaretesting.com/users/me",
  );
  expect(response).toBeOK();
  console.log(await response.json());
});
