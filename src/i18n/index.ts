/*
 * The interface in the reader's language. Every text the plugin shows has a
 * key; English (src/i18n/en) is the source and the fallback, and every other
 * language (src/i18n/ja) has the same keys. t(key, values) fills named
 * places ({name}) and plural forms ({count, plural, one {# chart} other
 * {# charts}}, where # is the number), so a translation can put a value
 * where its own word order wants it.
 *
 * The language follows Obsidian's own (main.ts reads getLanguage()) unless
 * the setting fixes one; a language with no translation shows English.
 * Formulas, chart words, the exported TikZ and what the AI server answers
 * stay English (inEnglish). Pure apart from the language state, so the
 * tests run it in node, in English.
 */
import { EN, MessageKey } from './en';
import { JA } from './ja';

export type { MessageKey };

/** Languages the interface has. */
export type Language = 'en' | 'ja';

/** The setting: follow Obsidian ('auto'), or one language. */
export type LanguageSetting = 'auto' | Language;

/** Each language in its own words, for the setting's list. */
export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = { en: 'English', ja: '日本語' };

const CATALOGS: Readonly<Record<Language, Readonly<Partial<Record<MessageKey, string>>>>> = { en: EN, ja: JA };

let current: Language = 'en';

/** The language texts are shown in now. */
export function language(): Language {
    return current;
}

export function setLanguage(lang: Language): void {
    current = lang;
}

/** A stored setting, read defensively: anything unknown follows Obsidian. */
export function languageSetting(value: unknown): LanguageSetting {
    return value === 'en' || value === 'ja' ? value : 'auto';
}

/**
 * The language for a setting and Obsidian's language code ('en', 'ja',
 * 'zh-TW', ...): the setting's own, or Obsidian's when there is a
 * translation for it, else English.
 */
export function resolveLanguage(setting: LanguageSetting, obsidian: string | null | undefined): Language {
    if (setting !== 'auto') return setting;
    const code = String(obsidian ?? '').toLowerCase();
    return code === 'ja' || code.startsWith('ja-') ? 'ja' : 'en';
}

/** Run fn with English texts (the AI server's answers, anything written for a machine), then go back. */
export function inEnglish<T>(fn: () => T): T {
    const was = current;
    current = 'en';
    try {
        return fn();
    } finally {
        current = was;
    }
}

export type MessageValues = Readonly<Record<string, string | number>>;

/** The text of a key in the current language (English where it has none), with its values filled in. */
export function t(key: MessageKey, values?: MessageValues): string {
    const own = CATALOGS[current][key];
    return format(own ?? EN[key] ?? key, values);
}

/** Like t, in a given language. */
export function tIn(lang: Language, key: MessageKey, values?: MessageValues): string {
    const own = CATALOGS[lang][key];
    return format(own ?? EN[key] ?? key, values);
}

/**
 * Fill a message: plural forms first ({n, plural, one {...} other {...}},
 * also =0 {...}), then named places. A place with no value stays as it is
 * written, so a literal {level} in a hint (a label template of the chart
 * language) shows as typed.
 */
export function format(message: string, values?: MessageValues): string {
    let out = message;
    if (values && out.includes(', plural,')) out = plurals(out, values);
    if (!values) return out;
    return out.replace(/\{(\w+)\}/g, (whole, name: string) => (Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : whole));
}

/** The plural blocks of a message, each replaced by its form for the value it names. */
function plurals(message: string, values: MessageValues): string {
    let out = '';
    let i = 0;
    for (;;) {
        const head = /\{(\w+), plural,/g;
        head.lastIndex = i;
        const m = head.exec(message);
        if (!m) return out + message.slice(i);
        const forms = pluralForms(message, m.index + m[0].length);
        if (!forms) return out + message.slice(i);
        out += message.slice(i, m.index);
        const n = Number(values[m[1]]);
        const exact = forms.cases.get(`=${n}`);
        const form = exact ?? (n === 1 && forms.cases.has('one') ? forms.cases.get('one') : forms.cases.get('other')) ?? '';
        out += form.replace(/#/g, Number.isFinite(n) ? String(n) : String(values[m[1]]));
        i = forms.end;
    }
}

/** The cases of a plural block starting at `from` (after "plural,"): { cases, end } with end after its closing brace, or null. */
export function pluralForms(message: string, from: number): { cases: Map<string, string>; end: number } | null {
    const cases = new Map<string, string>();
    let i = from;
    for (;;) {
        while (message[i] === ' ') i++;
        if (message[i] === '}') return cases.size ? { cases, end: i + 1 } : null;
        const sel = /^(=\d+|zero|one|two|few|many|other)\s*\{/.exec(message.slice(i));
        if (!sel) return null;
        let depth = 1;
        let j = i + sel[0].length;
        const start = j;
        for (; j < message.length && depth > 0; j++) {
            if (message[j] === '{') depth++;
            else if (message[j] === '}') depth--;
        }
        if (depth !== 0) return null;
        cases.set(sel[1], message.slice(start, j - 1));
        i = j;
    }
}

/** The named places of a message ({name}, and the value a plural block counts), for the tests. */
export function placesOf(message: string): string[] {
    const names = new Set<string>();
    for (const m of message.matchAll(/\{(\w+), plural,/g)) names.add(m[1]);
    for (const m of message.matchAll(/\{(\w+)\}/g)) names.add(m[1]);
    return [...names].sort();
}
