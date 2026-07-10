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

// Besle
await page.click('#bottombar button[data-act="feed"]');
await page.waitForTimeout(1500);

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
await page.click('.close-btn');
await page.waitForTimeout(600);
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
