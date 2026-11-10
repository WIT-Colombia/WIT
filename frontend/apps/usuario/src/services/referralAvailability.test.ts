import { afterEach, describe, expect, it, vi } from "vitest";
import { isBusinessReferralRegistrationAvailable } from "./authService";

afterEach(() => vi.unstubAllGlobals());

describe("business referral registration deploy compatibility", () => {
  it("accepts referral signup only when the running backend explicitly supports it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ enabled: true }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await isBusinessReferralRegistrationAvailable()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/v1/auth/referrals/availability"), expect.objectContaining({ cache: "no-store" }));
  });
  it("does not submit referral code to an old backend (404)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    expect(await isBusinessReferralRegistrationAvailable()).toBe(false);
  });
  it("does not claim attribution on network failures or malformed server responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await isBusinessReferralRegistrationAvailable()).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ enabled: false }) }));
    expect(await isBusinessReferralRegistrationAvailable()).toBe(false);
  });
});
