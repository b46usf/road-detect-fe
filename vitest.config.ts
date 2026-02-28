import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    pool: "threads",
    maxWorkers: 1
  }
})
