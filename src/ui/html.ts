import type { Command } from '../game/types';

export const esc = (value: unknown): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
export const number = (value: number): string => new Intl.NumberFormat('zh-CN').format(value);
export const signed = (value: number): string =>
  `${value >= 0 ? '+' : '−'}${number(Math.abs(value))}`;
const paths: Record<string, string> = {
  orbit:
    '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="11" ry="5" transform="rotate(-35 12 12)"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  atom: '<circle cx="12" cy="12" r="1"/><ellipse cx="12" cy="12" rx="11" ry="4"/><ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(120 12 12)"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0112 0v3M16 5a3 3 0 010 6M18 14a5 5 0 013 5v2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-8 10-8 10S4 17 4 12V6zM9 12l2 2 4-5"/>',
  signal:
    '<path d="M8 8a6 6 0 000 8M16 8a6 6 0 010 8M4 4a11 11 0 000 16M20 4a11 11 0 010 16"/><circle cx="12" cy="12" r="1"/>',
  book: '<path d="M3 4h6l3 2 3-2h6v16h-6l-3 2-3-2H3zM12 6v16"/>',
  settings:
    '<circle cx="12" cy="12" r="4"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4M4 4l3 3m10 10 3 3M4 20l3-3M17 7l3-3"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  close: '<path d="M5 5l14 14M19 5L5 19"/>',
  save: '<path d="M4 3h13l4 4v14H3V3zM7 3v6h10V3M7 21v-8h10v8"/>',
  volume: '<path d="M3 9h4l5-5v16l-5-5H3zM16 8a6 6 0 010 8M19 4a11 11 0 010 16"/>',
  star: '<path d="M12 2l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z"/>',
  factory: '<path d="M3 21V9l7 4V9l7 4V3h4v18zM6 17h2m4 0h2m3 0h2"/>',
  pickaxe: '<path d="M3 3c9-2 14 2 18 9L12 8 3 21l-2-2L10 6z"/>',
  landmark: '<path d="M2 8l10-6 10 6zM4 10v9m5-9v9m6-9v9m5-9v9M2 22h20"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="1"/><path d="M8 10V6a4 4 0 018 0v4M12 14v3"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  telescope: '<path d="M2 10l15-7 4 8-15 7zM11 16l-4 6m5-6 5 6"/>',
};
export function icon(name: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.orbit}</svg>`;
}
export function command(
  label: string,
  cmd: Command,
  options: { class?: string; disabled?: string | null; icon?: string } = {},
): string {
  return `<button type="button" class="${esc(options.class ?? 'command')}" data-command="${esc(JSON.stringify(cmd))}" ${options.disabled ? `disabled title="${esc(options.disabled)}"` : ''}>${options.icon ? icon(options.icon) : ''}<span>${esc(label)}</span></button>`;
}
export function button(
  label: string,
  action: string,
  className = 'command',
  glyph?: string,
): string {
  return `<button type="button" class="${esc(className)}" data-action="${esc(action)}">${glyph ? icon(glyph) : ''}<span>${esc(label)}</span></button>`;
}
export function meter(value: number, max: number, label: string, className = ''): string {
  return `<div class="meter ${className}" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${Math.max(1, max)}" aria-valuenow="${Math.min(max, Math.max(0, value))}"><i style="width:${Math.min(100, Math.max(0, (value / Math.max(1, max)) * 100))}%"></i></div>`;
}
export function empty(title: string, text: string): string {
  return `<div class="empty">${icon('orbit')}<h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
}
export function heading(kicker: string, title: string, description: string): string {
  return `<header class="panel-heading"><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(description)}</p></header>`;
}
