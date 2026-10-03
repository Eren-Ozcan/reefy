import { haptic } from './haptics';

let gameReduceMotion = false;

/** Mirrors `save.reduceMotion`. Also flips a class so the stylesheet can stop its own animations. */
export function setReduceMotion(on: boolean): void {
  gameReduceMotion = on;
  document.documentElement.classList.toggle('reduce-motion', on);
}

/** True when either the OS "remove animations" setting or the in-game toggle asks for calm. */
export function reducedMotion(): boolean {
  return gameReduceMotion || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

/** Quick scale pop on a counter, on the independent `scale` property so it never fights a transform. */
export function bump(el: HTMLElement): void {
  if (reducedMotion()) return;
  el.animate([{ scale: '1' }, { scale: '1.18' }, { scale: '1' }], { duration: 160, easing: 'ease-out' });
}

const running = new WeakMap<HTMLElement, number>();

/**
 * Counts `el` from `from` to `to`. A newer call on the same element supersedes an
 * older one. The caller supplies `format` and gets the final value written by it,
 * so the text always ends on the real number.
 */
export function countUp(el: HTMLElement, from: number, to: number, format: (n: number) => string): Promise<void> {
  const token = (running.get(el) ?? 0) + 1;
  running.set(el, token);
  const duration = 350 + 650 * Math.min(1, Math.log10(Math.abs(to - from) + 1) / 3);
  const start = performance.now();
  return new Promise((resolve) => {
    const step = (now: number) => {
      if (running.get(el) !== token) return resolve();
      const k = Math.min(1, (now - start) / duration);
      el.textContent = format(Math.round(from + (to - from) * easeOutQuad(k)));
      if (k < 1) { requestAnimationFrame(step); return; }
      running.delete(el);
      resolve();
    };
    requestAnimationFrame(step);
  });
}

interface FlyOptions {
  /** SVG/HTML markup of the flying token. */
  html: string;
  count: number;
  size?: number;
  /** Fired once per token as it lands. */
  onLand?: (index: number) => void;
}

/**
 * Tokens leave `from` in a small burst and arc into `target`. Resolves after the
 * last one lands. Purely visual and pointer-transparent: the reward is already
 * saved before this runs, so skipping or interrupting it loses nothing.
 */
export async function flyToCounter(from: DOMRect, target: HTMLElement, opts: FlyOptions): Promise<void> {
  const { html, count, size = 28, onLand } = opts;
  const t = target.getBoundingClientRect();
  const bx = t.left + t.width / 2;
  const by = t.top + t.height / 2;
  const ax = from.left + from.width / 2;
  const ay = from.top + from.height / 2;
  const flights: Promise<void>[] = [];
  for (let i = 0; i < count; i++) {
    flights.push(flyOne(ax, ay, bx, by, size, html).then(() => onLand?.(i)));
    await sleep(45);
  }
  await Promise.all(flights);
}

function flyOne(ax: number, ay: number, bx: number, by: number, size: number, html: string): Promise<void> {
  const el = document.createElement('div');
  el.innerHTML = html;
  Object.assign(el.style, {
    position: 'fixed', left: '0', top: '0', width: `${size}px`, height: `${size}px`,
    pointerEvents: 'none', zIndex: '9999', willChange: 'transform',
  });
  document.body.appendChild(el);
  const sx = ax + (Math.random() * 2 - 1) * 36;
  const sy = ay + (Math.random() * 2 - 1) * 20;
  const cx = (sx + bx) / 2 + (Math.random() - 0.5) * 120;
  const cy = Math.min(sy, by) - 90;
  const frames: Keyframe[] = [];
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const u = (i / N) ** 1.6; // ease-in: speed up into the counter
    const x = (1 - u) ** 2 * sx + 2 * (1 - u) * u * cx + u * u * bx - size / 2;
    const y = (1 - u) ** 2 * sy + 2 * (1 - u) * u * cy + u * u * by - size / 2;
    frames.push({ transform: `translate(${x}px, ${y}px) scale(${i === 0 ? 0.3 : 1})`, offset: i / N });
  }
  return el.animate(frames, { duration: 620, easing: 'linear' }).finished.then(
    () => el.remove(),
    () => el.remove(),
  );
}

/**
 * The whole coin-gain beat: tokens fly from `origin` to the counter, each landing
 * bumps it and ticks a light haptic, then the number counts up and a success buzz
 * closes it.
 */
export async function playCoinGain(
  origin: DOMRect,
  counter: HTMLElement,
  html: string,
  from: number,
  to: number,
  format: (n: number) => string,
): Promise<void> {
  if (reducedMotion()) { haptic('success'); counter.textContent = format(to); return; }
  const count = Math.min(10, Math.max(3, Math.round(Math.log10(to - from + 1) * 3)));
  await flyToCounter(origin, counter, {
    html,
    count,
    onLand: () => { bump(counter); haptic('light'); },
  });
  await countUp(counter, from, to, format);
  haptic('success');
}
