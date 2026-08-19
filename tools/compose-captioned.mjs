/**
 * Builds the captioned variant of a screenshot set.
 *
 * The caption is composed AROUND the screenshot rather than drawn on top of it:
 * the game fills the frame edge to edge, so any band laid over it would bury
 * the HUD at the top or the bottom bar at the bottom — the two things a store
 * shot most needs to stay legible. Here the phone frame is scaled down onto a
 * brand-colored plate and the text gets its own room above it.
 *
 * Composition runs in the browser, on the dev server's origin, so the page can
 * pull the game's own bundled Fredoka/Nunito from /src/fonts.css — a captioned
 * shot in a different typeface than the UI underneath it reads as a mockup.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const PLATE = { width: 540, height: 1170 };

/**
 * @param {object} opts
 * @param {import('playwright').Browser} opts.browser
 * @param {string} opts.srcDir   directory of raw captures
 * @param {string} opts.outDir   directory to write captioned versions into
 * @param {Record<string,string>} opts.captions  file stem -> caption text
 */
export async function composeCaptioned({ browser, srcDir, outDir, captions }) {
  const page = await browser.newPage({
    viewport: PLATE,
    deviceScaleFactor: 2,
  });
  // about:blank would make the font request cross-origin from a null origin and
  // silently fall back to a system face; loading on the dev server's own origin
  // keeps it same-origin.
  await page.goto('http://localhost:5173/');

  const files = readdirSync(srcDir)
    .filter((f) => extname(f) === '.png')
    .sort();

  let written = 0;
  for (const file of files) {
    const stem = basename(file, '.png');
    const caption = captions[stem];
    // A shot with no caption is deliberate (the menu already carries the title
    // art), not an oversight — it just does not get a captioned variant.
    if (!caption) continue;

    const dataUri = 'data:image/png;base64,' + readFileSync(join(srcDir, file)).toString('base64');
    await page.evaluate(
      ({ caption, dataUri }) => {
        document.head.innerHTML = `
          <link rel="stylesheet" href="/src/fonts.css">
          <style>
            html, body { margin: 0; padding: 0; height: 100%; }
            body {
              width: 540px; height: 1170px;
              display: flex; flex-direction: column; align-items: center;
              background: linear-gradient(170deg, #123c46 0%, #0c272e 100%);
              overflow: hidden;
            }
            .caption {
              font-family: 'Fredoka', system-ui, sans-serif;
              font-weight: 600;
              font-size: 40px;
              line-height: 1.18;
              color: #e8f3f1;
              text-align: center;
              /* Two lines' worth of room, reserved whether or not the text uses
                 it, so every shot in the set puts the phone at the same y. */
              height: 100px;
              display: flex; align-items: center; justify-content: center;
              margin: 46px 40px 0;
            }
            .rule {
              width: 74px; height: 5px; border-radius: 3px;
              background: #35c4ac; margin: 22px 0 26px;
            }
            .phone {
              width: 434px;
              border-radius: 24px;
              box-shadow: 0 18px 46px rgba(0, 0, 0, 0.45);
              display: block;
            }
          </style>`;
        document.body.innerHTML = `
          <div class="caption">${caption}</div>
          <div class="rule"></div>
          <img class="phone" src="${dataUri}">`;
      },
      { caption, dataUri },
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(120);
    await page.screenshot({ path: join(outDir, file) });
    written++;
  }

  await page.close();
  return written;
}
