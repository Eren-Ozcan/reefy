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
await page.waitForTimeout(2600);
const welcomeOk = page.locator('.welcome-ok');
if (await welcomeOk.count()) await welcomeOk.click();
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/2-aquarium.png' });

// Besle: ücretli yem seç, 3 kez suya dokun, tam maliyet düşümünü HUD'dan doğrula
await page.click('#bottombar button[data-act="feed"]');
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
await page.click('.close-btn');

// Envanter: dekoru yerleştir
await page.click('#bottombar button[data-act="inventory"]');
await page.waitForTimeout(400);
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
const dragY = 560;
const fromX = decorBefore * 900;
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
await page.click('#bottombar button[data-act="social"]');
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
await page.click('#bottombar button[data-act="more"]');
await page.waitForTimeout(300);
await page.click('.more-btn[data-go="quests"]');
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/12-quests.png' });
await page.click('.close-btn');

await page.click('#bottombar button[data-act="more"]');
await page.click('.more-btn[data-go="collection"]');
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/13-collection.png' });
await page.click('.close-btn');

await page.click('#bottombar button[data-act="more"]');
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

// Kayıt doğrulaması
await page.waitForTimeout(6500);
const save = await page.evaluate(() => JSON.parse(localStorage.getItem('reefy-save-v1')));
console.log('SAVE: v=' + save.v, 'fish=' + save.fishes.length, 'coins=' + save.coins,
  'decorOwned=' + JSON.stringify(save.decorOwned),
  'placed=' + (save.decorPlaced[save.activeTank] || []).length,
  'friends=' + save.friends.length,
  'questDay=' + save.quests.day);
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
