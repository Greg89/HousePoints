import "server-only";

// Keep the web rollout separate from the API mutation gate until C5.
export const recognitionCategoriesWebEnabled = process.env.RECOGNITION_CATEGORIES_WEB_ENABLED === "true";
