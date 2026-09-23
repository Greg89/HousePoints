import { describe, expect, it } from "vitest";
import { focusedInputScrollOffset } from "./focused-input-scroll";

describe("focused input visibility", () => {
  const viewport = { offset: 0, viewportTop: 100, viewportHeight: 300 };

  it("reveals the points input below the resized viewport", () => {
    expect(focusedInputScrollOffset({ ...viewport, inputTop: 360, inputHeight: 52 })).toBe(24);
  });

  it("reveals the entire reason without jumping to the end of the form", () => {
    expect(focusedInputScrollOffset({ ...viewport, inputTop: 420, inputHeight: 96 })).toBe(128);
  });

  it("does not move an already-visible input", () => {
    expect(focusedInputScrollOffset({ ...viewport, offset: 24, inputTop: 336, inputHeight: 52 })).toBe(24);
  });

  it("scrolls back up when switching from reason to points", () => {
    expect(focusedInputScrollOffset({ ...viewport, offset: 200, inputTop: 70, inputHeight: 52 })).toBe(158);
  });

  it("does not scroll further when the viewport expands after dismissal", () => {
    expect(focusedInputScrollOffset({ ...viewport, viewportHeight: 700, offset: 24, inputTop: 336, inputHeight: 52 })).toBe(24);
  });

  it("aligns an oversized multiline input to the top and never scrolls negative", () => {
    expect(focusedInputScrollOffset({ ...viewport, inputTop: 140, inputHeight: 400 })).toBe(28);
    expect(focusedInputScrollOffset({ ...viewport, inputTop: 100, inputHeight: 52 })).toBe(0);
  });
});
