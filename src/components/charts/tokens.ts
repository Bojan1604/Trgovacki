/**
 * Boje grafikona.
 *
 * Preuzete iz validirane referentne palete (provjereno skriptom validatora za
 * svijetlu i tamnu podlogu: pojas svjetline, minimalna kroma, razdvojenost za
 * daltoniste ≥ 8 ΔE i normalni vid ≥ 15 ΔE).
 * Slotovi se dodjeljuju redom i nikad se ne recikliraju — 4. serija ide u
 * "Ostalo" ili u zaseban grafikon.
 */

export const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a'] as const;
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70'] as const;

/** CSS varijable se postavljaju u globalnom stilu grafikona (vidi chart-theme.css). */
export const SERIES_VARS = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)'] as const;

export const GRID = 'var(--color-hairline)';
export const AXIS_TEXT = 'var(--color-ink-3)';

/** Statusne boje su rezervirane i ne koriste se kao serija podataka. */
export const STATUS = {
  good: 'var(--color-positive)',
  warning: 'var(--color-warning)',
  critical: 'var(--color-negative)',
} as const;
