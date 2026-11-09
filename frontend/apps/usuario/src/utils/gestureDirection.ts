export function isHorizontalDominantGesture(deltaX: number, deltaY: number, threshold = 6): boolean {
  return Math.abs(deltaX) > threshold && Math.abs(deltaX) > Math.abs(deltaY);
}

/**
 * Touch/pen gestures belong to the browser: iOS and Android must be able to
 * distinguish vertical page scrolling from native horizontal carousel scroll.
 * The custom pointer-capture drag handlers are only for desktop left-click.
 */
export function isMouseDragPointer(pointerType: string, button: number): boolean {
  return pointerType === "mouse" && button === 0;
}
