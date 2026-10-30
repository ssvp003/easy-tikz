/*
 * Every user-facing string of drag to edit (SPEC3 1.8, 1.11): hover, lock,
 * live and tip chips, undo bar labels, announcements, and the names of the
 * parts a drag grabs ('R1 condition 2', 'Label 1'). Pure: no DOM, no
 * Obsidian. The session and the modal build data; only this file words it,
 * in the reader's language (src/i18n, keys 'editor.*').
 */
import { formatFixed, formatNumber } from '../expr';
import { format, language, t, tIn } from '../i18n';
import type { MessageKey, MessageValues } from '../i18n';
import type { Chip, ChipPart, DragNumber, DragTarget, Gesture, HitShape, Lock, Restriction, VirtualKind } from './types';

// ------------------------------------------------------------- language

/** Japanese characters and full-width punctuation: no space stands between two of them. */
const WIDE = /[\u3000-\u303f\u3040-\u30ff\u4e00-\u9fff\uff00-\uffef]/;
const PLACE_THEN_WIDE = /\{(\w+)\} (?=[\u3000-\u303f\u3040-\u30ff\u4e00-\u9fff\uff00-\uffef])/g;
const WIDE_THEN_PLACE = /([\u3000-\u303f\u3040-\u30ff\u4e00-\u9fff\uff00-\uffef]) \{(\w+)\}/g;

/**
 * t() for the texts of this file. A name put into a text may itself end or
 * start in Japanese ('f1 の接線', 'P1 の目的関数'): the template's space
 * between it and a Japanese word goes then ('f1 の接線を移動', not
 * 'f1 の接線 を移動'). English texts are exactly t()'s.
 */
function say(key: MessageKey, values?: MessageValues): string {
    const lang = language();
    if (!values || lang === 'en') return t(key, values);
    const wide = (ch: string | undefined) => !!ch && WIDE.test(ch);
    const value = (name: string): string => (Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : '');
    const message = tIn(lang, key)
        .replace(PLACE_THEN_WIDE, (whole, name: string) => (wide(value(name).slice(-1)) ? `{${name}}` : whole))
        .replace(WIDE_THEN_PLACE, (whole, before: string, name: string) => (wide(value(name).charAt(0)) ? `${before}{${name}}` : whole));
    return format(message, values);
}

// ------------------------------------------------------------- constants

/** Help and tooltip copy of the core rule (SPEC3 1.1), in English (read by the tests); coreRule() is in the reader's language. */
export const CORE_RULE = tIn('en', 'editor.drag.coreRule');

/** aria-label of the chart preview while dragging is on (SPEC3 1.8), in English; chartLabel() is in the reader's language. */
export const CHART_LABEL = tIn('en', 'editor.drag.chartLabel');

export function coreRule(): string {
    return say('editor.drag.coreRule');
}

export function chartLabel(): string {
    return say('editor.drag.chartLabel');
}

/** Pill toggle label (SPEC3 1.12). */
export function toggleLabel(): string {
    return say('editor.drag.toggle');
}

/** Undo bar buttons. */
export function undoButton(): string {
    return t('common.undo');
}

export function makeSliderButton(): string {
    return say('editor.undo.makeSlider');
}

/** Longest chip text (characters) before it is cut around the first highlighted part. */
const MAX_TEXT = 48;
const ELLIPSIS = '…';
const MAX_NAMES = 3;

// ----------------------------------------------------------------- names

/** 'Label 2' for the label at `index` (counted from 0, shown from 1). */
export function labelName(index: number): string {
    return say('editor.drag.label', { n: index + 1 });
}

/** 'f1 tangent'. */
export function tangentName(fn: string): string {
    return say('editor.drag.tangent', { name: fn });
}

/** 'R1 condition 2' for condition `entry` (counted from 0) of region `name`. */
export function conditionName(name: string, entry: number): string {
    return say('editor.drag.condition', { name, n: entry + 1 });
}

/** 'C1 level 3.2' (a level's value, or its number when it has none). */
export function levelName(name: string, level: string | number): string {
    return say('editor.drag.level', { name, level });
}

/** 'P1 point 2' for point `index` (counted from 0) of `name`. */
export function pointName(name: string, index: number): string {
    return say('editor.drag.point', { name, n: index + 1 });
}

/** "P1's objective": a points tool's objective that changes with a curve. */
export function objectiveName(name: string): string {
    return say('editor.drag.objective', { name });
}

// ----------------------------------------------------------------- locks

export type LockReason =
    | { kind: 'optimum'; point: string; objective: string; region: string; sense: 'max' | 'min'; twinCurve: string | null }
    | { kind: 'intersection'; point: string; a: string; b: string }
    | { kind: 'corner'; point: string; region: string }
    | { kind: 'lattice'; point: string; region: string | null }
    | { kind: 'derivedClause'; region: string; name: string; tool: string }
    | { kind: 'derivedLevel'; curve: string; name: string; tool: string }
    | { kind: 'keywordTangent'; fn: string; keyword: string }
    | { kind: 'derivedTangent'; fn: string; name: string; tool: string }
    | { kind: 'splicedVertex'; segment: string; index: number; from: string; fromIsList: boolean }
    | { kind: 'splicedPath'; segment: string; from: string }
    | { kind: 'curveKind'; fn: string; fnKind: 'parametric' | 'polar' }
    | { kind: 'nothing'; subject: string }
    | { kind: 'axisSlider'; name: string }
    | { kind: 'cannotDragHere'; subject: string };

export function lockFor(reason: LockReason): Lock {
    switch (reason.kind) {
        case 'optimum': {
            const { point, objective, region } = reason;
            return {
                title: say(reason.sense === 'min' ? 'editor.lock.optimumMin' : 'editor.lock.optimumMax', { point, objective, region }),
                detail: reason.twinCurve ? say('editor.lock.dragLinesOr', { region, curve: reason.twinCurve }) : say('editor.lock.dragLines', { region }),
            };
        }
        case 'intersection':
            return {
                title: say('editor.lock.intersection', { point: reason.point, a: reason.a, b: reason.b }),
                detail: say('editor.lock.dragEither', { a: reason.a, b: reason.b }),
            };
        case 'corner':
            return { title: say('editor.lock.corner', { point: reason.point, region: reason.region }), detail: say('editor.lock.dragLines', { region: reason.region }) };
        case 'lattice':
            return reason.region
                ? { title: say('editor.lock.lattice', { point: reason.point, region: reason.region }), detail: say('editor.lock.dragLines', { region: reason.region }) }
                : { title: say('editor.lock.latticeView', { point: reason.point }), detail: say('editor.lock.panOrZoom') };
        case 'derivedClause':
            return { title: say('editor.lock.derivedClause', { region: reason.region, name: reason.name }), detail: say('editor.lock.computedBy', { tool: reason.tool }) };
        case 'derivedLevel':
            return { title: say('editor.lock.derivedLevel', { curve: reason.curve, name: reason.name }), detail: say('editor.lock.derivedLevelDetail', { tool: reason.tool }) };
        case 'keywordTangent':
            return {
                title: say('editor.lock.keywordTangent', { fn: reason.fn, keyword: reason.keyword }),
                detail: say('editor.lock.keywordTangentDetail'),
            };
        case 'derivedTangent':
            return { title: say('editor.lock.derivedTangent', { fn: reason.fn, name: reason.name }), detail: say('editor.lock.computedBy', { tool: reason.tool }) };
        case 'splicedVertex':
            return {
                title: say('editor.lock.splicedVertex', { segment: reason.segment, index: reason.index, from: reason.from }),
                detail: reason.fromIsList ? say('editor.lock.dragInSource', { from: reason.from }) : say('editor.lock.computedBy', { tool: reason.from }),
            };
        case 'splicedPath':
            return { title: say('editor.lock.splicedPath', { segment: reason.segment, from: reason.from }), detail: say('editor.lock.dragOwnPoints') };
        case 'curveKind':
            return {
                title: say(reason.fnKind === 'polar' ? 'editor.lock.polar' : 'editor.lock.parametric', { fn: reason.fn }),
                detail: say('editor.lock.dragWorksFor'),
            };
        case 'nothing':
            return { title: say('editor.lock.nothing', { subject: reason.subject }), detail: say('editor.lock.noNumbers') };
        case 'axisSlider':
            return { title: say('editor.lock.axisSlider', { name: reason.name }), detail: say('editor.lock.axisSliderDetail') };
        case 'cannotDragHere':
            return { title: say('editor.lock.cannotDragHere', { subject: reason.subject }), detail: say('editor.lock.grabWhereDrawn') };
    }
}

/** Shift is unavailable for this target (SPEC3 1.8 "Shift unavailable"). `noTerm`: clause text and the missing variable. */
export function shiftLockFor(target: DragTarget, noTerm: { text: string; variable: string } | null): Lock {
    const detail = say('editor.lock.dragWithoutShift');
    const turns = target.shift !== 'stretch' && target.shift !== 'resize';
    if (noTerm && turns) {
        return { title: say('editor.lock.shiftNoTerm', { text: noTerm.text, variable: noTerm.variable }), detail };
    }
    const key: MessageKey = target.shift === 'stretch' ? 'editor.lock.shiftCannotStretch' : target.shift === 'resize' ? 'editor.lock.shiftCannotResize' : 'editor.lock.shiftCannotTurn';
    return { title: say(key, { subject: target.subject }), detail };
}

/**
 * Shift is unavailable at this grab only: the numbers could change the shape, but no pivot candidate is far
 * enough from the grab (every one within the dead zone, out of view, or level with it along the stretched axis).
 */
export function noPivotLockFor(target: DragTarget): Lock {
    const subject = target.subject;
    if (target.shift === 'stretch') return { title: say('editor.lock.noPivotStretch', { subject }), detail: say('editor.lock.noPivotStretchDetail') };
    if (target.shift === 'resize') return { title: say('editor.lock.noPivotResize', { subject }), detail: say('editor.lock.noPivotResizeDetail') };
    return { title: say('editor.lock.noPivotTurn', { subject }), detail: say('editor.lock.noPivotTurnDetail') };
}

// ----------------------------------------------------------------- chips

export interface HoverInfo {
    target: DragTarget;
    gesture: Gesture;
    /** Unit texts and the spans that will change (numbers) or receive insertions (ghosts). */
    text: string;
    numSpans: Array<[number, number]>;
    ghosts: Array<{ at: number; text: string }>;
    virtualKinds: string[];
    restricted: Restriction;
    pivot: { at: { x: number; y: number } } | null;
    sharedSliders: Array<{ name: string; users: string[] }>;
    twins: string[];
    passed: HitShape | null;
    shiftLock: Lock | null;
}

/** Ghost text for an inserted number in the hover chip ('k', 'a', 'h', 's' placeholders). */
export function ghostText(kind: VirtualKind, style: { spacedOps: boolean; implicitMul: boolean }): string {
    switch (kind) {
        case 'add':
            return style.spacedOps ? ' + k' : '+k';
        case 'factor':
            return style.implicitMul ? 'a' : 'a*';
        case 'shiftVar':
            return style.spacedOps ? ' - h' : '-h';
        case 'scaleVar':
            return style.implicitMul ? 's' : 's*';
    }
}

/** Placeholder label of a virtual number (DragNumber.label). */
export function virtualLabel(kind: VirtualKind): string {
    return kind === 'add' ? 'k' : kind === 'factor' ? 'a' : kind === 'shiftVar' ? 'h' : 's';
}

export function hoverChip(info: HoverInfo, keys: { mod: 'Cmd' | 'Ctrl'; alt: 'Option' | 'Alt' }): Chip {
    void keys;
    const target = info.target;
    const parts = textParts(info.text, info.numSpans.map(([s, e]) => ({ s, e, kind: 'num' as const })), info.ghosts);
    return {
        title: titled(target.subject, truncate(parts)),
        detail: hoverDetail(info),
        note: hoverNote(info),
        tone: 'normal',
    };
}

export function lockChip(lock: Lock): Chip {
    return { title: [{ text: lock.title, kind: 'plain' }], detail: lock.detail, note: '', tone: 'locked' };
}

export type LiveStatus =
    | 'none'
    | 'vertical'
    | 'horizontal'
    | 'snapMarker'
    | 'throughMarker'
    | 'grid'
    | 'slope'
    | 'turning'
    | 'stretching'
    | 'resizing'
    | 'clampMax'
    | 'clampMin'
    | 'stuck'
    | 'flip'
    | 'vertical89'
    | 'mirrored'
    | 'origin';

export function liveChip(
    target: DragTarget,
    fields: Array<{ text: string; changed: Array<[number, number]> }>,
    sliders: Array<{ name: string; value: number }>,
    status: { kind: LiveStatus; label?: string; pivot?: { x: number; y: number }; bound?: number }
): Chip {
    let text = '';
    const spans: Array<{ s: number; e: number; kind: 'changed' }> = [];
    fields.forEach((f, i) => {
        if (i > 0) text += ', ';
        const off = text.length;
        for (const [s, e] of f.changed) if (e > s) spans.push({ s: off + s, e: off + e, kind: 'changed' });
        text += f.text;
    });
    const title = titled(target.subject, truncate(textParts(text, spans, [])));
    for (const s of sliders) {
        title.push({ text: '   ', kind: 'plain' });
        title.push({ text: `${s.name} = ${formatNumber(s.value)}`, kind: 'changed' });
    }
    return { title, detail: liveDetail(target, status), note: '', tone: 'normal' };
}

export function tipChip(keys: { mod: 'Cmd' | 'Ctrl' }): Chip {
    return {
        title: [{ text: say('editor.tip.title'), kind: 'plain' }],
        detail: say('editor.tip.detail', { mod: keys.mod }),
        note: '',
        tone: 'tip',
    };
}

// ----------------------------------------------------------- undo, a11y

export function undoLabel(target: DragTarget, gesture: Gesture, twin: boolean): string {
    const { key, subject } = undoParts(target, gesture, twin);
    return say(key, { subject });
}

/** What undoLabel names ('R1 (2)', 'C1 level 2', "C1 and P1's objective"): the stale texts name it too. */
export function undoSubject(target: DragTarget, gesture: Gesture, twin: boolean): string {
    return undoParts(target, gesture, twin).subject;
}

/** Announcement when a target gets selected (SPEC3 1.8). */
export function selectAnnouncement(target: DragTarget, text: string): string {
    return say('editor.announce.select', { subject: target.subject, text });
}

/** Announcement after a drag: 'R1 (2): x + 3y <= 6.6'. */
export function dragAnnouncement(target: DragTarget, text: string): string {
    return say('editor.drag.subjectText', { subject: target.subject, text });
}

/**
 * Undo bar text after an undo (or, with `redo`, a redo) that skipped edited
 * fields: null when nothing was skipped. `names` are the patches that no
 * longer held their value; `applied` tells whether anything else was restored.
 */
export function staleText(names: readonly string[], applied: boolean, redo = false): string | null {
    if (!names.length) return null;
    const values = { count: names.length, names: joinNames(names) };
    if (redo) return say(applied ? 'editor.undo.redoneExcept' : 'editor.undo.nothingRedone', values);
    return say(applied ? 'editor.undo.undoneExcept' : 'editor.undo.nothingUndone', values);
}

/** Undo bar text after Make slider. */
export function madeSliderText(name: string, value: number): string {
    return say('editor.undo.madeSlider', { name, value: formatNumber(value) });
}

/** What an undo of Make slider that changed nothing names as edited since ('slider b from 6.6'). */
export function madeSliderSubject(name: string, value: number): string {
    return say('editor.undo.madeSliderSubject', { name, value: formatNumber(value) });
}

/** Points print with fmtNum-style 3 decimals at most: '(3, 1)', '(1.5, -1.25)'. */
export function pointText(p: { x: number; y: number }): string {
    return `(${formatFixed(p.x, 3)}, ${formatFixed(p.y, 3)})`;
}

/** 'R1', 'R1 and Label 1', 'A, B and C', 'A, B, C and 2 more'. */
export function joinNames(names: readonly string[]): string {
    const list = names.filter((n, i) => names.indexOf(n) === i);
    if (list.length <= MAX_NAMES) return joinAll(list);
    return say('editor.list.more', { names: commaList(list.slice(0, MAX_NAMES)), count: list.length - MAX_NAMES });
}

/** Chip label of a number: '6', 'c', '1/2', or the virtual placeholder. */
export function numberLabel(n: DragNumber): string {
    return n.label;
}

// --------------------------------------------------------------- private

/** The undo label's verb (a key) and what it names. */
function undoParts(target: DragTarget, gesture: Gesture, twin: boolean): { key: MessageKey; subject: string } {
    let key: MessageKey;
    let subject: string;
    if (gesture === 'move' && target.kind === 'level') {
        const unit = target.units.find((u) => u.role === 'levelItem');
        key = 'editor.undo.changed';
        subject = levelName(target.cardSource, unit && unit.item !== undefined ? unit.item + 1 : 1);
    } else {
        // Shift on a level reshapes the whole curve: the curve's own name.
        key = verbFor(target, gesture);
        subject = target.kind === 'level' ? target.cardSource : target.subject;
    }
    if (twin) {
        const names = target.twinNames && target.twinNames.length ? target.twinNames : null;
        if (names) subject = say('editor.undo.withTwins', { subject, twins: joinNames(names.map(objectiveName)) });
    }
    return { key, subject };
}

/** The chip title: the subject and the text parts, ordered as the reader's language puts '{subject}: {text}'. */
function titled(subject: string, parts: ChipPart[]): ChipPart[] {
    const mark = '\u0000';
    const whole = say('editor.drag.subjectText', { subject, text: mark });
    const at = whole.indexOf(mark);
    const out: ChipPart[] = [{ text: at >= 0 ? whole.slice(0, at) : whole, kind: 'plain' }, ...parts];
    const after = at >= 0 ? whole.slice(at + mark.length) : '';
    if (after) out.push({ text: after, kind: 'plain' });
    return out;
}

function verbFor(target: DragTarget, gesture: Gesture): MessageKey {
    if (gesture === 'move') return 'editor.undo.moved';
    switch (target.shift) {
        case 'turn':
            return 'editor.undo.turned';
        case 'stretch':
            return 'editor.undo.stretched';
        case 'resize':
            return 'editor.undo.resized';
        default:
            return 'editor.undo.moved';
    }
}

function pointLike(target: DragTarget): boolean {
    return target.kind === 'point' || target.kind === 'vertex' || target.kind === 'label';
}

function shiftPart(target: DragTarget): string {
    switch (target.shift) {
        case 'turn':
            return say(target.kind === 'path' && target.points.length === 2 ? 'editor.hint.shiftTurnEnd' : 'editor.hint.shiftTurn');
        case 'stretch':
            return say('editor.hint.shiftStretch');
        case 'resize':
            return say('editor.hint.shiftResize');
        case 'straight':
            return target.kind === 'label' ? '' : say('editor.hint.shiftStraight');
        default:
            return '';
    }
}

function moveDetail(target: DragTarget, restricted: Restriction): string {
    if (target.kind === 'level') return say('editor.hint.level');
    if (target.kind === 'tangent') return say('editor.hint.alongCurve');
    let base = say('editor.hint.move');
    if (restricted === 'vertical') base = say('editor.hint.moveVertical');
    else if (restricted === 'horizontal') base = say('editor.hint.moveSideways');
    else if (restricted === 'line') base = say('editor.hint.slide');
    // Points that can only slide have no straight-line option worth naming.
    if (restricted !== 'none' && pointLike(target)) return base;
    const shift = shiftPart(target);
    return shift ? say('editor.hint.join', { first: base, second: shift }) : base;
}

function hoverDetail(info: HoverInfo): string {
    const target = info.target;
    if (info.gesture === 'move') return moveDetail(target, info.restricted);
    if (info.shiftLock) return info.shiftLock.title;
    const point = info.pivot ? pointText(info.pivot.at) : null;
    switch (target.shift) {
        case 'turn':
            return point ? say('editor.hint.turnsAround', { point }) : say('editor.hint.turns');
        case 'stretch':
            return point ? say('editor.hint.stretchesFrom', { point }) : say('editor.hint.stretches');
        case 'resize':
            return point ? say('editor.hint.resizesAround', { point }) : say('editor.hint.resizes');
        case 'straight':
            return target.kind === 'label' ? say('editor.hint.move') : say('editor.hint.shiftStraight');
        default:
            return moveDetail(target, info.restricted);
    }
}

const INSERT_ORDER: VirtualKind[] = ['shiftVar', 'add', 'factor', 'scaleVar'];
const INSERT_WORDS: Record<VirtualKind, MessageKey> = {
    shiftVar: 'editor.note.shift',
    add: 'editor.note.offset',
    factor: 'editor.note.factor',
    scaleVar: 'editor.note.scale',
};

function hoverNote(info: HoverInfo): string {
    const notes: string[] = [];
    const kinds = INSERT_ORDER.filter((k) => info.virtualKinds.includes(k));
    if (kinds.length) notes.push(say('editor.note.adds', { things: joinAll(kinds.map((k) => say(INSERT_WORDS[k]))) }));
    for (const s of info.sharedSliders) {
        if (s.users.length) notes.push(say('editor.note.sharedSlider', { name: s.name, users: joinNames(s.users) }));
    }
    for (const twin of info.twins) notes.push(say('editor.note.twin', { name: twin }));
    if (info.passed) notes.push(say('editor.note.passed', { source: info.passed.source, subject: info.target.subject }));
    return notes.length ? notes.reduce((first, next) => say('editor.note.join', { first, next })) : '';
}

/** 'A, B' (the reader's list separator), without 'and'. */
function commaList(list: readonly string[]): string {
    return list.length ? list.reduce((first, next) => say('editor.list.comma', { first, next })) : '';
}

/** Like joinNames, without the 'and N more' cut. */
function joinAll(list: readonly string[]): string {
    if (list.length <= 1) return list.join('');
    return say('editor.list.pair', { first: commaList(list.slice(0, -1)), last: list[list.length - 1] });
}

function liveDetail(target: DragTarget, status: { kind: LiveStatus; label?: string; pivot?: { x: number; y: number }; bound?: number }): string {
    const point = status.pivot ? pointText(status.pivot) : null;
    const value = status.bound !== undefined && Number.isFinite(status.bound) ? formatNumber(status.bound) : '';
    switch (status.kind) {
        case 'none':
            return '';
        case 'vertical':
            return say('editor.live.onlyVertical');
        case 'horizontal':
            return say('editor.live.onlyHorizontal');
        case 'snapMarker':
            return status.label ? say('editor.live.snapped', { name: status.label }) : say('editor.live.snappedPoint');
        case 'origin':
            return say('editor.live.origin');
        case 'throughMarker':
            return status.label ? say('editor.live.through', { name: status.label }) : say('editor.live.throughPoint');
        case 'grid':
            return say('editor.live.grid');
        case 'slope':
            // The session names the two axis directions by these words; any other label is the slope itself.
            if (status.label === 'horizontal') return say('editor.live.slopeHorizontal');
            if (status.label === 'vertical') return say('editor.live.slopeVertical');
            return status.label ? say('editor.live.slope', { value: status.label }) : say('editor.live.slopeOnly');
        case 'turning':
            return point ? say('editor.live.turning', { point }) : say('editor.live.turningAround');
        case 'stretching':
            return point ? say('editor.live.stretching', { point }) : say('editor.live.stretchingFrom');
        case 'resizing':
            return point ? say('editor.live.resizing', { point }) : say('editor.live.resizingAround');
        case 'clampMax':
            return status.label ? say('editor.live.atMax', { name: status.label, value }) : say('editor.live.sliderAtMax', { value });
        case 'clampMin':
            return status.label ? say('editor.live.atMin', { name: status.label, value }) : say('editor.live.sliderAtMin', { value });
        case 'stuck':
            return say('editor.live.stuck');
        case 'flip':
            return say('editor.live.flip', { subject: target.subject });
        case 'vertical89':
            return say('editor.live.vertical89');
        case 'mirrored':
            return say('editor.live.mirrored');
    }
}

/** Plain text with highlighted spans and ghost insertions as chip parts (spans must not overlap). */
function textParts(text: string, spans: Array<{ s: number; e: number; kind: ChipPart['kind'] }>, ghosts: ReadonlyArray<{ at: number; text: string }>): ChipPart[] {
    const sorted = spans
        .map((sp) => ({ s: Math.max(0, Math.min(text.length, sp.s)), e: Math.max(0, Math.min(text.length, sp.e)), kind: sp.kind }))
        .filter((sp) => sp.e > sp.s)
        .sort((a, b) => a.s - b.s || b.e - a.e);
    // Drop spans nested in or overlapping an earlier one.
    const kept: typeof sorted = [];
    for (const sp of sorted) if (!kept.length || sp.s >= kept[kept.length - 1].e) kept.push(sp);
    const gs = ghosts
        .map((g) => ({ at: Math.max(0, Math.min(text.length, g.at)), text: g.text }))
        .sort((a, b) => a.at - b.at);
    const out: ChipPart[] = [];
    const push = (s: string, kind: ChipPart['kind']) => {
        if (!s) return;
        const last = out[out.length - 1];
        if (last && last.kind === kind) last.text += s;
        else out.push({ text: s, kind });
    };
    let pos = 0;
    let gi = 0;
    const plainTo = (end: number) => {
        while (pos < end) {
            while (gi < gs.length && gs[gi].at <= pos) push(gs[gi++].text, 'ghost');
            const next = gi < gs.length && gs[gi].at < end ? gs[gi].at : end;
            push(text.slice(pos, next), 'plain');
            pos = next;
        }
    };
    for (const sp of kept) {
        plainTo(sp.s);
        while (gi < gs.length && gs[gi].at <= pos) push(gs[gi++].text, 'ghost');
        // Ghosts inside a highlighted span (rare) go after it.
        push(text.slice(sp.s, sp.e), sp.kind);
        pos = sp.e;
    }
    plainTo(text.length);
    while (gi < gs.length) push(gs[gi++].text, 'ghost');
    return out;
}

/** Cut texts longer than MAX_TEXT around the first highlighted part, with '…' on the cut sides. */
function truncate(parts: ChipPart[]): ChipPart[] {
    const total = parts.reduce((n, p) => n + p.text.length, 0);
    if (total <= MAX_TEXT) return parts;
    let first = 0;
    let firstLen = 0;
    let off = 0;
    for (const p of parts) {
        if (p.kind !== 'plain') {
            first = off;
            firstLen = p.text.length;
            break;
        }
        off += p.text.length;
    }
    // Keep a little context before the highlight; never run past the end.
    const lead = Math.max(0, Math.floor((MAX_TEXT - Math.min(firstLen, MAX_TEXT)) / 3));
    const start = Math.max(0, Math.min(first - lead, total - MAX_TEXT));
    const end = start + MAX_TEXT;
    const out: ChipPart[] = [];
    if (start > 0) out.push({ text: ELLIPSIS, kind: 'plain' });
    off = 0;
    for (const p of parts) {
        const s = Math.max(start, off);
        const e = Math.min(end, off + p.text.length);
        if (e > s) {
            const text = p.text.slice(s - off, e - off);
            const last = out[out.length - 1];
            if (last && last.kind === p.kind) last.text += text;
            else out.push({ text, kind: p.kind });
        }
        off += p.text.length;
    }
    if (end < total) {
        const last = out[out.length - 1];
        if (last && last.kind === 'plain') last.text += ELLIPSIS;
        else out.push({ text: ELLIPSIS, kind: 'plain' });
    }
    return out;
}
