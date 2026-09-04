import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "integration",
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    exclude: ["node_modules", "dist"],
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
