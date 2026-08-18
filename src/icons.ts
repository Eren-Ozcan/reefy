/**
 * Inline SVG icons for the HUD and dock — the two places where an icon sits in
 * fixed-height chrome and repeats on every screen. Emoji are fine as inline
 * decoration in sentences, but as chrome they render at a different size and
 * baseline on every platform, which is what pushed the HUD chips out of line.
 *
 * Drawn in the same language as the app icon (tools/icon-src/fish-foreground.svg):
 * flat rounded shapes, no strokes, one soft highlight, no outlines.
 *
 * Currency icons carry their own colour because the colour is what identifies the
 * resource. Dock icons use currentColor so the active tab can tint them.
 */

const svg = (body: string, extra = ''): string =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"${extra}>${body}</svg>`;

// ---------- HUD currencies ----------

export const ICON_COIN = svg(
  `<circle cx="12" cy="12" r="9.5" fill="#E9992A"/>
   <circle cx="12" cy="11.4" r="8" fill="#FFC670"/>
   <ellipse cx="12" cy="10" rx="5.4" ry="4.4" fill="#FFE0A3" opacity="0.75"/>
   <path d="M9.6 15.2h4.8a.9.9 0 0 1 0 1.8H9.6a.9.9 0 0 1 0-1.8Z" fill="#E9992A" opacity="0.5"/>`,
);

export const ICON_PEARL = svg(
  `<circle cx="12" cy="12" r="9" fill="#9FC3D4"/>
   <circle cx="12" cy="11.5" r="7.6" fill="#EAF5FA"/>
   <ellipse cx="9.6" cy="9.2" rx="3" ry="2.2" fill="#FFFFFF" transform="rotate(-25 9.6 9.2)"/>
   <ellipse cx="14.6" cy="15" rx="2.4" ry="1.6" fill="#BDD9E6" opacity="0.7"/>`,
);

export const ICON_FISH = svg(
  `<path d="M8 12 3.4 7.6a11 11 0 0 1 0 8.8Z" fill="#1F8578"/>
   <ellipse cx="13.6" cy="12" rx="7.2" ry="5" fill="#35C4AC"/>
   <ellipse cx="14.4" cy="14" rx="4.2" ry="2.2" fill="#B8F0E5" opacity="0.6"/>
   <path d="M12.4 7.5a4 4 0 0 1 4.4-2.2 5.6 5.6 0 0 1-2.2 2.9Z" fill="#1F8578"/>
   <circle cx="17.8" cy="10.8" r="1.5" fill="#FFFFFF"/>
   <circle cx="18.2" cy="10.8" r="0.8" fill="#0E2E36"/>`,
);

// ---------- Dock ----------

export const ICON_FEED = svg(
  `<ellipse cx="7.4" cy="9" rx="3.3" ry="2.6" fill="currentColor" transform="rotate(-20 7.4 9)"/>
   <ellipse cx="15.6" cy="8.4" rx="2.9" ry="2.3" fill="currentColor" opacity="0.75" transform="rotate(15 15.6 8.4)"/>
   <ellipse cx="11.4" cy="15.4" rx="3.6" ry="2.8" fill="currentColor" opacity="0.9" transform="rotate(-8 11.4 15.4)"/>
   <ellipse cx="18" cy="15" rx="2.2" ry="1.8" fill="currentColor" opacity="0.55"/>`,
);

// A storefront rather than a cart or bag: the awning's scalloped edge is what
// separates it from the inventory pack at 24px, where a plain box reads as a bin.
export const ICON_SHOP = svg(
  `<rect x="4.6" y="10.6" width="14.8" height="10" rx="1.8" fill="currentColor" opacity="0.85"/>
   <rect x="9.6" y="14.2" width="4.8" height="6.4" rx="1" fill="#0E2E36" opacity="0.4"/>
   <path d="M3.2 4.4a1.2 1.2 0 0 1 1.2-1.2h15.2a1.2 1.2 0 0 1 1.2 1.2v3.4H3.2Z" fill="currentColor"/>
   <circle cx="4.7" cy="7.8" r="1.5" fill="currentColor"/>
   <circle cx="9.3" cy="7.8" r="1.5" fill="currentColor"/>
   <circle cx="13.9" cy="7.8" r="1.5" fill="currentColor"/>
   <circle cx="18.5" cy="7.8" r="1.5" fill="currentColor"/>`,
);

// Shoulder straps above the body, not a single arc handle — an arc over a rounded
// box reads as a padlock.
export const ICON_BAG = svg(
  `<rect x="8.2" y="3.2" width="2.6" height="5" rx="1.3" fill="currentColor" opacity="0.6"/>
   <rect x="13.2" y="3.2" width="2.6" height="5" rx="1.3" fill="currentColor" opacity="0.6"/>
   <rect x="4.2" y="6.6" width="15.6" height="14.2" rx="3.6" fill="currentColor" opacity="0.9"/>
   <path d="M4.2 10.2a3.6 3.6 0 0 1 3.6-3.6h8.4a3.6 3.6 0 0 1 3.6 3.6v2.6H4.2Z" fill="currentColor"/>
   <rect x="10" y="13.8" width="4" height="2.6" rx="1.3" fill="#0E2E36" opacity="0.4"/>`,
);

export const ICON_TROPHY = svg(
  `<path d="M6.2 3.4h11.6v5.8a5.8 5.8 0 0 1-11.6 0Z" fill="currentColor"/>
   <path d="M6.4 5.4H4.3a2.9 2.9 0 0 0 2.9 3.4M17.6 5.4h2.1a2.9 2.9 0 0 1-2.9 3.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.65"/>
   <rect x="10.7" y="14.2" width="2.6" height="3.6" fill="currentColor" opacity="0.85"/>
   <rect x="6.8" y="17.4" width="10.4" height="3" rx="1.5" fill="currentColor"/>`,
);

// The "you are here" tab: water line with a fish under it, not a house or a home
// glyph, because the tab returns you to the tank rather than to a start screen.
export const ICON_TANK = svg(
  `<rect x="2.6" y="4.6" width="18.8" height="14.8" rx="3.4" fill="currentColor" opacity="0.35"/>
   <path d="M2.6 10.4h18.8v5.6a3.4 3.4 0 0 1-3.4 3.4H6a3.4 3.4 0 0 1-3.4-3.4Z" fill="currentColor" opacity="0.8"/>
   <ellipse cx="13" cy="14.4" rx="3.6" ry="2.4" fill="currentColor"/>
   <path d="M9.6 14.4 7 12.2a5.4 5.4 0 0 1 0 4.4Z" fill="currentColor"/>`,
);

export const ICON_QUEST = svg(
  `<rect x="4.4" y="4" width="15.2" height="17" rx="2.6" fill="currentColor" opacity="0.85"/>
   <rect x="8.4" y="2.2" width="7.2" height="3.6" rx="1.8" fill="currentColor"/>
   <path d="m8.2 11.6 1.8 1.8 3.6-3.8" fill="none" stroke="#0E2E36" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>
   <rect x="8.2" y="15.6" width="7.6" height="1.8" rx="0.9" fill="#0E2E36" opacity="0.4"/>`,
);

export const ICON_YOU = svg(
  `<circle cx="12" cy="8.2" r="3.9" fill="currentColor"/>
   <path d="M4.4 20.4a7.6 7.6 0 0 1 15.2 0 1.2 1.2 0 0 1-1.2 1.2H5.6a1.2 1.2 0 0 1-1.2-1.2Z" fill="currentColor" opacity="0.85"/>`,
);

export const ICON_ARRANGE = svg(
  `<rect x="3" y="3" width="7.6" height="7.6" rx="2.2" fill="currentColor"/>
   <rect x="13.4" y="3" width="7.6" height="7.6" rx="2.2" fill="currentColor" opacity="0.6"/>
   <rect x="3" y="13.4" width="7.6" height="7.6" rx="2.2" fill="currentColor" opacity="0.6"/>
   <rect x="13.4" y="13.4" width="7.6" height="7.6" rx="2.2" fill="currentColor"/>`,
);

export const ICON_MENU = svg(
  `<rect x="4" y="6.2" width="16" height="2.6" rx="1.3" fill="currentColor"/>
   <rect x="4" y="10.7" width="16" height="2.6" rx="1.3" fill="currentColor"/>
   <rect x="4" y="15.2" width="16" height="2.6" rx="1.3" fill="currentColor"/>`,
);
