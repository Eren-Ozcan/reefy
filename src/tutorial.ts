import { track } from './analytics';
import { audio } from './audio';
import type { Game } from './game';
import { haptic } from './haptics';
import { t as tt } from './i18n';

export interface TutorialHost {
  root: HTMLElement;
  game: Game;
  exitModes(): void;
  toast(msg: string): void;
  /** Fired when the tutorial ends, finished or skipped. */
  onFinish?(): void;
}

interface Step {
  caption(): string;
  /** Where the ring and hand go right now; null shows only the caption. */
  target(): DOMRect | null;
  done(): boolean;
  /** A step that cannot be done is passed over (e.g. an empty income pot). */
  skip?(): boolean;
}

/**
 * First-launch tutorial: one welcome card, then three guided actions the player
 * performs on the real UI (feed a hungry fish, collect the seeded pot, sell the
 * guppy that has just grown). The overlay never blocks input; it only points.
 * Completion is read from the save's counters, so it works whichever way the
 * player gets there.
 */
export function runGuidedTutorial(host: TutorialHost): void {
  const { game } = host;
  const s = game.save;
  if (s.tutorialDone) return;

  track('tutorial_begin');
  const card = document.createElement('div');
  card.className = 'tutorial-backdrop';
  card.innerHTML = `
    <div class="tutorial-card">
      <h2>${tt('🌊 Welcome to Reefy!')}</h2>
      <p>${tt('This reef is now yours. Let us show you the three things you will do most.')}</p>
      <button class="buy-btn cta cta-lead tutorial-next">${tt("Let's start")}</button>
    </div>`;
  card.querySelector('.tutorial-next')!.addEventListener('click', () => {
    audio.click();
    haptic('light');
    card.remove();
    startGuide(host);
  });
  host.root.appendChild(card);
}

const STEP_NAMES = ['feed', 'collect', 'sell'];

function startGuide(host: TutorialHost): void {
  const { game, root } = host;
  const s = game.save;
  const q = (sel: string): HTMLElement | null => root.querySelector<HTMLElement>(sel);
  const rectOf = (el: HTMLElement | null): DOMRect | null => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 ? r : null;
  };
  const hungriest = () => game.fishes
    .filter((f) => f.tank === s.activeTank)
    .sort((a, b) => a.hunger - b.hunger)[0] ?? null;

  const fed0 = s.stats.totalFed;
  const coins0 = s.coins;
  const sold0 = s.stats.totalSold;

  const steps: Step[] = [
    {
      caption: () => {
        if (game.inputMode === 'feed') return tt('Tap the water near a fish to drop feed.');
        if (!q('#feed-pop')?.classList.contains('hidden')) return tt('Pick a feed.');
        return tt('Your fish are hungry. Tap Feed.');
      },
      target: () => {
        if (game.inputMode === 'feed') {
          const f = hungriest();
          return f ? game.fishScreenRect(f) : null;
        }
        if (!q('#feed-pop')?.classList.contains('hidden')) return rectOf(q('#feed-pop .feed-opt'));
        return rectOf(q('[data-care="feed"]'));
      },
      done: () => s.stats.totalFed > fed0,
    },
    {
      caption: () => tt('Your fish earn coins while you play. Tap Collect.'),
      target: () => rectOf(q('#collect-btn')),
      done: () => s.coins > coins0,
      skip: () => Math.floor(s.incomePot) < 1,
    },
    {
      caption: () => (game.firstAdult() || q('.sell'))
        ? tt('Your guppy is fully grown. Tap it, then sell it.')
        : tt('Your guppy is almost grown. One moment...'),
      target: () => {
        const sell = rectOf(q('.sell'));
        if (sell) return sell;
        const f = game.firstAdult();
        return f && game.inputMode === 'normal' ? game.fishScreenRect(f) : null;
      },
      done: () => s.stats.totalSold > sold0,
      // Nothing to sell if the player already sold every adult.
      skip: () => !game.firstAdult() && s.stats.totalSold > sold0,
    },
  ];

  const overlay = document.createElement('div');
  overlay.className = 'tut-guide';
  overlay.innerHTML = `
    <div class="tut-ring"><div class="tut-ring-pulse"></div></div>
    <div class="tut-hand">👆</div>
    <div class="tut-caption"><span></span><button class="tut-skip">${tt('Skip')}</button></div>`;
  root.appendChild(overlay);
  const ring = overlay.querySelector<HTMLElement>('.tut-ring')!;
  const hand = overlay.querySelector<HTMLElement>('.tut-hand')!;
  const captionEl = overlay.querySelector<HTMLElement>('.tut-caption span')!;

  let i = 0;
  let raf = 0;

  const finish = (skipped: boolean): void => {
    track('tutorial_complete', { skipped, step: i });
    cancelAnimationFrame(raf);
    overlay.remove();
    s.tutorialDone = true;
    game.syncSave();
    host.onFinish?.();
  };

  overlay.querySelector('.tut-skip')!.addEventListener('click', () => {
    audio.click();
    host.exitModes();
    finish(true);
  });

  const tick = (): void => {
    while (i < steps.length && steps[i].skip?.()) i++;
    if (i >= steps.length) {
      finish(false);
      host.toast(tt('You are all set. Quests will tell you what to do next.'));
      return;
    }
    const step = steps[i];
    if (step.done()) {
      haptic('success');
      track('ftue_step', { step: i + 1, name: STEP_NAMES[i] });
      if (game.inputMode === 'feed') host.exitModes();
      i++;
      raf = requestAnimationFrame(tick);
      return;
    }
    const text = step.caption();
    if (captionEl.textContent !== text) captionEl.textContent = text;
    const r = step.target();
    overlay.classList.toggle('no-target', !r);
    if (r) {
      const pad = 6;
      ring.style.transform = `translate(${r.left - pad}px, ${r.top - pad}px)`;
      ring.style.width = `${r.width + pad * 2}px`;
      ring.style.height = `${r.height + pad * 2}px`;
      hand.style.transform = `translate(${r.right - 14}px, ${r.bottom - 10}px)`;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
