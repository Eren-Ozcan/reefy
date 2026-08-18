/**
 * Biome marks. Unlike the UI icons in icons.ts these are illustrations rather than
 * affordances, so they stay raster: they carry more shape and colour than an inline
 * SVG of this size would be worth hand-authoring. Bundled at 72px, which covers the
 * ~20px they render at on a 3x screen.
 */
import type { Biome } from './tanks';

import cave from './icons/biome-cave.png';
import deep from './icons/biome-deep.png';
import lagoon from './icons/biome-lagoon.png';
import mystic from './icons/biome-mystic.png';
import polar from './icons/biome-polar.png';
import sunset from './icons/biome-sunset.png';
import tropical from './icons/biome-tropical.png';

const BIOME_ICON: Record<Biome, string> = {
  tropik: tropical,
  lagun: lagoon,
  derin: deep,
  magara: cave,
  kutup: polar,
  gunbatimi: sunset,
  mistik: mystic,
};

/** Markup for a biome mark, sized by the `.icon` rule like every other inline icon. */
export function biomeIcon(biome: Biome): string {
  return `<img class="icon biome-icon" src="${BIOME_ICON[biome]}" alt="" aria-hidden="true"/>`;
}
