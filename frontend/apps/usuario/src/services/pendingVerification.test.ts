import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPendingVerification, rememberPendingVerificationEmail } from "./pendingVerification";

const KEY = "xamuko-usuario-pending-verification-email";

describe("Pending email verification storage", () => {
  const data = new Map<string, string>();

  beforeEach(() => {
    data.clear();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, value); },
        removeItem: (key: string) => { data.delete(key); },
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("restores only the email and its expiry from JSON, not the whole JSON string", () => {
    const expiresAt = "2026-11-09T03:53:44.087Z";
    rememberPendingVerificationEmail("danilo.jaramillo@hotmail.com", expiresAt, true);
    expect(getPendingVerification()).toEqual({
      email: "danilo.jaramillo@hotmail.com",
      expiresAt,
      emailSent: true,
    });
  });

  it("preserves the initial delivery status for a serialized record", () => {
    rememberPendingVerificationEmail("usuario@example.com", undefined, false);
    expect(getPendingVerification()).toEqual({
      email: "usuario@example.com",
      expiresAt: null,
      emailSent: false,
    });
  });

  it("accepts the legacy plain-email storage format", () => {
    data.set(KEY, "antiguo@example.com");
    expect(getPendingVerification()).toEqual({
      email: "antiguo@example.com",
      expiresAt: null,
      emailSent: true,
    });
  });

  it("does not expose a malformed JSON record as an email address", () => {
    data.set(KEY, '{"email":"persona@example.com","expiresAt":');
    expect(getPendingVerification()).toEqual({ email: "", expiresAt: null, emailSent: false });
  });
});
