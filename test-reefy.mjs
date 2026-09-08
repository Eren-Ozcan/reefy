import { chromium } from 'playwright';

const out = process.argv[2] || '.';
const browser = await chromium.launch();
// The language is pinned EXPLICITLY: there are two languages now and detection
// looks at the device language, so without pinning the run would vary with the
// developer's machine locale. Turkish gets its own leg below, on its own page.
const page = await browser.newPage({ viewport: { width: 900, height: 640 }, locale: 'en-US' });

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

// Feed: pick paid food, tap the water 3 times, verify the full cost deduction in the HUD
await page.click('#carebar button[data-care="feed"]');
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
  throw new Error(`Unexpected feed deduction: ${coinsBefore} -> ${coinsAfter} (diff ${feedSpend}, expected 24)`);
}
await page.click('#mode-done');
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/2b-feeding.png' });

// Shop: buy a fish
await page.click('#bottombar button[data-act="shop"]');
await page.waitForTimeout(400);
await page.click('.buy-btn[data-sp="lepistes"]');
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/3-shop-fish.png' });

// Shop tabs
await page.click('.tab[data-tab="eggs"]');
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/4-shop-eggs.png' });

await page.click('.tab[data-tab="decor"]');
await page.waitForTimeout(300);
// Buy the first decor item (around 150 coins)
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

// Incubating egg: buy -> speed up -> collect.
// There is no real purchase in the web preview (StubIAP); pearls come from the
// dev hook.
await page.evaluate(() => {
  const g = window.__reefyGame;
  g.save.pearls += 200;
  g.ui.refreshHUD();
});
await page.click('.tab[data-tab="eggs"]');
await page.waitForTimeout(300);
const pearlsForEgg = Number((await page.locator('#hud-pearls').textContent()).trim());
if (pearlsForEgg < 110) errors.push(`EGG: yeterli inci yok (${pearlsForEgg})`);
const capBefore = (await page.locator('#bottombar button[data-act="aquarium"] small').textContent()).trim();
await page.click('.buy-btn[data-egg="abis"]');
await page.waitForTimeout(400);
if (await page.locator('[data-egg-row]').count() === 0) errors.push('EGG: incubation row did not appear');
await page.screenshot({ path: out + '/7b-egg-hatching.png' });
await page.locator('[data-speed-egg]').first().click();
await page.waitForTimeout(400);
await page.locator('[data-collect-egg]').first().click();
await page.waitForTimeout(600);
const reveal = await page.locator('.reveal-egg').count();
if (reveal === 0) errors.push('EGG: reveal screen did not come up after collecting');
await page.waitForTimeout(1400); // reveal animation: fish and button appear after 1.1s
await page.screenshot({ path: out + '/7c-egg-collected.png' });
// The reveal screen REPLACES the shop panel; closing it with .reveal-ok closes the panel too.
await page.click('.reveal-ok');
await page.waitForTimeout(400);
const capAfter = (await page.locator('#bottombar button[data-act="aquarium"] small').textContent()).trim();
if (capBefore === capAfter) errors.push(`EGG: fish count did not increase (${capBefore} -> ${capAfter})`);

// Inventory: switch to the decor tab, place the decor
await page.click('#bottombar button[data-act="inventory"]');
await page.waitForTimeout(400);
await page.click('.tab[data-tab="decor"]');
await page.waitForTimeout(300);
await page.locator('[data-place]').first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/8-inventory.png' });

// Decor dragging: enter edit mode, drag the decor, verify the position changed in the save
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
  throw new Error(`Decor was not dragged: ${decorBefore} -> ${decorAfter}`);
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

// More: Quests + Collection + Settings
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

// Moving a fish: grant coins+level via the test hook, buy the second tank, move the fish from its card
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
// Tap the fish - read its position from the game; retry a few times since the fish moves
for (let i = 0; i < 5; i++) {
  const pos = await page.evaluate(() => {
    const fs = window.__reefyGame.fishes;
    let f = fs[0];
    for (const c of fs) if (c.y > f.y) f = c; // the lowest fish, away from the HUD
    return { x: f.x, y: f.y };
  });
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(350);
  if (await page.locator('.fish-info').count()) break;
}
if (!(await page.locator('.fish-info').count())) throw new Error('Could not open the fish card');
await page.screenshot({ path: out + '/15-fish-card.png' });

// Rename: change the name from the card, it must be written to the save
await page.fill('#fish-name-input', 'Poyraz');
await page.click('#fish-name-save');
await page.waitForTimeout(300);
const renamed = await page.evaluate(() => window.__reefyGame.fishes.some((f) => f.name === 'Poyraz'));
if (!renamed) throw new Error('Could not rename the fish');
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
  throw new Error(`Could not move the fish: active ${fishBefore} -> ${moved.active}, in Kumsal ${moved.inKumsal}`);
}
await page.screenshot({ path: out + '/16-fish-moved.png' });

// Food pack: buy stock from the shop, feed from stock (coins must not drop)
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
  throw new Error(`Food pack wrong: ${coinsBeforePack} -> ${pack.coins}, stock ${pack.stock} (expected -70, 10)`);
}
await page.click('#carebar button[data-care="feed"]');
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
  throw new Error(`Feeding from stock wrong: coins ${pack.coins} -> ${afterStockFeed.coins}, stock ${afterStockFeed.stock} (expected same coins, stock 9)`);
}
await page.click('#mode-done');
await page.waitForTimeout(200);

// Inventory: fish list (grouped by tank, with income)
await page.click('#bottombar button[data-act="inventory"]');
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/18-inventory-fish.png' });
await page.click('.tab[data-tab="feeds"]');
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/19-inventory-feeds.png' });
await page.click('.close-btn');
await page.waitForTimeout(200);

// Earnings report
await page.click('#bottombar button[data-act="you"]');
await page.waitForTimeout(300);
await page.click('.more-btn[data-go="earnings"]');
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/20-earnings.png' });
await page.click('.close-btn');
await page.waitForTimeout(200);

// Dormant fish must live too: progress of the fish in the other tank must increase
await page.evaluate(() => {
  const d = window.__reefyGame.dormant[0];
  d.progress = 0.1;
  d.hunger = 1;
});
const dormantP0 = await page.evaluate(() => window.__reefyGame.dormant[0].progress);
await page.waitForTimeout(1500);
const dormantP1 = await page.evaluate(() => window.__reefyGame.dormant[0].progress);
if (!(dormantP1 > dormantP0)) {
  throw new Error(`Dormant fish did not grow: ${dormantP0} -> ${dormantP1}`);
}

// Selling from inventory: make the dormant fish an adult, sell it from the list without switching tanks
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
  throw new Error(`Selling from inventory wrong: fish ${sell0.total} -> ${sell1.total}, coins ${sell0.coins} -> ${sell1.coins}`);
}
await page.screenshot({ path: out + '/22-fish-sold.png' });
await page.click('.close-btn');
await page.waitForTimeout(200);

// Tank dirt: add a smudge -> growth/income penalty and glass blur must apply, and tapping must clean it
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
  throw new Error(`Dirt penalty was not applied: dirtPct=${dirty.dirtPct}, growthMult=${dirty.growthMult}`);
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
  throw new Error(`Glass grime was not drawn in a dirty tank: ${JSON.stringify(grimy)}`);
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
  throw new Error(`UI sits on top of the dirt smudge, the tap does not reach the scene: ${atTarget}`);
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
// Clean the remaining smudges too (0.3 was cleaned above), the glass must go clear
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

// Profile: stats must reflect the sales/feeding
await page.click('#bottombar button[data-act="you"]');
await page.waitForTimeout(300);
await page.click('.more-btn[data-go="profile"]');
await page.waitForTimeout(400);
const profileText = await page.locator('.panel-body').textContent();
if (!profileText.includes('Fish sold') || !profileText.includes('Dirt cleaned')) {
  throw new Error('Profile stats look incomplete');
}
await page.screenshot({ path: out + '/26-profile.png' });
await page.click('.close-btn');
await page.waitForTimeout(200);

// Coral Festival: on a SEPARATE page with its own clock pinned.
// The event calendar depends on the date; shifting the main run's clock would
// shift the daily-quest day too, so this section runs in a clean context.
{
  const fest = await browser.newPage({ viewport: { width: 900, height: 640 }, locale: 'en-US' });
  fest.on('pageerror', (e) => errors.push('FEST PAGEERROR: ' + e.message));
  // setFixedTime, NOT install: install also freezes timers and the game loop
  // never starts. The event calendar only reads new Date().
  await fest.clock.setFixedTime(new Date('2026-08-25T10:00:00Z'));
  await fest.goto('http://localhost:5173/');
  await fest.waitForTimeout(1200);
  await fest.click('#play-btn');
  await fest.waitForSelector('#menu.hidden', { timeout: 20000 });
  await fest.waitForTimeout(800);
  for (let i = 0; i < 8; i++) {
    const next = fest.locator('.tutorial-next');
    if (await next.count() === 0) break;
    await next.first().click();
    await fest.waitForTimeout(300);
  }
  const festWelcome = fest.locator('.welcome-ok');
  if (await festWelcome.count()) await festWelcome.first().click();
  await fest.waitForTimeout(400);

  // Does scoring actually flow through questEvent
  const scored = await fest.evaluate(() => {
    const g = window.__reefyGame;
    g.save.event = { id: '', points: 0, claimed: [] };
    g.questEvent('feed', 10);
    return g.save.event;
  });
  if (scored.points !== 10) errors.push(`FEST: feeding points were not recorded (${JSON.stringify(scored)})`);
  if (scored.id !== 'coral-festival-2026-08') errors.push(`FEST: event state was not set up (${scored.id})`);

  // Grant enough points to unlock two tiers, claim them in the panel
  const coinsBefore = await fest.evaluate(() => {
    const g = window.__reefyGame;
    g.save.event.points = 500;
    g.ui.refreshHUD();
    return g.save.coins;
  });
  await fest.click('#bottombar button[data-act="quests"]');
  await fest.waitForTimeout(400);
  if (await fest.locator('.festival').count() === 0) errors.push('FEST: festival block did not appear');
  const tierBtns = await fest.locator('[data-event-tier]').count();
  if (tierBtns !== 2) errors.push(`FEST: claimable tier count is not 2 (${tierBtns})`);
  await fest.screenshot({ path: out + '/27-festival.png' });
  await fest.locator('[data-event-tier]').first().click();
  await fest.waitForTimeout(400);
  const after = await fest.evaluate(() => ({
    coins: window.__reefyGame.save.coins,
    claimed: window.__reefyGame.save.event.claimed,
  }));
  if (after.coins <= coinsBefore) errors.push(`FEST: tier reward was not paid (${coinsBefore} -> ${after.coins})`);
  if (after.claimed.length !== 1) errors.push(`FEST: tier was not marked as claimed (${JSON.stringify(after.claimed)})`);
  const leftBtns = await fest.locator('[data-event-tier]').count();
  if (leftBtns !== 1) errors.push(`FEST: the claimed tier did not drop off the list (${leftBtns})`);
  await fest.screenshot({ path: out + '/28-festival-claimed.png' });
  await fest.close();
}

// Language: a Turkish device must start in Turkish, and it must be possible to switch to English in settings
{
  const trPage = await browser.newPage({ viewport: { width: 900, height: 640 }, locale: 'tr-TR' });
  trPage.on('pageerror', (e) => errors.push('LANG PAGEERROR: ' + e.message));
  await trPage.goto('http://localhost:5173/');
  await trPage.waitForTimeout(1200);
  const playLabel = (await trPage.locator('#play-btn').textContent()).trim();
  if (!playLabel.includes('Oyna')) errors.push(`LANG: menu is not Turkish on a tr-TR device (${playLabel})`);
  await trPage.screenshot({ path: out + '/29-lang-tr.png' });

  await trPage.click('#play-btn');
  await trPage.waitForSelector('#menu.hidden', { timeout: 20000 });
  await trPage.waitForTimeout(800);
  for (let i = 0; i < 8; i++) {
    const next = trPage.locator('.tutorial-next');
    if (await next.count() === 0) break;
    await next.first().click();
    await trPage.waitForTimeout(300);
  }
  const trWelcome = trPage.locator('.welcome-ok');
  if (await trWelcome.count()) await trWelcome.first().click();
  await trPage.waitForTimeout(400);

  // The language row must be visible when there are two languages
  await trPage.click('#bottombar button[data-act="you"]');
  await trPage.waitForTimeout(300);
  await trPage.click('.more-btn[data-go="settings"]');
  await trPage.waitForTimeout(400);
  if (await trPage.locator('.lang-toggle').count() === 0) errors.push('LANG: no language row in settings');
  await trPage.screenshot({ path: out + '/30-lang-settings.png' });

  // Cloud data deletion row: two-tap confirmation, the first tap only arms it
  const delBtn = trPage.locator('#cloud-delete');
  if (await delBtn.count() === 0) errors.push('DELETE: no cloud data deletion row');
  else {
    await delBtn.click();
    await trPage.waitForTimeout(200);
    const armedText = (await delBtn.textContent()).trim();
    if (!armedText.includes('tekrar dokun')) errors.push(`DELETE: the first tap did not ask for confirmation (${armedText})`);
    // There is no Firebase configuration in the web preview; confirming must
    // produce an error toast but MUST NOT BLOW UP THE PAGE - that is what is
    // actually under test here.
    await delBtn.click();
    await trPage.waitForTimeout(1200);
    if (await delBtn.count() === 0) errors.push('DELETE: the button disappeared after confirming');
  }
  await trPage.screenshot({ path: out + '/31-cloud-delete.png' });

  // Switch to English - the page reloads itself
  await trPage.click('[data-lang="en"]');
  await trPage.waitForTimeout(2500);
  const enLabel = (await trPage.locator('#play-btn').textContent()).trim();
  if (!enLabel.includes('Play')) errors.push(`LANG: menu is not English after switching to English (${enLabel})`);
  const storedLang = await trPage.evaluate(() => localStorage.getItem('reefy-lang'));
  if (storedLang !== 'en') errors.push(`LANG: the choice was not saved (${storedLang})`);
  await trPage.close();
}

// Save verification
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
