/**
 * Coral Festival tuning evidence.
 *
 * The four tiers in `src/events.ts` (150 / 400 / 900 / 1,800) were sized by
 * estimate. The only thing that can correct them is what players actually
 * scored, and that number already exists: every cloud save carries
 * `event: { id, points, claimed }` (see src/save.ts), mirrored to
 * `saves/{uid}` as a JSON string in `payload`.
 *
 * The Firestore rules deliberately lock a client to its OWN save document, so
 * this cannot run in the browser — it needs the Admin SDK, which bypasses
 * rules. Point GOOGLE_APPLICATION_CREDENTIALS at a service-account key for the
 * project, or pass --key <path>.
 *
 *   node tools/dump-event-points.mjs --key ./sa.json
 *   node tools/dump-event-points.mjs --event coral-festival-2026-08 --csv out.csv
 *
 * Read the output against the question the event has to answer: if most
 * players clear all four tiers, the event stops being a reason to come back;
 * if almost nobody reaches the third, the top tier is decoration.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const EVENT_ID = arg('event', 'coral-festival-2026-08');
/** Mirrors the tiers in src/events.ts — pass --tiers to compare against others. */
const TIERS = arg('tiers', '150,400,900,1800').split(',').map(Number);
const KEY_PATH = arg('key', process.env.GOOGLE_APPLICATION_CREDENTIALS);
const CSV_PATH = arg('csv', '');

if (!KEY_PATH) {
  console.error('No service-account key. Pass --key <path> or set GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(1);
}

let admin;
try {
  admin = await import('firebase-admin/app');
} catch {
  console.error('firebase-admin is not installed. Run: npm i -D firebase-admin');
  process.exit(1);
}
const { getFirestore } = await import('firebase-admin/firestore');

const credential = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
admin.initializeApp({ credential: admin.cert(credential), projectId: credential.project_id });
const db = getFirestore();

const rows = [];
let total = 0;
let unreadable = 0;
let otherEvent = 0;

const snap = await db.collection('saves').get();
for (const doc of snap.docs) {
  total++;
  const payload = doc.get('payload');
  if (typeof payload !== 'string') { unreadable++; continue; }
  let save;
  try { save = JSON.parse(payload); } catch { unreadable++; continue; }
  const ev = save?.event;
  // A save with no event field predates the first festival; one with a
  // different id belongs to another festival and must not be mixed in.
  if (!ev || typeof ev !== 'object') { otherEvent++; continue; }
  if (ev.id !== EVENT_ID) { otherEvent++; continue; }
  rows.push({
    uid: doc.id,
    points: Number(ev.points) || 0,
    claimed: Array.isArray(ev.claimed) ? ev.claimed.length : 0,
    // Context for reading a low score: a player who barely played at all is
    // not evidence that the tiers are too high.
    fish: Array.isArray(save.fish) ? save.fish.length : 0,
    days: Number(save?.stats?.daysPlayed) || 0,
  });
}

if (rows.length === 0) {
  console.log(`No saves carry event id "${EVENT_ID}". Scanned ${total}; ${otherEvent} on another/no event, ${unreadable} unreadable.`);
  process.exit(0);
}

const points = rows.map((r) => r.points).sort((a, b) => a - b);
const pct = (p) => points[Math.min(points.length - 1, Math.floor((p / 100) * points.length))];
const sum = points.reduce((a, b) => a + b, 0);

console.log(`Event: ${EVENT_ID}`);
console.log(`Saves scanned: ${total}  participating: ${rows.length}  other/no event: ${otherEvent}  unreadable: ${unreadable}`);
console.log('');
console.log('Points distribution');
console.log(`  min ${points[0]}   p25 ${pct(25)}   median ${pct(50)}   p75 ${pct(75)}   p90 ${pct(90)}   max ${points[points.length - 1]}`);
console.log(`  mean ${(sum / points.length).toFixed(1)}`);
console.log('');
console.log('Tier reach (share of participating players who scored at least the tier)');
for (const [i, t] of TIERS.entries()) {
  const n = points.filter((p) => p >= t).length;
  const share = ((n / points.length) * 100).toFixed(1);
  console.log(`  tier ${i + 1}  ${String(t).padStart(5)} pts   ${String(n).padStart(4)} players  ${share.padStart(5)}%`);
}
console.log('');
const claimedAll = rows.filter((r) => r.claimed >= TIERS.length).length;
const claimedNone = rows.filter((r) => r.claimed === 0).length;
console.log(`Claimed every tier: ${claimedAll}   claimed none: ${claimedNone}`);
// Points earned but tiers left unclaimed is its own signal: it points at the
// claim UI rather than at the numbers.
const earnedUnclaimed = rows.filter((r) => r.points >= TIERS[0] && r.claimed === 0).length;
if (earnedUnclaimed > 0) {
  console.log(`Reached tier 1 but claimed nothing: ${earnedUnclaimed} — check the claim flow, not the tiers.`);
}

if (CSV_PATH) {
  const csv = ['uid,points,claimed,fish,days', ...rows.map((r) => `${r.uid},${r.points},${r.claimed},${r.fish},${r.days}`)].join('\n');
  writeFileSync(CSV_PATH, csv);
  console.log(`\nPer-player rows written to ${CSV_PATH}`);
}
