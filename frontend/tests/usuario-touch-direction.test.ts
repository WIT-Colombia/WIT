import { describe, expect, it } from "vitest";
import { isHorizontalDominantGesture } from "../apps/usuario/src/utils/gestureDirection";

describe("horizontal carousel gesture direction", () => {
  it("captures only a clearly horizontal gesture", () => {
    expect(isHorizontalDominantGesture(24, 4)).toBe(true);
    expect(isHorizontalDominantGesture(24, 30)).toBe(false);
    expect(isHorizontalDominantGesture(4, 24)).toBe(false);
    expect(isHorizontalDominantGesture(0, 40)).toBe(false);
  });
});
