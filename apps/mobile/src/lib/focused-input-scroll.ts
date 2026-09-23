/** Scroll only enough to reveal an input inside the form, above its footer. */
export function focusedInputScrollOffset({
  offset,
  viewportTop,
  viewportHeight,
  inputTop,
  inputHeight,
}: {
  offset: number;
  viewportTop: number;
  viewportHeight: number;
  inputTop: number;
  inputHeight: number;
}): number {
  const spacing = 12;
  const top = viewportTop + spacing;
  const bottom = viewportTop + viewportHeight - spacing;
  if (inputTop < top || inputHeight > bottom - top) {
    return Math.max(0, offset + inputTop - top);
  }
  if (inputTop + inputHeight > bottom) {
    return Math.max(0, offset + inputTop + inputHeight - bottom);
  }
  return offset;
}
