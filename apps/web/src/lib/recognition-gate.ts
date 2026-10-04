import "server-only";

// Enable web controls independently from the API mutation gate.
export const recognitionCategoriesWebEnabled = process.env.RECOGNITION_CATEGORIES_WEB_ENABLED === "true";
