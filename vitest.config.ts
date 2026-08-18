import { defineConfig } from 'vitest/config';

// jsdom: the modules under test (save.ts, cloud-save.ts, i18n.ts) read
// localStorage and navigator directly. Rather than hand-mocking those, they
// get a real browser environment, cleared between tests with beforeEach.
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
