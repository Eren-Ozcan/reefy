/**
 * Builds the captioned variant of a screenshot set.
 *
 * The caption is composed ABOVE the screenshot rather than drawn on top of it:
 * the game fills the frame edge to edge, so any band laid over it would bury
 * the HUD at the top or the bottom bar at the bottom — the two things a store
 * shot most needs to stay legible.
 *
 * What it no longer does is shrink the capture. The first version scaled a
 * 9:19.5 phone capture down onto a 9:16 plate and drew a rounded device frame
 * around it, which left the game filling about half the plate — the other half
 * being side margin, drop shadow and a flat band. The capture is now taken at
 * the plate's own game-area size (see VIEWPORT in capture-store-screenshots),
 * so it runs full-bleed under the caption and the game gets ~85% of the plate.
 *
 * The caption zone is not a separate box either: it carries the tank's own
 * water colours, a light ray and a few bubbles, and fades into the top of the
 * capture with no seam. A store card at ~120px reads a scene or it reads a
 * collage, and a flat band under a framed phone reads as a collage.
 *
 * Composition runs in the browser, on the dev server's origin, so the page can
 * pull the game's own bundled Fredoka/Nunito from /src/fonts.css — a captioned
 * shot in a different typeface than the UI underneath it reads as a mockup.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

// 1080x1920 at deviceScaleFactor 2 — exactly 9:16. Play accepts anything from
// 1:2 to 2:1, but only screenshots at 16:9 or 9:16 and at least 1080 px wide
// are eligible for its promotional placements, and the plate is composed
// rather than captured, so there is no reason to give that up.
const PLATE = { width: 540, height: 960 };

// The capture is 540x820, so the caption gets the remaining 140. Two lines of
// lead-size type fit inside it, which is the slack the Turkish set needs.
const CAPTION_H = PLATE.height - 820;

/**
 * @param {object} opts
 * @param {import('playwright').Browser} opts.browser
 * @param {string} opts.srcDir   directory of raw captures
 * @param {string} opts.outDir   directory to write captioned versions into
 * @param {Record<string,string>} opts.captions  file stem -> caption text
 * @param {string[]} [opts.lead]  stems of the first three shots in upload
 *   order. Play shows those three in search results and above the fold, so they
 *   get the larger type; the rest stay quieter for the people still scrolling.
 */
export async function composeCaptioned({ browser, srcDir, outDir, captions, lead = [] }) {
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
      ({ caption, dataUri, isLead, captionH }) => {
        document.head.innerHTML = `
          <link rel="stylesheet" href="/src/fonts.css">
          <style>
            html, body { margin: 0; padding: 0; height: 100%; }
            body {
              width: 540px; height: 960px;
              overflow: hidden; position: relative;
              background: #0a2f37;
            }
            /* Coral Cove's own water, continued upward. The gradient lives on
               the zone rather than on the body so its stops are spread over the
               caption's 140px — on the body they spanned the whole 960px plate
               and the zone got only the darkest 15% of them, which put a hard
               horizontal line across the join. The last stop is the tank's
               surface colour, which is what the capture's top row is, so the
               composed water and the captured water meet with no step. */
            .zone {
              position: absolute; left: 0; right: 0; top: 0;
              height: ${captionH}px;
              overflow: hidden;
              background: linear-gradient(180deg,
                #0a2f37 0%, #17565e 42%, #3d8f95 76%, #8ccace 100%);
            }
            /* One light ray, angled to match the ones the tank renders, so the
               caption zone reads as water above the glass rather than a bar. */
            .ray {
              position: absolute; top: -40px; left: 46%;
              width: 92px; height: ${captionH + 80}px;
              background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0));
              transform: rotate(9deg);
            }
            .bubble {
              position: absolute; border-radius: 50%;
              background: rgba(255, 255, 255, 0.14);
              box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.20);
            }
            .caption {
              position: absolute; left: 0; right: 0; top: 0;
              height: ${captionH}px;
              display: flex; align-items: center; justify-content: center;
              padding: 0 38px; box-sizing: border-box;
              font-family: 'Fredoka', system-ui, sans-serif;
              font-weight: 600;
              font-size: ${isLead ? 42 : 34}px;
              line-height: 1.16;
              color: #f2fbf9;
              text-align: center;
              /* The zone is water, not a flat plate, so the type needs its own
                 separation from the brighter patches in it. */
              text-shadow: 0 2px 14px rgba(6, 28, 34, 0.55);
            }
            .shot {
              position: absolute; left: 0; top: ${captionH}px;
              width: 540px; display: block;
            }
          </style>`;
        document.body.innerHTML = `
          <div class="zone">
            <div class="ray"></div>
            <div class="bubble" style="left: 11%; top: 62%; width: 9px; height: 9px;"></div>
            <div class="bubble" style="left: 17%; top: 30%; width: 5px; height: 5px;"></div>
            <div class="bubble" style="left: 83%; top: 54%; width: 7px; height: 7px;"></div>
            <div class="bubble" style="left: 90%; top: 22%; width: 4px; height: 4px;"></div>
          </div>
          <div class="caption">${caption}</div>
          <img class="shot" src="${dataUri}">`;
      },
      { caption, dataUri, isLead: lead.includes(stem), captionH: CAPTION_H },
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(120);
    await page.screenshot({ path: join(outDir, file) });
    written++;
  }

  await page.close();
  return written;
}
