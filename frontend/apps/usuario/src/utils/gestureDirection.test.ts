import { describe, expect, it } from "vitest";
import { isHorizontalDominantGesture, isMouseDragPointer } from "./gestureDirection";

describe("XAMUKO Usuario: gestures on card carousels", () => {
  it("only enables custom pointer capture for primary desktop mouse drags", () => {
    expect(isMouseDragPointer("mouse", 0)).toBe(true);
    expect(isMouseDragPointer("mouse", 1)).toBe(false);
    expect(isMouseDragPointer("mouse", 2)).toBe(false);
  });

  it("leaves iPhone, iPad, Android, and pen gestures to native scrolling", () => {
    expect(isMouseDragPointer("touch", 0)).toBe(false);
    expect(isMouseDragPointer("touch", -1)).toBe(false);
    expect(isMouseDragPointer("pen", 0)).toBe(false);
    expect(isMouseDragPointer("", 0)).toBe(false);
  });

  it("keeps horizontal drag detection without treating vertical swipes as horizontal", () => {
    expect(isHorizontalDominantGesture(60, 4)).toBe(true);
    expect(isHorizontalDominantGesture(4, 60)).toBe(false);
    expect(isHorizontalDominantGesture(0, 25)).toBe(false);
    expect(isHorizontalDominantGesture(5, 3)).toBe(false);
  });
});
