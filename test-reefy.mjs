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
await page.waitForTimeout(3000);
// Hoş geldin modalı açıksa kapat
const welcomeOk = page.locator('.welcome-ok');
if (await welcomeOk.count()) await welcomeOk.click();
await page.waitForTimeout(500);
await page.screenshot({ path: out + '/2-aquarium.png' });

// Besle
await page.click('#bottombar button[data-act="feed"]');
await page.waitForTimeout(1800);
await page.screenshot({ path: out + '/3-feeding.png' });

// Mağaza
await page.click('#bottombar button[data-act="shop"]');
await page.waitForTimeout(800);
await page.screenshot({ path: out + '/4-shop.png' });
await page.click('.close-btn');

// Yumurta al (bronz)
await page.click('#bottombar button[data-act="eggs"]');
await page.waitForTimeout(600);
await page.screenshot({ path: out + '/5-eggs.png' });

// Koleksiyon
await page.click('.close-btn');
await page.click('#bottombar button[data-act="collection"]');
await page.waitForTimeout(600);
await page.screenshot({ path: out + '/6-collection.png' });
await page.click('.close-btn');

// Ayarlar
await page.click('#bottombar button[data-act="settings"]');
await page.waitForTimeout(500);
await page.screenshot({ path: out + '/7-settings.png' });

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
