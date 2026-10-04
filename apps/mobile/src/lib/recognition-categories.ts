import { RECOGNITION_CATEGORY_API_VERSION, type RecognitionCategory } from "@housepoints/contracts";

// This binary understands category-aware read responses even while new awards are gated.
export const CATEGORY_READ_CAPABILITY = { categoryApiVersion: RECOGNITION_CATEGORY_API_VERSION } as const;

export function availableRecognitionCategories(categories: RecognitionCategory[] | undefined): RecognitionCategory[] {
  return (categories ?? []).filter((category) => category.archivedAt === null);
}

export function selectedRecognitionCategory(categories: RecognitionCategory[] | undefined, categoryId: string | null) {
  return categories?.find((category) => category.id === categoryId) ?? null;
}
