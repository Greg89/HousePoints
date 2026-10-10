import { POINT_REACTION_KEYS, POINT_REACTION_LABELS } from "@housepoints/contracts";
import { Children, isValidElement, type ReactNode, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Modal: "Modal", Pressable: "Pressable", Text: "Text", View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("@/lib/activity-reactions", async () => import("../lib/activity-reactions"));
import { ActivityActionsModal } from "./ActivityActionsModal";

type Props = { children?: ReactNode; accessibilityLabel?: string; disabled?: boolean; onPress?: () => void };
function elements(node: ReactNode): ReactElement<Props>[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<Props>(child)) return [];
    return [child, ...elements(child.props.children)];
  });
}
function render(overrides: Partial<Parameters<typeof ActivityActionsModal>[0]> = {}) {
  const props = {
    visible: true, canReact: true, selected: null, pending: false,
    onSelect: vi.fn(), onReport: vi.fn(), onClose: vi.fn(), ...overrides,
  };
  return { props, nodes: elements(ActivityActionsModal(props)) };
}
describe("activity actions sheet", () => {
  it("lists reactions before Report and selects a reaction", () => {
    const { props, nodes } = render();
    const reactions = nodes.filter(n => n.props.accessibilityLabel?.startsWith("React with "));
    expect(reactions).toHaveLength(POINT_REACTION_KEYS.length);
    reactions[0].props.onPress?.();
    expect(props.onSelect).toHaveBeenCalledOnce();
    const report = nodes.find(n => Children.toArray(n.props.children).includes("⚑ Report activity"));
    expect(nodes.indexOf(report!)).toBeGreaterThan(nodes.indexOf(reactions.at(-1)!));
  });
  it("offers Report without reactions on deductions", () => {
    const { props, nodes } = render({ canReact: false });
    expect(nodes.some(n => n.props.accessibilityLabel?.startsWith("React with "))).toBe(false);
    const report = nodes.find(n => Children.toArray(n.props.children).some(c => isValidElement<Props>(c) && c.props.children === "⚑ Report activity") && n.props.onPress);
    report?.props.onPress?.();
    expect(props.onReport).toHaveBeenCalledOnce();
  });
  it("labels the current reaction for removal and disables reactions while saving", () => {
    const { nodes } = render({ selected: "heart", pending: true });
    expect(nodes.find(n => n.props.accessibilityLabel === `Remove ${POINT_REACTION_LABELS.heart} reaction`)?.props.disabled).toBe(true);
    expect(nodes.filter(n => n.props.accessibilityLabel).every(n => n.props.disabled)).toBe(true);
  });
});
