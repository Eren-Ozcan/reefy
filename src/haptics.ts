import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/** Mirrors `save.haptics`; set from main.ts and the Settings toggle. */
let enabled = true;
let lastKind: HapticKind | null = null;
let lastAt = 0;

export function setHaptics(on: boolean): void {
  enabled = on;
}

/**
 * One short buzz per action. Native only: `navigator.vibrate` on the web build is
 * a long, buzzy pulse that feels worse than none. The same kind is dropped if it
 * repeats inside 50 ms, so a burst of coins landing doesn't turn into a drone.
 */
export function haptic(kind: HapticKind): void {
  if (!enabled || !Capacitor.isNativePlatform()) return;
  const now = performance.now();
  if (kind === lastKind && now - lastAt < 50) return;
  lastKind = kind;
  lastAt = now;
  const p = (() => {
    switch (kind) {
      case 'light': return Haptics.impact({ style: ImpactStyle.Light });
      case 'medium': return Haptics.impact({ style: ImpactStyle.Medium });
      case 'heavy': return Haptics.impact({ style: ImpactStyle.Heavy });
      case 'success': return Haptics.notification({ type: NotificationType.Success });
      case 'warning': return Haptics.notification({ type: NotificationType.Warning });
      case 'error': return Haptics.notification({ type: NotificationType.Error });
    }
  })();
  // A device without a vibrator rejects; that is not worth surfacing.
  p.catch(() => undefined);
}
