import { defineConfig } from "@playwright/test";

// Run with `npm run test:e2e` (starts the Firestore emulator and the app). To use a browser that is already installed,
// set PW_CHROMIUM to its path.
const port = Number(process.env.E2E_PORT ?? 3110);
const llmPort = Number(process.env.FAKE_LLM_PORT ?? 3199);

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    baseURL: `http://localhost:${port}`,
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: [
    { command: "node e2e/fake-llm.mjs", url: `http://127.0.0.1:${llmPort}/`, reuseExistingServer: true, timeout: 20_000, gracefulShutdown: { signal: "SIGTERM", timeout: 2000 } },
    {
      command: `npx next dev -p ${port}`,
      url: `http://localhost:${port}/signin`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        SESSION_SECRET: "e2e-only-secret",
        FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080",
        OPENROUTER_API_KEY: "fake", OPENROUTER_MODEL: "fake", OPENROUTER_BASE_URL: `http://127.0.0.1:${llmPort}`,
      },
    },
  ],
});
