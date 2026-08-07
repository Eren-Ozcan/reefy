import { defineConfig } from 'vitest/config';

// jsdom: sınanan modüller (save.ts, cloud-save.ts) localStorage ve navigator'a
// doğrudan bakıyor — bunları elle taklit etmek yerine gerçek bir tarayıcı
// ortamı verilir, testler arasında beforeEach ile temizlenir.
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
