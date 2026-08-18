// Two things are pinned here, and they fail in opposite directions.
//
// 1. COMPLETENESS. A missing translation does not throw — t() falls back to the
//    English key — so Turkish comes back with holes silently, one string at a
//    time, as new features land. The dictionary is therefore checked against
//    the keys the code actually asks for, read from the source files.
//
// 2. THE LANGUAGE GUESS. Turkish is only chosen on positive evidence, and the
//    asymmetry matters: guessing English wrong is survivable, guessing Turkish
//    wrong strands a player in a language they cannot read.

import { beforeEach, describe, expect, it } from 'vitest';
import { AVAILABLE_LANGS, STORE_CURRENCY_KEY, detectLang, rememberStoreCurrency, t } from './i18n';

// Sources are pulled in through Vite's raw glob rather than node:fs, so the
// test needs no Node type globals — the app's tsconfig deliberately exposes
// browser types only, and a test should not be the reason that slips.
const RAW = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const SOURCES = [
  './ui.ts', './game.ts', './services.ts',
  './main.ts', './ads.ts', './cloud-save.ts', './firebase-app.ts',
];

/** Every literal passed to t()/tt() in the shipped source. */
function keysUsedInCode(): Set<string> {
  const found = new Set<string>();
  const call = /\btt?\(\s*(['"])((?:\\.|(?!\1).)*?)\1/g;
  for (const file of SOURCES) {
    const src = RAW[file];
    if (src === undefined) throw new Error(`source not found in the raw glob: ${file}`);
    let m: RegExpExecArray | null;
    while ((m = call.exec(src))) {
      found.add(m[2].replace(/\\'/g, "'").replace(/\\"/g, '"'));
    }
  }
  return found;
}

/** Every key defined in the TR dictionary. */
function keysInDictionary(): Set<string> {
  const src = RAW['./i18n.ts'];
  const body = src.slice(src.indexOf('const TR: Record<string, string> = {'));
  const entry = /(['"])((?:\\.|(?!\1).)*?)\1\s*:/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = entry.exec(body))) {
    found.add(m[2].replace(/\\'/g, "'").replace(/\\"/g, '"'));
  }
  return found;
}

describe('Turkish dictionary completeness', () => {
  it('translates every string the code asks for', () => {
    const dict = keysInDictionary();
    const missing = [...keysUsedInCode()].filter((k) => !dict.has(k)).sort();
    // Named in the failure so the fix is "add these lines", not "go find them".
    expect(missing).toEqual([]);
  });

  it('reads a non-trivial number of keys — a broken regex must not pass as success', () => {
    expect(keysUsedInCode().size).toBeGreaterThan(200);
    expect(keysInDictionary().size).toBeGreaterThan(200);
  });
});

describe('shipped languages', () => {
  it('offers both English and Turkish', () => {
    expect([...AVAILABLE_LANGS].sort()).toEqual(['en', 'tr']);
  });

  it('falls back to the English key when a translation is absent', () => {
    expect(t('a string nobody has translated')).toBe('a string nobody has translated');
  });
});

describe('language guess', () => {
  beforeEach(() => {
    localStorage.clear();
  });

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

  it('picks Turkish for a Turkish device language', () => {
    withLanguages(['tr-TR', 'en-US'], () => expect(detectLang()).toBe('tr'));
  });

  it('picks Turkish for an English phone used in Turkey', () => {
    withLanguages(['en-TR'], () => expect(detectLang()).toBe('tr'));
  });

  it('picks English for anything with no Turkish signal at all', () => {
    withLanguages(['de-DE', 'fr-FR'], () => expect(detectLang()).toBe('en'));
  });

  it('lets a lira-billed store account override an English device', () => {
    rememberStoreCurrency('TRY');
    withLanguages(['en-US'], () => expect(detectLang()).toBe('tr'));
  });

  it('lets a euro-billed store account override a Turkish device', () => {
    rememberStoreCurrency('EUR');
    withLanguages(['tr-TR'], () => expect(detectLang()).toBe('en'));
  });

  it('stores the currency in upper case, so a lower-case code still matches', () => {
    rememberStoreCurrency('try');
    expect(localStorage.getItem(STORE_CURRENCY_KEY)).toBe('TRY');
    withLanguages(['en-US'], () => expect(detectLang()).toBe('tr'));
  });

  it('ignores an empty currency rather than recording it as evidence', () => {
    rememberStoreCurrency('');
    expect(localStorage.getItem(STORE_CURRENCY_KEY)).toBeNull();
    withLanguages(['de-DE'], () => expect(detectLang()).toBe('en'));
  });
});
