import { chromium } from 'playwright';

const out = process.argv[2] || '.';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 640 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:5173/');
await page.waitForTimeout(1200);
await page.screenshot({ path: out + '/1-menu.png' });

await page.click('#play-btn');
// The menu fades out over 0.6s and keeps swallowing clicks for the whole transition,
// so wait for the class AND for the fade to finish before touching anything.
await page.waitForSelector('#menu.hidden', { timeout: 20000 });
await page.waitForTimeout(800);

// A fresh browser context has no save, so the first-launch tutorial always runs, and
// its backdrop swallows every click until it is stepped through. It is mounted after
// the menu goes, hence the wait above rather than a fixed sleep from the Play click.
for (let i = 0; i < 12; i++) {
  const next = page.locator('.tutorial-next');
  if (!(await next.count())) break;
  await next.click();
  await page.waitForTimeout(350);
}
const welcomeOk = page.locator('.welcome-ok');
if (await welcomeOk.count()) await welcomeOk.click();
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/2-aquarium.png' });

// Besle: ücretli yem seç, 3 kez suya dokun, tam maliyet düşümünü HUD'dan doğrula
await page.click('#siderail button[data-rail="feed"]');
await page.waitForTimeout(300);
await page.click('.feed-opt[data-feed="lezzet"]');
await page.waitForTimeout(300);
const coinsBefore = Number((await page.locator('#hud-coins').textContent()).trim());
await page.mouse.click(300, 300);
await page.waitForTimeout(150);
await page.mouse.click(450, 320);
await page.waitForTimeout(150);
await page.mouse.click(380, 350);
await page.waitForTimeout(150);
const coinsAfter = Number((await page.locator('#hud-coins').textContent()).trim());
const feedSpend = coinsBefore - coinsAfter;
if (feedSpend !== 24) {
  throw new Error(`Yem düşümü beklenmiyor: ${coinsBefore} -> ${coinsAfter} (fark ${feedSpend}, beklenen 24)`);
}
await page.click('#mode-done');
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/2b-feeding.png' });

// Mağaza: balık satın al
await page.click('#bottombar button[data-act="shop"]');
await page.waitForTimeout(400);
await page.click('.buy-btn[data-sp="lepistes"]');
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/3-shop-fish.png' });

// Mağaza sekmeleri
await page.click('.tab[data-tab="eggs"]');
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/4-shop-eggs.png' });

await page.click('.tab[data-tab="decor"]');
await page.waitForTimeout(300);
// İlk dekoru satın al (150 altın civarı)
await page.locator('.buy-btn[data-decor]').first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/5-shop-decor.png' });

await page.click('.tab[data-tab="tanks"]');
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/6-shop-tanks.png' });

await page.click('.tab[data-tab="pearls"]');
await page.waitForTimeout(300);
await page.locator('.buy-btn[data-iap]').first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/7-shop-iap.png' });

// Kuluçkalı yumurta: satın al -> hızlandır -> topla.
// Web önizlemesinde gerçek satın alma yok (StubIAP), inci dev kancasından verilir.
await page.evaluate(() => {
  const g = window.__reefyGame;
  g.save.pearls += 200;
  g.ui.refreshHUD();
});
await page.click('.tab[data-tab="eggs"]');
await page.waitForTimeout(300);
const pearlsForEgg = Number((await page.locator('#hud-pearls').textContent()).trim());
if (pearlsForEgg < 110) errors.push(`EGG: yeterli inci yok (${pearlsForEgg})`);
const capBefore = (await page.locator('#hud-cap').textContent()).trim();
await page.click('.buy-btn[data-egg="abis"]');
await page.waitForTimeout(400);
if (await page.locator('[data-egg-row]').count() === 0) errors.push('EGG: kuluçka satırı görünmedi');
await page.screenshot({ path: out + '/7b-egg-hatching.png' });
await page.locator('[data-speed-egg]').first().click();
await page.waitForTimeout(400);
await page.locator('[data-collect-egg]').first().click();
await page.waitForTimeout(600);
const reveal = await page.locator('.reveal-egg').count();
if (reveal === 0) errors.push('EGG: toplama sonrası açılış ekranı gelmedi');
await page.waitForTimeout(1400); // açılış animasyonu: balık ve buton 1.1sn sonra görünür
await page.screenshot({ path: out + '/7c-egg-collected.png' });
// Açılış ekranı mağaza panelinin YERİNE geçer; .reveal-ok ile kapanınca panel de kapanır.
await page.click('.reveal-ok');
await page.waitForTimeout(400);
const capAfter = (await page.locator('#hud-cap').textContent()).trim();
if (capBefore === capAfter) errors.push(`EGG: balık sayısı artmadı (${capBefore} -> ${capAfter})`);

// Envanter: dekor sekmesine geç, dekoru yerleştir
await page.click('#bottombar button[data-act="inventory"]');
await page.waitForTimeout(400);
await page.click('.tab[data-tab="decor"]');
await page.waitForTimeout(300);
await page.locator('[data-place]').first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/8-inventory.png' });

// Dekor sürükleme: düzenleme moduna gir, dekoru sürükle, konumun kayıtta değiştiğini doğrula
await page.click('.edit-mode-btn');
await page.waitForTimeout(300);
const decorBefore = await page.evaluate(() => {
  const save = JSON.parse(localStorage.getItem('reefy-save-v1'));
  return save.decorPlaced[save.activeTank][0].fx;
});
const fromX = decorBefore * 900;
// Decor sits on the sand, whose surface curves with x, and its hit box runs upward
// from there — so the grab point is read from the scene rather than hardcoded. The
// mode chip sits bottom-centre during edit mode and would otherwise eat the drag.
const dragY = await page.evaluate((x) => {
  const g = window.__reefyGame;
  const baseY = g ? g.sandSurfaceY(x) + 6 : 568;
  const chip = document.getElementById('mode-chip');
  const chipTop = chip && !chip.classList.contains('hidden')
    ? chip.getBoundingClientRect().top : Infinity;
  return Math.round(Math.min(baseY - 40, chipTop - 20));
}, fromX);
const toX = fromX < 450 ? fromX + 300 : fromX - 300;
await page.mouse.move(fromX, dragY);
await page.mouse.down();
await page.mouse.move((fromX + toX) / 2, dragY, { steps: 5 });
await page.mouse.move(toX, dragY, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(200);
const decorAfter = await page.evaluate(() => {
  const save = JSON.parse(localStorage.getItem('reefy-save-v1'));
  return save.decorPlaced[save.activeTank][0].fx;
});
if (Math.abs(decorAfter - decorBefore) < 0.15) {
  throw new Error(`Dekor sürüklenmedi: ${decorBefore} -> ${decorAfter}`);
}
await page.click('#mode-done');
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/9-decor-placed.png' });

// Sosyal
await page.click('#bottombar button[data-act="you"]');
await page.waitForTimeout(300);
await page.click('.more-btn[data-go="social"]');
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/10-leaderboard.png' });
await page.click('.tab[data-tab="friends"]');
await page.waitForTimeout(300);
await page.fill('#friend-input', 'REEF-TESTX');
await page.click('#friend-add-btn');
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/11-friends.png' });
await page.click('.close-btn');

// Daha: Görevler + Koleksiyon + Ayarlar
await page.click('#bottombar button[data-act="quests"]');
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/12-quests.png' });
await page.click('.close-btn');

await page.click('#bottombar button[data-act="you"]');
await page.click('.more-btn[data-go="collection"]');
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/13-collection.png' });
await page.click('.close-btn');

await page.click('#bottombar button[data-act="you"]');
await page.click('.more-btn[data-go="settings"]');
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/14-settings.png' });
await page.click('.close-btn');

// Balık taşıma: test kancasıyla altın+seviye ver, ikinci akvaryumu al, balığı kartından taşı
await page.evaluate(() => {
  const g = window.__reefyGame;
  g.save.coins += 5000;
  g.save.level = 5;
  g.ui.refreshHUD();
});
await page.click('#bottombar button[data-act="shop"]');
await page.waitForTimeout(300);
await page.click('.tab[data-tab="tanks"]');
await page.waitForTimeout(300);
await page.click('.buy-btn[data-tank="tank-kumsal"]');
await page.waitForTimeout(300);
await page.click('.close-btn');
await page.waitForTimeout(300);

const fishBefore = await page.evaluate(() => window.__reefyGame.fishes.length);
// Balığa dokun — konumu oyundan al; balık hareket ettiği için birkaç deneme yap
for (let i = 0; i < 5; i++) {
  const pos = await page.evaluate(() => {
    const fs = window.__reefyGame.fishes;
    let f = fs[0];
    for (const c of fs) if (c.y > f.y) f = c; // HUD'dan uzak, en alttaki balık
    return { x: f.x, y: f.y };
  });
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(350);
  if (await page.locator('.fish-info').count()) break;
}
if (!(await page.locator('.fish-info').count())) throw new Error('Balık kartı açılamadı');
await page.screenshot({ path: out + '/15-fish-card.png' });

// Yeniden adlandır: kart üzerinden isim değiştir, kayda işlenmeli
await page.fill('#fish-name-input', 'Poyraz');
await page.click('#fish-name-save');
await page.waitForTimeout(300);
const renamed = await page.evaluate(() => window.__reefyGame.fishes.some((f) => f.name === 'Poyraz'));
if (!renamed) throw new Error('Balık yeniden adlandırılamadı');
await page.screenshot({ path: out + '/15b-fish-renamed.png' });

await page.click('.move-btn[data-move="tank-kumsal"]');
await page.waitForTimeout(300);
const moved = await page.evaluate(() => {
  const g = window.__reefyGame;
  return {
    active: g.fishes.length,
    inKumsal: g.save.fishes.filter((f) => f.tank === 'tank-kumsal').length,
  };
});
if (moved.active !== fishBefore - 1 || moved.inKumsal !== 1) {
  throw new Error(`Balık taşınamadı: aktif ${fishBefore} -> ${moved.active}, kumsalda ${moved.inKumsal}`);
}
await page.screenshot({ path: out + '/16-fish-moved.png' });

// Yem paketi: mağazadan stok al, stoktan yemle (altın düşmemeli)
await page.click('#bottombar button[data-act="shop"]');
await page.waitForTimeout(300);
await page.click('.tab[data-tab="feeds"]');
await page.waitForTimeout(300);
const coinsBeforePack = await page.evaluate(() => window.__reefyGame.save.coins);
await page.click('.buy-btn[data-feedpack="pack-lezzet-10"]');
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/17-shop-feeds.png' });
await page.click('.close-btn');
await page.waitForTimeout(200);
const pack = await page.evaluate(() => ({
  coins: window.__reefyGame.save.coins,
  stock: window.__reefyGame.save.feedOwned.lezzet,
}));
if (coinsBeforePack - pack.coins !== 70 || pack.stock !== 10) {
  throw new Error(`Yem paketi hatalı: ${coinsBeforePack} -> ${pack.coins}, stok ${pack.stock} (beklenen -70, 10)`);
}
await page.click('#siderail button[data-rail="feed"]');
await page.waitForTimeout(300);
await page.click('.feed-opt[data-feed="lezzet"]');
await page.waitForTimeout(200);
await page.mouse.click(420, 300);
await page.waitForTimeout(200);
const afterStockFeed = await page.evaluate(() => ({
  coins: window.__reefyGame.save.coins,
  stock: window.__reefyGame.save.feedOwned.lezzet,
}));
if (afterStockFeed.coins !== pack.coins || afterStockFeed.stock !== 9) {
  throw new Error(`Stoktan yemleme hatalı: altın ${pack.coins} -> ${afterStockFeed.coins}, stok ${afterStockFeed.stock} (beklenen aynı altın, stok 9)`);
}
await page.click('#mode-done');
await page.waitForTimeout(200);

// Envanter: balık listesi (akvaryuma göre gruplu, gelirli)
await page.click('#bottombar button[data-act="inventory"]');
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/18-inventory-fish.png' });
await page.click('.tab[data-tab="feeds"]');
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/19-inventory-feeds.png' });
await page.click('.close-btn');
await page.waitForTimeout(200);

// Kazanç raporu
await page.click('#bottombar button[data-act="you"]');
await page.waitForTimeout(300);
await page.click('.more-btn[data-go="earnings"]');
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/20-earnings.png' });
await page.click('.close-btn');
await page.waitForTimeout(200);

// Uyuyan balıklar da yaşamalı: diğer akvaryumdaki balığın ilerlemesi artmalı
await page.evaluate(() => {
  const d = window.__reefyGame.dormant[0];
  d.progress = 0.1;
  d.hunger = 1;
});
const dormantP0 = await page.evaluate(() => window.__reefyGame.dormant[0].progress);
await page.waitForTimeout(1500);
const dormantP1 = await page.evaluate(() => window.__reefyGame.dormant[0].progress);
if (!(dormantP1 > dormantP0)) {
  throw new Error(`Uyuyan balık büyümedi: ${dormantP0} -> ${dormantP1}`);
}

// Envanterden satış: uyuyan balığı yetişkin yap, akvaryum değiştirmeden listeden sat
await page.evaluate(() => { window.__reefyGame.dormant[0].progress = 1; });
const sell0 = await page.evaluate(() => ({
  coins: window.__reefyGame.save.coins,
  total: window.__reefyGame.fishes.length + window.__reefyGame.dormant.length,
}));
await page.click('#bottombar button[data-act="inventory"]');
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/21-inventory-sell.png' });
await page.locator('.inv-sell').first().click();
await page.waitForTimeout(300);
const sell1 = await page.evaluate(() => ({
  coins: window.__reefyGame.save.coins,
  total: window.__reefyGame.fishes.length + window.__reefyGame.dormant.length,
}));
if (sell1.total !== sell0.total - 1 || sell1.coins <= sell0.coins) {
  throw new Error(`Envanterden satış hatalı: balık ${sell0.total} -> ${sell1.total}, altın ${sell0.coins} -> ${sell1.coins}`);
}
await page.screenshot({ path: out + '/22-fish-sold.png' });
await page.click('.close-btn');
await page.waitForTimeout(200);

// Akvaryum kirliliği: leke ekle -> büyüme/gelir cezası ve cam bulanıklığı uygulanmalı, tıklayınca temizlenmeli
const dirty = await page.evaluate(() => {
  const g = window.__reefyGame;
  const tid = g.save.activeTank;
  g.save.dirtSpots[tid] = [
    { id: 1, fx: 0.3, fy: 0.4, r: 1, kind: 0 },
    { id: 2, fx: 0.5, fy: 0.5, r: 1, kind: 1 },
    { id: 3, fx: 0.7, fy: 0.35, r: 1, kind: 0 },
  ];
  g.ui.refreshHUD();
  return { dirtPct: g.dirtPct(tid), growthMult: g.growthMult, w: g.bounds.w, h: g.bounds.h };
});
if (dirty.dirtPct <= 0 || dirty.growthMult >= 1) {
  throw new Error(`Kirlilik cezası uygulanmadı: dirtPct=${dirty.dirtPct}, growthMult=${dirty.growthMult}`);
}
await page.waitForTimeout(300);
// This used to assert a BlurFilter on the whole scene. b9dd3bb replaced that with
// grime drawn on the glass itself, so the check follows the dirt layer instead:
// the fish and the scene are meant to stay sharp now.
const grimy = await page.evaluate(() => {
  const g = window.__reefyGame;
  return { visible: g.grimeSprite.visible, alpha: g.grimeSprite.alpha, dirtDrawn: g.dirtG.visible };
});
if (!grimy.visible || grimy.alpha <= 0) {
  throw new Error(`Kirli akvaryumda cam kiri çizilmedi: ${JSON.stringify(grimy)}`);
}
await page.screenshot({ path: out + '/23-dirty-tank.png' });

// Aim at the spot on the left (fx 0.3) rather than the one dead centre: the collect
// group is DOM sitting over the canvas, and a tap that lands on it never reaches the
// scene. Guard it, so this fails loudly if UI is ever parked over the target again.
const target = { x: 0.3 * dirty.w, y: 0.4 * dirty.h };
const atTarget = await page.evaluate(
  (t) => { const e = document.elementFromPoint(t.x, t.y); return e ? e.tagName + '.' + (e.className || '') : null; },
  target,
);
if (!/CANVAS/.test(atTarget || '')) {
  throw new Error(`Kir lekesinin üstünde UI var, dokunuş sahneye ulaşmıyor: ${atTarget}`);
}
await page.mouse.click(target.x, target.y);
await page.waitForTimeout(300);
const cleaned = await page.evaluate(() => {
  const g = window.__reefyGame;
  return { count: g.save.dirtSpots[g.save.activeTank].length, growthMult: g.growthMult };
});
if (cleaned.count !== 2 || cleaned.growthMult <= dirty.growthMult) {
  throw new Error(`Kir temizlenemedi: adet ${cleaned.count} (beklenen 2), growthMult ${dirty.growthMult} -> ${cleaned.growthMult}`);
}
await page.screenshot({ path: out + '/24-dirt-cleaned.png' });
// Kalan lekeleri de temizle (0.3 yukarıda temizlendi), cam netliğe dönmeli
await page.mouse.click(0.5 * dirty.w, 0.5 * dirty.h);
await page.waitForTimeout(200);
await page.mouse.click(0.7 * dirty.w, 0.35 * dirty.h);
await page.waitForTimeout(300);
const spotless = await page.evaluate(() => {
  const g = window.__reefyGame;
  return {
    count: g.save.dirtSpots[g.save.activeTank].length,
    grimeVisible: g.grimeSprite.visible && g.grimeSprite.alpha > 0,
  };
});
if (spotless.count !== 0 || spotless.grimeVisible) {
  throw new Error(`Akvaryum tam temizlenemedi: kalan ${spotless.count}, cam kiri ${spotless.grimeVisible}`);
}
await page.screenshot({ path: out + '/25-tank-spotless.png' });

// Profil: istatistikler satışları/yemlemeyi yansıtmalı
await page.click('#bottombar button[data-act="you"]');
await page.waitForTimeout(300);
await page.click('.more-btn[data-go="profile"]');
await page.waitForTimeout(400);
const profileText = await page.locator('.panel-body').textContent();
if (!profileText.includes('Fish sold') || !profileText.includes('Dirt cleaned')) {
  throw new Error('Profil istatistikleri eksik görünüyor');
}
await page.screenshot({ path: out + '/26-profile.png' });
await page.click('.close-btn');
await page.waitForTimeout(200);

// Kayıt doğrulaması
await page.waitForTimeout(6500);
const save = await page.evaluate(() => JSON.parse(localStorage.getItem('reefy-save-v1')));
console.log('SAVE: v=' + save.v, 'fish=' + save.fishes.length, 'coins=' + save.coins,
  'feedOwned=' + JSON.stringify(save.feedOwned),
  'decorOwned=' + JSON.stringify(save.decorOwned),
  'placed=' + (save.decorPlaced[save.activeTank] || []).length,
  'friends=' + save.friends.length,
  'questDay=' + save.quests.day);
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
