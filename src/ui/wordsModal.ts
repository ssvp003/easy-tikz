/*
 * Chart words, edited: one field per piece of the chart language, by group,
 * with the words a person gives it; words of their own for several options
 * at once; and their words as text to share (copy) or to take over (paste
 * into the box). Every word is checked as it is typed (a word belongs to one
 * piece, and never to a name formulas use). Closing saves; main.ts then
 * offers to rewrite charts that used words that changed (src/text/reword.ts).
 */
import { App, Modal } from 'obsidian';
import { parseChartText } from '../text/parse';
import { Bundle, ChartWords, GROUP_TITLES, PIECES, WordGroup, clean, wordProblem, wordsFromText, wordsToText } from '../text/words';
import { textButton, uniqueId } from './kit';
import { MessageKey, t } from '../i18n';

export interface WordsHost {
    /** The words now. */
    words(): ChartWords;
    /** Called once when the window closes with changed words. */
    changed(before: ChartWords, after: ChartWords): void;
    /** Copy text and say so. */
    copy(text: string, done: string): void;
}

const GROUPS: WordGroup[] = ['lines', 'phrases', 'options', 'colours'];

/** Texts in a row, joined the way `key` joins two ('{first}; {second}'): languages differ in what goes between. */
function joinTexts(key: MessageKey, texts: string[]): string {
    return texts.reduce((all, text) => (all ? t(key, { first: all, second: text }) : text), '');
}

export class ChartWordsModal extends Modal {
    private readonly host: WordsHost;
    private before: ChartWords;
    private draft: ChartWords;
    private listEl!: HTMLElement;
    private bundlesEl!: HTMLElement;
    private search = '';

    constructor(app: App, host: WordsHost) {
        super(app);
        this.host = host;
        this.before = clean(host.words());
        this.draft = clean(host.words());
    }

    onOpen() {
        this.modalEl.addClass('etz-words', 'etz-tokens');
        this.titleEl.setText(t('panels.words.title'));
        const { contentEl } = this;
        contentEl.createEl('p', {
            cls: 'etz-words-intro',
            text: t('panels.words.intro'),
        });
        const find = contentEl.createEl('input', { cls: 'etz-words-find', type: 'search', attr: { placeholder: t('panels.words.find'), 'aria-label': t('panels.words.find') } });
        find.addEventListener('input', () => {
            this.search = find.value.trim().toLowerCase();
            this.filter();
        });
        this.listEl = contentEl.createDiv({ cls: 'etz-words-groups' });
        this.renderPieces();

        const bundles = contentEl.createEl('section', { cls: 'etz-words-bundles' });
        const bundlesTitle = bundles.createEl('h3', { cls: 'etz-words-h', text: t('panels.words.bundles') });
        bundlesTitle.id = uniqueId('words-bundles');
        bundles.setAttr('aria-labelledby', bundlesTitle.id);
        bundles.createEl('p', { cls: 'etz-words-hint', text: t('panels.words.bundlesHint') });
        this.bundlesEl = bundles.createDiv({ cls: 'etz-words-bundle-rows' });
        this.renderBundles();
        textButton(bundles, {
            text: t('panels.words.addBundle'),
            size: 'sm',
            onClick: () => {
                this.draft.bundles.push({ word: '', means: '' });
                this.renderBundles();
                this.bundlesEl.querySelector<HTMLInputElement>('.etz-words-bundle:last-child input')?.focus();
            },
        });

        const share = contentEl.createEl('section', { cls: 'etz-words-share' });
        const shareTitle = share.createEl('h3', { cls: 'etz-words-h', text: t('panels.words.share') });
        shareTitle.id = uniqueId('words-share');
        share.setAttr('aria-labelledby', shareTitle.id);
        share.createEl('p', { cls: 'etz-words-hint', text: t('panels.words.shareHint') });
        const row = share.createDiv({ cls: 'etz-words-share-row' });
        textButton(row, { text: t('panels.words.copy'), size: 'sm', onClick: () => this.host.copy(wordsToText(clean(this.draft)), t('panels.words.copied')) });
        const box = share.createEl('textarea', { cls: 'etz-words-paste', attr: { rows: '4', placeholder: t('panels.words.pastePlaceholder'), 'aria-label': t('panels.words.pasteLabel') } });
        const note = share.createDiv({ cls: 'etz-words-note', attr: { role: 'status' } });
        textButton(share, {
            text: t('panels.words.takeOver'),
            size: 'sm',
            onClick: () => {
                const read = wordsFromText(box.value, this.draft.write);
                note.setText(read.problems.length ? t('panels.words.notRead', { problems: joinTexts('panels.words.problemList', read.problems) }) : '');
                this.draft = read.words;
                this.renderPieces();
                this.renderBundles();
                this.filter();
            },
        });

        const actions = contentEl.createDiv({ cls: 'etz-dialog-actions' });
        textButton(actions, { text: t('common.done'), variant: 'cta', onClick: () => this.close() });
    }

    onClose() {
        const after = clean(this.draft);
        this.contentEl.empty();
        if (JSON.stringify(after) !== JSON.stringify(this.before)) this.host.changed(this.before, after);
    }

    /** The draft without one piece's words (or one bundle): what a word is checked against. */
    private others(id: string | null, bundle?: Bundle): ChartWords {
        const words = { ...this.draft.words };
        if (id) delete words[id];
        return { words, bundles: this.draft.bundles.filter((b) => b !== bundle && b.word), write: this.draft.write };
    }

    private renderPieces() {
        this.listEl.empty();
        for (const group of GROUPS) {
            const box = this.listEl.createEl('section', { cls: 'etz-words-group' });
            const h = box.createEl('h3', { cls: 'etz-words-h', text: t(GROUP_TITLES[group]) });
            h.id = uniqueId('words-group');
            box.setAttr('aria-labelledby', h.id);
            for (const p of PIECES.filter((x) => x.group === group)) {
                const description = t(p.what);
                const row = box.createDiv({ cls: 'etz-words-piece', attr: { 'data-find': `${p.builtin} ${description}`.toLowerCase() } });
                const what = row.createDiv({ cls: 'etz-words-what' });
                what.createEl('code', { text: p.builtin });
                what.createSpan({ text: description });
                const input = row.createEl('input', {
                    type: 'text',
                    value: (this.draft.words[p.id] ?? []).join(', '),
                    attr: { placeholder: p.builtin, 'aria-label': t('panels.words.yourWordsFor', { word: p.builtin }), spellcheck: 'false' },
                });
                const note = row.createDiv({ cls: 'etz-words-note', attr: { role: 'status' } });
                input.addEventListener('change', () => {
                    const others = this.others(p.id);
                    const kept: string[] = [];
                    const problems: string[] = [];
                    for (const w of input.value.split(',').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean)) {
                        const why = wordProblem(w, p.id, { ...others, words: { ...others.words, [p.id]: kept } });
                        if (why) problems.push(why);
                        else kept.push(w);
                    }
                    if (kept.length) this.draft.words[p.id] = kept;
                    else delete this.draft.words[p.id];
                    note.setText(joinTexts('panels.words.sentences', problems));
                    input.toggleClass('is-bad', problems.length > 0);
                    row.setAttr('data-find', `${p.builtin} ${description} ${kept.join(' ')}`.toLowerCase());
                });
            }
        }
        this.filter();
    }

    private renderBundles() {
        this.bundlesEl.empty();
        for (const b of this.draft.bundles) {
            const row = this.bundlesEl.createDiv({ cls: 'etz-words-bundle' });
            const word = row.createEl('input', { type: 'text', value: b.word, attr: { placeholder: t('panels.words.bundleWord'), 'aria-label': t('panels.words.bundleWordLabel'), spellcheck: 'false' } });
            const means = row.createEl('input', { type: 'text', value: b.means, attr: { placeholder: t('panels.words.means'), 'aria-label': t('panels.words.meansLabel'), spellcheck: 'false' } });
            textButton(row, {
                text: t('common.remove'),
                size: 'sm',
                onClick: () => {
                    this.draft.bundles = this.draft.bundles.filter((x) => x !== b);
                    this.renderBundles();
                },
            });
            const note = row.createDiv({ cls: 'etz-words-note', attr: { role: 'status' } });
            const check = () => {
                const w = word.value.trim().replace(/\s+/g, ' ');
                const why = w ? wordProblem(w, null, this.others(null, b)) : '';
                b.word = why ? '' : w;
                b.means = means.value.trim();
                // What it stands for must read as options of a line, in these words.
                let wrong = '';
                if (b.word && b.means) {
                    const probe = parseChartText(`plot q(x) = x, ${b.word}`, { words: clean(this.draft) });
                    if (probe.problems.length) wrong = t('panels.words.notOptions', { means: b.means, message: probe.problems[0].message });
                }
                note.setText(joinTexts('panels.words.sentences', [why, wrong].filter(Boolean)));
                word.toggleClass('is-bad', !!why);
                means.toggleClass('is-bad', !!wrong);
            };
            word.addEventListener('change', check);
            means.addEventListener('change', check);
        }
    }

    private filter() {
        const q = this.search;
        for (const row of Array.from(this.listEl.querySelectorAll<HTMLElement>('.etz-words-piece'))) {
            row.toggleClass('tikz-hidden', !!q && !(row.getAttribute('data-find') ?? '').includes(q));
        }
        for (const group of Array.from(this.listEl.querySelectorAll<HTMLElement>('.etz-words-group'))) {
            group.toggleClass('tikz-hidden', !group.querySelector('.etz-words-piece:not(.tikz-hidden)'));
        }
    }
}
