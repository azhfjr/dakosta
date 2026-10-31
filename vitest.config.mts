import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const resolveFromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // `server-only` is a React Server Component guard; unit tests run in Node.
      { find: "server-only", replacement: resolveFromRoot("./tests/stubs/server-only.ts") },
      { find: /^@\/(.*)$/, replacement: resolveFromRoot("./src/$1") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
  },
});
