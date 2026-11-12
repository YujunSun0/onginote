import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 단위 테스트: 외부 서비스(DB, AI, 결제) 없이 src/lib 의 계산만 확인한다. 통합 테스트는 tests/integration (npm run test:integration).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
