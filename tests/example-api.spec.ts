import { test, expect } from "@fixtures/index";

test("API sample test", async ({ authRequest }) => {
  const response = await authRequest.get("/users/me");
  expect(response).toBeOK();
  console.log(await response.json());
});

test("API sample test without Authentication", async ({ unauthRequest }) => {
  const response = await unauthRequest.get("/users/me");
  expect(response.status()).toBe(401);
  console.log(await response.json());
});
