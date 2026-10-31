import type { FillPattern } from './types';
import { t } from './i18n';
import type { MessageKey } from './i18n';

/**
 * Shared color palette for the plugin.
 *
 * The "black" entry resolves to Obsidian's `--text-normal` so that it adapts
 * to light and dark themes (and exports as plain black). The others are CSS
 * variables (--etz-red, ...): by default the theme's own colours, so charts
 * look native and follow light and dark without redrawing; the setting
 * "Chart colours" pins the colours of the LaTeX export instead (styles.css).
 * The fallback is that export colour. Use `resolveCssColor` before passing a
 * value into any function that needs to do RGB math (e.g. surface shading).
 *
 * Key order is the swatch order (a 5 x 2 grid in the editor).
 */
export const COLOR_MAP: Record<string, string> = {
    black: 'var(--text-normal)',
    gray: 'var(--etz-gray, #7f8c8d)',
    red: 'var(--etz-red, #e74c3c)',
    orange: 'var(--etz-orange, #e67e22)',
    brown: 'var(--etz-brown, #a0522d)',
    green: 'var(--etz-green, #2ecc71)',
    teal: 'var(--etz-teal, #1abc9c)',
    blue: 'var(--etz-blue, #3498db)',
    purple: 'var(--etz-purple, #9b59b6)',
    magenta: 'var(--etz-magenta, #d63384)',
};

/**
 * Display names in the reader's language, read each time they are used: the
 * language is set when the plugin loads, after this module. The keys are
 * what charts store and stay as they are.
 */
function shownNames(keys: Record<string, MessageKey>): Record<string, string> {
    const names: Record<string, string> = {};
    for (const [value, key] of Object.entries(keys)) Object.defineProperty(names, value, { get: () => t(key), enumerable: true });
    return names;
}

/** Colour names of the swatch picker, per palette key. */
export const COLOR_OPTIONS: Record<string, string> = shownNames({
    black: 'build.color.black',
    gray: 'build.color.gray',
    red: 'build.color.red',
    orange: 'build.color.orange',
    brown: 'build.color.brown',
    green: 'build.color.green',
    teal: 'build.color.teal',
    blue: 'build.color.blue',
    purple: 'build.color.purple',
    magenta: 'build.color.magenta',
});

/**
 * TikZ colour per palette key. xcolor's own `red`, `green`, `teal`, ... are
 * very different from the preview hex values, so the exporter emits
 * `\definecolor{<name>}{HTML}{<hex>}` inside the tikzpicture for every
 * colour it uses and references `<name>`; the exported figure then matches
 * the preview. 'black' needs no definition.
 */
export const TIKZ_COLOR_DEFS: Record<string, { name: string; hex: string }> = {
    black: { name: 'black', hex: '000000' },
    gray: { name: 'etGray', hex: '7F8C8D' },
    red: { name: 'etRed', hex: 'E74C3C' },
    orange: { name: 'etOrange', hex: 'E67E22' },
    brown: { name: 'etBrown', hex: 'A0522D' },
    green: { name: 'etGreen', hex: '2ECC71' },
    teal: { name: 'etTeal', hex: '1ABC9C' },
    blue: { name: 'etBlue', hex: '3498DB' },
    purple: { name: 'etPurple', hex: '9B59B6' },
    magenta: { name: 'etMagenta', hex: 'D63384' },
};

/** Line thickness names, per stored thickness (the TikZ option). */
export const THICKNESS_OPTIONS: Record<string, string> = shownNames({
    'very thin': 'build.thickness.veryThin',
    thin: 'build.thickness.thin',
    thick: 'build.thickness.thick',
    'very thick': 'build.thickness.veryThick',
});

/** A fill pattern choice whose text is read when the menu is built. */
function patternOption(value: FillPattern, key: MessageKey): { value: FillPattern; text: string } {
    return {
        value,
        get text() {
            return t(key);
        },
    };
}

/** Fill pattern choices, shared by the function and region cards. */
export const FILL_PATTERN_OPTIONS: { value: FillPattern; text: string }[] = [
    patternOption('solid', 'build.pattern.solid'),
    patternOption('horizontal', 'build.pattern.horizontal'),
    patternOption('vertical', 'build.pattern.vertical'),
    patternOption('crosshatch', 'build.pattern.crosshatch'),
    patternOption('dots', 'build.pattern.dots'),
    patternOption('north-east', 'build.pattern.northEast'),
    patternOption('north-west', 'build.pattern.northWest'),
];

export const THICKNESS_MAP: Record<string, number> = {
    'very thin': 1,
    thin: 1.5,
    thick: 2.5,
    'very thick': 3.5,
};

/** A hidden element of the active window whose computed colour turns any CSS colour into rgb(). */
let probe: HTMLElement | null = null;

/**
 * Resolve a CSS color value to a concrete `rgb(...)` or hex string: a
 * variable (also nested, with its fallback), hsl(), a name, whatever the
 * theme uses. Falls back to the input string outside a document.
 */
export function resolveCssColor(cssValue: string): string {
    if (!cssValue) return cssValue;
    if (cssValue.startsWith('#') || cssValue.startsWith('rgb')) return cssValue;
    if (typeof activeDocument === 'undefined' || !activeDocument.body) return cssValue;
    if (!probe || !probe.isConnected || probe.ownerDocument !== activeDocument) {
        probe?.remove();
        probe = activeDocument.body.createDiv({ cls: 'etz-color-probe', attr: { 'aria-hidden': 'true' } });
    }
    probe.setCssProps({ '--etz-probe': cssValue });
    const resolved = getComputedStyle(probe).color.trim();
    return resolved || cssValue;
}

/** `#rgb`, `#rrggbb` or `rgb(r, g, b)` as 0..255 channels, else null. */
function parseColor(c: string): [number, number, number] | null {
    const s = String(c ?? '').trim();
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
    if (hex) {
        const h = hex[1].length === 3 ? hex[1].replace(/./g, (d) => d + d) : hex[1];
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
    return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

/**
 * `a` mixed with `b` (t = 0 gives a, 1 gives b), channel by channel in
 * sRGB, as `#rrggbb`. Accepts hex or rgb() (resolveCssColor output);
 * returns `a` unchanged when either colour cannot be read.
 */
export function mixHex(a: string, b: string, t: number): string {
    const ca = parseColor(a);
    const cb = parseColor(b);
    if (!ca || !cb) return a;
    const k = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0;
    const ch = (i: number) =>
        Math.round(ca[i] + (cb[i] - ca[i]) * k)
            .toString(16)
            .padStart(2, '0');
    return `#${ch(0)}${ch(1)}${ch(2)}`;
}
