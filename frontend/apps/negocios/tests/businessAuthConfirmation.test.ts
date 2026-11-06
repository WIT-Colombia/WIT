import assert from "node:assert/strict";
import test from "node:test";
import { applyEmailConfirmationResult, getSessionState, type BusinessAuthUser } from "../src/services/businessAuthService";

const user: BusinessAuthUser = {
  id: "user-1",
  publicId: "public-1",
  displayName: "Business Test",
  nickname: "@business.test",
  emailNormalized: "business@example.com",
  avatarUrl: null,
  locale: "es-CO",
  status: "ACTIVE",
  emailVerified: true,
  authProviders: ["EMAIL"],
};

test("does not authenticate when verification response has autoLogin false", () => {
  const result = applyEmailConfirmationResult({ user, autoLogin: false });
  assert.equal(result.autoLogin, false);
  assert.deepEqual(getSessionState(), { status: "unauthenticated" });
});

test("authenticates only when verification response has a non-empty access token", () => {
  const result = applyEmailConfirmationResult({ user, autoLogin: true, accessToken: "access-token" });
  assert.equal(result.autoLogin, true);
  assert.deepEqual(getSessionState(), { status: "authenticated", user });
});
