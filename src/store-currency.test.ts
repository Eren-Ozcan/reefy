// The store-currency signal, which is the strongest input to the language guess
// (see i18n.ts detectLang). Its two halves were both untested: i18n.test.ts
// covers what happens once a currency has been recorded, but nothing checked
// that loadPrices() ever records one.
//
// That gap mattered more than it looks. `currencyCode` is read off a
// RevenueCat product, and a wrong field name would typecheck against `any`-ish
// SDK surfaces and then silently do nothing on a real device — the branch would
// look implemented and never fire. So the mock below deliberately mirrors the
// SDK's own shape: `product.currencyCode`, a non-optional string on
// PurchasesStoreProduct.
//
// What this still does NOT prove is that Google Play populates that field for
// this app's products. That needs a real store account and stays on the list.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getOfferings = vi.fn();
const configure = vi.fn(async () => undefined);

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android', isNativePlatform: () => true },
}));

vi.mock('@revenuecat/purchases-capacitor', () => ({
  Purchases: {
    configure: (...args: unknown[]) => configure(...(args as [])),
    getOfferings: () => getOfferings(),
  },
  PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: 'cancelled' },
}));

vi.mock('capacitor-game-connect-8', () => ({ CapacitorGameConnect: {} }));
vi.mock('./firebase-app', () => ({ ensureUid: async () => 'uid-1', firestore: () => ({}) }));
vi.mock('firebase/firestore', () => ({
  deleteDoc: async () => undefined,
  doc: () => ({}),
  getDoc: async () => ({ exists: () => false, data: () => ({}) }),
  setDoc: async () => undefined,
  serverTimestamp: () => ({}),
}));

const { RevenueCatIAP } = await import('./services');
const { STORE_CURRENCY_KEY, detectLang } = await import('./i18n');

/** One package shaped the way the RevenueCat SDK shapes it. */
function pkg(identifier: string, priceString: string, currencyCode: string) {
  return { identifier, product: { priceString, currencyCode } };
}

function offering(packages: ReturnType<typeof pkg>[]) {
  return { current: { availablePackages: packages } };
}

beforeEach(() => {
  localStorage.clear();
  getOfferings.mockReset();
  configure.mockClear();
});

describe('loadPrices', () => {
  it('records the billing currency the store reported', async () => {
    getOfferings.mockResolvedValue(offering([pkg('pearls_s', '₺39,99', 'TRY')]));

    await new RevenueCatIAP('REEF-ABCDE').loadPrices();

    expect(localStorage.getItem(STORE_CURRENCY_KEY)).toBe('TRY');
  });

  it('still takes the localized price, which was the original job', async () => {
    getOfferings.mockResolvedValue(offering([pkg('pearls_s', '₺39,99', 'TRY')]));

    const iap = new RevenueCatIAP('REEF-ABCDE');
    await iap.loadPrices();

    expect(iap.packs().find((p) => p.id === 'pearls_s')?.priceLabel).toBe('₺39,99');
  });

  it('records nothing when the store cannot be reached', async () => {
    getOfferings.mockRejectedValue(new Error('offline'));

    await new RevenueCatIAP('REEF-ABCDE').loadPrices();

    // Recording a guess here would be worse than recording nothing: the guess
    // outranks the device language on the next launch.
    expect(localStorage.getItem(STORE_CURRENCY_KEY)).toBeNull();
  });

  it('records nothing when there is no current offering', async () => {
    getOfferings.mockResolvedValue({ current: null });

    await new RevenueCatIAP('REEF-ABCDE').loadPrices();

    expect(localStorage.getItem(STORE_CURRENCY_KEY)).toBeNull();
  });

  it('survives a product with no currency on it', async () => {
    getOfferings.mockResolvedValue(offering([
      { identifier: 'pearls_s', product: { priceString: '$2.99' } } as ReturnType<typeof pkg>,
    ]));

    await new RevenueCatIAP('REEF-ABCDE').loadPrices();

    expect(localStorage.getItem(STORE_CURRENCY_KEY)).toBeNull();
  });
});

describe('the currency reaching the language guess', () => {
  const withLanguages = (tags: string[], fn: () => void) => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'languages');
    Object.defineProperty(navigator, 'languages', { value: tags, configurable: true });
    try {
      fn();
    } finally {
      if (original) Object.defineProperty(navigator, 'languages', original);
      else Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'languages');
    }
  };

  it('turns a Turkish store account on an English phone into Turkish', async () => {
    getOfferings.mockResolvedValue(offering([pkg('pearls_s', '₺39,99', 'TRY')]));
    await new RevenueCatIAP('REEF-ABCDE').loadPrices();

    // detectLang() reads what the PREVIOUS launch recorded, which is what the
    // localStorage value now stands for.
    withLanguages(['en-US'], () => expect(detectLang()).toBe('tr'));
  });

  it('turns a German store account on a Turkish phone into English', async () => {
    getOfferings.mockResolvedValue(offering([pkg('pearls_s', '3,99 €', 'EUR')]));
    await new RevenueCatIAP('REEF-ABCDE').loadPrices();

    withLanguages(['tr-TR'], () => expect(detectLang()).toBe('en'));
  });

  it('leaves a store that never answered to the device language', async () => {
    getOfferings.mockRejectedValue(new Error('offline'));
    await new RevenueCatIAP('REEF-ABCDE').loadPrices();

    withLanguages(['tr-TR'], () => expect(detectLang()).toBe('tr'));
    withLanguages(['de-DE'], () => expect(detectLang()).toBe('en'));
  });
});
