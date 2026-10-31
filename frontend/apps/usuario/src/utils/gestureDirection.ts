export function isHorizontalDominantGesture(deltaX: number, deltaY: number, threshold = 6): boolean {
  return Math.abs(deltaX) > threshold && Math.abs(deltaX) > Math.abs(deltaY);
}
