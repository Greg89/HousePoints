import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ OS: "ios" }));
vi.mock("react-native", () => ({
  Modal: "Modal",
  View: "View",
  Platform: platform,
  StyleSheet: { absoluteFill: { position: "absolute" } },
}));

import { AwardPickerDialog } from "./AwardPickerDialog";

describe("award picker presentation", () => {
  beforeEach(() => { platform.OS = "ios"; });

  it("opens inside the iOS award sheet and supports the VoiceOver escape gesture", () => {
    const onClose = vi.fn();
    const dialog = AwardPickerDialog({ visible: true, onClose, children: "Recipients" });
    expect(dialog?.type).toBe("View");
    expect(dialog?.props.accessibilityViewIsModal).toBe(true);
    expect(dialog?.props.children).toBe("Recipients");
    dialog?.props.onAccessibilityEscape();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("removes the iOS overlay on close so the form receives touches again", () => {
    expect(AwardPickerDialog({ visible: false, onClose: vi.fn(), children: "Recipients" })).toBeNull();
  });

  it("preserves native Android presentation and hardware-back dismissal", () => {
    platform.OS = "android";
    const onClose = vi.fn();
    const dialog = AwardPickerDialog({ visible: true, onClose, children: "Traits" });
    expect(dialog?.type).toBe("Modal");
    expect(dialog?.props.visible).toBe(true);
    expect(dialog?.props.transparent).toBe(true);
    dialog?.props.onRequestClose();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
