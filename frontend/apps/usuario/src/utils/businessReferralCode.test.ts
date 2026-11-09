import { describe, expect, it } from "vitest";
import { businessReferralCode, isValidBusinessReferralCode } from "./businessReferralCode";

describe("referral invitations from business profiles", () => {
  it("derives a stable unique public business referral code", () => {
    const code = businessReferralCode("12345678-1234-4123-8123-123456789abc");
    expect(code).toBe("XMK-12345678123441238123123456789ABC");
    expect(isValidBusinessReferralCode(code!)).toBe(true);
    expect(businessReferralCode("12345678-1234-4123-8123-123456789abd")).not.toBe(code);
  });
  it("ignores demo IDs and malformed user-entered referral codes", () => {
    expect(businessReferralCode("demo")).toBeNull();
    expect(isValidBusinessReferralCode("invalid")).toBe(false);
    expect(isValidBusinessReferralCode("XMK-123")).toBe(false);
    expect(isValidBusinessReferralCode("xmk-12345678123441238123123456789abc")).toBe(true);
  });
});
