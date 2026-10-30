/*
 * Problem text shared by the editor's status chip and the problem line
 * under charts in notes: both format the same SceneIssue list. Pure, so
 * tests can load it.
 */
import type { SceneIssue } from './scene';
import { errorText } from './util';
import { MessageKey, t } from './i18n';

/** Field ids whose name reads as a word (the rest, such as x, xmin or y(t), are shown as they are). */
const FIELD_WORDS: Record<string, MessageKey> = {
    tangentPoint: 'problems.field.tangentPoint',
    xDomain: 'problems.field.xDomain',
    yDomain: 'problems.field.yDomain',
    domain: 'problems.field.domain',
    equation: 'problems.field.equation',
    levels: 'problems.field.levels',
    points: 'problems.field.points',
    path: 'problems.field.path',
    objective: 'problems.field.objective',
    value: 'problems.field.value',
    label: 'problems.field.label',
    text: 'problems.field.text',
    title: 'problems.field.title',
};

/**
 * A SceneIssue field id in words ('' when the location needs none).
 * 'condition:N' and 'conditionLabel:N' are 0-based, people count from 1.
 * The expression and the reference fields (regionName, ref1, ref2) get no
 * words: the source ('f1: ...') or the message ('R2 is empty
 * (infeasible)', 'Q does not exist') already says where.
 */
function fieldText(field: string | undefined): string {
    if (!field || field === 'expression' || field === 'regionName' || field === 'ref1' || field === 'ref2') return '';
    const condition = /^condition(Label)?:(\d+)$/.exec(field);
    if (condition) return t(condition[1] ? 'problems.where.conditionLabel' : 'problems.where.condition', { n: Number(condition[2]) + 1 });
    if (field === 'expressionY') return 'y(t)';
    const word = Object.prototype.hasOwnProperty.call(FIELD_WORDS, field) ? FIELD_WORDS[field] : undefined;
    // Names that are plain already: x, y, z, xmin, ...
    return word ? t(word) : field;
}

/** 'objective is unbounded ...' starts with the field's name; 'objectives ...' does not. */
function startsWithWord(message: string, word: string): boolean {
    return message.toLowerCase().startsWith(word.toLowerCase()) && !/[a-z0-9]/i.test(message.charAt(word.length));
}

/**
 * The message after a 'where: ' prefix (`where` being a source, a field or
 * an entry such as 'condition 2'), or null when it does not start so. The
 * prefix is written with the template that wrote it (problems.issue.at);
 * the English ': ' also counts, as range errors of resolveView keep it.
 */
function afterPrefix(message: string, where: string): string | null {
    for (const prefix of [t('problems.issue.at', { where, message: '' }), `${where}: `]) {
        if (message.startsWith(prefix)) return message.slice(prefix.length);
    }
    return null;
}

/** The entry a point-list message names ('point 2' of 'point 2: ...'), or null. */
function pointEntry(message: string): string | null {
    const m = /^\D*?(\d+)/.exec(message);
    if (!m) return null;
    const where = t('problems.where.point', { n: Number(m[1]) });
    return afterPrefix(message, where) !== null ? where : null;
}

/** 'chart' -> 'Chart', 'label:2' -> 'Label 3' (annotations), tool / function names as they are. */
function issueSource(source: string): string {
    if (source === 'chart') return t('problems.issue.chart');
    const label = /^label:(\d+)$/.exec(source);
    return label ? t('problems.issue.label', { n: Number(label[1]) + 1 }) : source;
}

/**
 * Source and field as one location: 'R1 condition 2', 'Chart title'. A
 * space the template leaves between two characters that are not Latin is
 * dropped ('グラフ の タイトル' reads 'グラフのタイトル'); one next to a
 * name or a number stays ('R1 の条件 2').
 */
function whereText(source: string, field: string): string {
    if (!source || !field) return source || field;
    return t('problems.issue.where', { source, field }).replace(/([\u3000-\u303f\u3040-\u30ff\u4e00-\u9fff\uff00-\uffef]) (?=[\u3000-\u303f\u3040-\u30ff\u4e00-\u9fff\uff00-\uffef])/g, '$1');
}

/**
 * One line per issue, naming source, field and problem once each:
 * 'R1 condition 2: Unknown name k' (the message's own 'condition 2: '
 * moves into the location), 'P1 point 1: ...', 'P1: objective is unbounded
 * on R1' (the message names its field), 'Chart xmax: ...', 'Label 3 x: ...'.
 * Without a separator the line is written as the language writes it
 * ('where: message'); a separator (' · ') joins them as given.
 */
export function issueText(issue: SceneIssue, separator?: string): string {
    let message = issue.message;
    const own = afterPrefix(message, issue.source);
    if (own !== null) message = own;
    let field = fieldText(issue.field);
    // Point lists name the entry: 'point 2: ...'.
    const entry = issue.field === 'points' ? pointEntry(message) : null;
    if (entry) field = entry;
    const rest = field ? afterPrefix(message, field) : null;
    if (rest !== null) message = rest;
    else if (field && startsWithWord(message, field)) field = '';
    const where = whereText(issueSource(issue.source), field);
    if (!where) return message;
    return separator === undefined ? t('problems.issue.at', { where, message }) : `${where}${separator}${message}`;
}

/**
 * Add the axis-range fallbacks of resolveView ('xmax: Unknown name b') that
 * the renderer did not report itself. z ranges only count in 3D.
 */
export function mergeViewErrors(issues: SceneIssue[], resolveErrors: () => string[], is3D: boolean): SceneIssue[] {
    const out = issues.slice();
    let errors: string[];
    try {
        errors = resolveErrors();
    } catch (e) {
        errors = [t('problems.issue.rangesFailed', { error: errorText(e) })];
    }
    for (const text of errors) {
        const m = /^([xyz](?:min|max))\s*[:：]\s*/.exec(text);
        const field = m ? m[1] : undefined;
        if (field && field.startsWith('z') && !is3D) continue;
        const known = out.some((i) => i.source === 'chart' && (i.message === text || (field !== undefined && i.field === field)));
        if (!known) out.push({ source: 'chart', field, message: text, severity: 'error' });
    }
    return out;
}
