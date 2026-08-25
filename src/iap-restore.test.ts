// The remove-ads entitlement is the only product in the game that can be
// bought exactly once, and that single fact is what makes it fragile:
//
//   * It is stripped from every cloud write on purpose (cloud-save.ts
//     ENTITLEMENT_KEYS), so a reinstall starts with `adsRemoved` false.
//   * Play will not sell a non-consumable a second time — it answers
//     PRODUCT_ALREADY_PURCHASED instead.
//
// Put together, a player who paid and then reinstalled used to end up with
// ads back on, a Remove Ads button that still looked buyable, and a raw
// "Purchase failed: ..." toast when they pressed it. The store is the only
// honest source for the entitlement, and these tests pin the three ways it is
// now asked: the already-owned purchase answer, the startup check, and the
// explicit Restore button.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getOfferings = vi.fn();
const getCustomerInfo = vi.fn();
const restorePurchases = vi.fn();
const purchasePackage = vi.fn();
const configure = vi.fn(async () => undefined);

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android', isNativePlatform: () => true },
}));

vi.mock('@revenuecat/purchases-capacitor', () => ({
  Purchases: {
    configure: (...args: unknown[]) => configure(...(args as [])),
    getOfferings: () => getOfferings(),
    getCustomerInfo: () => getCustomerInfo(),
    restorePurchases: () => restorePurchases(),
    purchasePackage: (...args: unknown[]) => purchasePackage(...(args as [])),
  },
  // The two codes the purchase path distinguishes. The values match the SDK's
  // own string enum, because the code compares against it directly.
  PURCHASES_ERROR_CODE: {
    PURCHASE_CANCELLED_ERROR: '1',
    PRODUCT_ALREADY_PURCHASED_ERROR: '6',
  },
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

/**
 * The store product id is deliberately DIFFERENT from the package id here.
 * Those two strings happen to match in the live dashboard, and code that
 * assumed they always would would pass a test that used the same value twice
 * while failing on the first store that renames one of them.
 */
const REMOVE_ADS_PRODUCT = 'com.yilkgames.reefy.remove_ads';

function offeringWithRemoveAds() {
  return {
    current: {
      availablePackages: [
        { identifier: 'pearls_s', product: { identifier: 'pearls_s_product', priceString: '₺47,99', currencyCode: 'TRY' } },
        { identifier: 'remove_ads', product: { identifier: REMOVE_ADS_PRODUCT, priceString: '₺95,99', currencyCode: 'TRY' } },
      ],
    },
  };
}

function customerInfo(opts: { entitlements?: string[]; products?: string[] }) {
  return {
    customerInfo: {
      entitlements: { active: Object.fromEntries((opts.entitlements ?? []).map((e) => [e, { isActive: true }])) },
      allPurchasedProductIdentifiers: opts.products ?? [],
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  getOfferings.mockReset();
  getCustomerInfo.mockReset();
  restorePurchases.mockReset();
  purchasePackage.mockReset();
  configure.mockClear();
  getOfferings.mockResolvedValue(offeringWithRemoveAds());
});

describe('buying remove-ads a second time', () => {
  it('is treated as a restore, not as a failure', async () => {
    purchasePackage.mockRejectedValue({ code: '6', message: 'Item already owned' });

    const res = await new RevenueCatIAP('REEF-ABCDE').purchase('remove_ads');

    // The player paid before; the store just said so. Granting is the only
    // outcome that leaves them with what they own.
    expect(res.ok).toBe(true);
    expect(res.grantRemovesAds).toBe(true);
  });

  it('does NOT silently grant a consumable on the same error', async () => {
    // A pearl pack can be bought again and again, so "already purchased" here
    // is not a restore — it is an unconsumed purchase, and handing out pearls
    // for it would be free currency on every retry.
    purchasePackage.mockRejectedValue({ code: '6', message: 'Item already owned' });

    const res = await new RevenueCatIAP('REEF-ABCDE').purchase('pearls_s');

    expect(res.ok).toBe(false);
    expect(res.grantPearls).toBeUndefined();
  });

  it('still reports a cancel as a cancel', async () => {
    purchasePackage.mockRejectedValue({ code: '1', message: 'User cancelled' });

    const res = await new RevenueCatIAP('REEF-ABCDE').purchase('remove_ads');

    expect(res.ok).toBe(false);
    expect(res.grantRemovesAds).toBeUndefined();
  });
});

describe('ownsRemoveAds — the startup question', () => {
  it('says yes when the dashboard maps the product to an entitlement', async () => {
    getCustomerInfo.mockResolvedValue(customerInfo({ entitlements: ['no_ads'] }));

    expect(await new RevenueCatIAP('REEF-ABCDE').ownsRemoveAds()).toBe(true);
  });

  it('says yes from the purchased-product list when no entitlement is configured', async () => {
    // The half that does not depend on anyone having set up an entitlement in
    // the RevenueCat dashboard — the SDK fills this list in by itself.
    getCustomerInfo.mockResolvedValue(customerInfo({ products: [REMOVE_ADS_PRODUCT] }));

    expect(await new RevenueCatIAP('REEF-ABCDE').ownsRemoveAds()).toBe(true);
  });

  it('says no for an account that only ever bought pearls', async () => {
    getCustomerInfo.mockResolvedValue(customerInfo({ products: ['pearls_s_product'] }));

    expect(await new RevenueCatIAP('REEF-ABCDE').ownsRemoveAds()).toBe(false);
  });

  it('says no when the store cannot be reached, rather than throwing', async () => {
    // The caller only ever grants on true, so a false here costs nothing —
    // but an exception escaping into startup would cost the whole init.
    getCustomerInfo.mockRejectedValue(new Error('offline'));

    expect(await new RevenueCatIAP('REEF-ABCDE').ownsRemoveAds()).toBe(false);
  });

  it('still recognises ownership when the offering cannot be read', async () => {
    // No offering means no store product id, so the check falls back to the
    // pack id. An account that owns it under that id must not read as unowned
    // just because the offering request failed.
    getOfferings.mockRejectedValue(new Error('no network'));
    getCustomerInfo.mockResolvedValue(customerInfo({ products: ['remove_ads'] }));

    expect(await new RevenueCatIAP('REEF-ABCDE').ownsRemoveAds()).toBe(true);
  });
});

describe('restore — the button Google requires', () => {
  it('reports the entitlement it found', async () => {
    restorePurchases.mockResolvedValue(customerInfo({ products: [REMOVE_ADS_PRODUCT] }));

    const res = await new RevenueCatIAP('REEF-ABCDE').restore();

    expect(res.ok).toBe(true);
    expect(res.ownsRemoveAds).toBe(true);
  });

  it('answers in words when the account owns nothing', async () => {
    // A button that does nothing visible on an empty account reads as broken,
    // which is why this case is a success with a message rather than silence.
    restorePurchases.mockResolvedValue(customerInfo({}));

    const res = await new RevenueCatIAP('REEF-ABCDE').restore();

    expect(res.ok).toBe(true);
    expect(res.ownsRemoveAds).toBe(false);
    expect(res.msg).toBeTruthy();
  });

  it('reports a store failure without claiming ownership', async () => {
    restorePurchases.mockRejectedValue(new Error('store unavailable'));

    const res = await new RevenueCatIAP('REEF-ABCDE').restore();

    expect(res.ok).toBe(false);
    expect(res.ownsRemoveAds).toBe(false);
  });
});
