import { describe, expect, it } from "vitest";
import type { RecognitionCategory } from "@housepoints/contracts";
import { availableRecognitionCategories, CATEGORY_READ_CAPABILITY, selectedRecognitionCategory } from "./recognition-categories";

const category = (id: string, archivedAt: string | null = null): RecognitionCategory => ({
  id,
  name: "Community Impact",
  description: null,
  legacyTrait: null,
  createdAt: "2026-09-20T12:00:00.000Z",
  archivedAt,
});

describe("mobile recognition categories", () => {
  it("declares read support even while category awards are gated", () => {
    expect(CATEGORY_READ_CAPABILITY).toEqual({ categoryApiVersion: "categories-v1" });
  });

  it("excludes archived categories from selection while retaining their historical identity", () => {
    const archived = category("old", "2026-09-21T12:00:00.000Z");
    const replacement = category("new");
    const all = [archived, replacement];
    expect(availableRecognitionCategories(all)).toEqual([replacement]);
    expect(selectedRecognitionCategory(all, "old")).toEqual(archived);
    expect(selectedRecognitionCategory(all, "unknown")).toBeNull();
  });
});
