import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@/": `${path.resolve(__dirname, "src")}/`,
      "@housepoints/contracts": path.resolve(
        __dirname,
        "../../packages/contracts/src/index.ts",
      ),
      "server-only": path.resolve(__dirname, "src/test/server-only.ts"),
    },
  },
});
