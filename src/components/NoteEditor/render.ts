import { CONTEXT_LINES_DOWN, CONTEXT_LINES_UP, VOCAB_HEADER_RE, VOCAB_SENTINEL } from "./constants";
import { escapeHtml, findIndexNormalized, isAsciiSentence } from "./text";
import { getSectionBoundsByLine, getSectionBoundsByPos, lineIndexForPos } from "./section";

/** Bỏ gạch phân cách đầu/đuôi section (nếu có) */
export const stripDividerLines = (s: string) => {
    s = s.replace(/^(?:[\u2500\u2501\u2504\u2505_\-=–—]{6,}[ \t]*\r?\n)+/, "");
    s = s.replace(/(?:\r?\n[\u2500\u2501\u2504\u2505_\-=–—]{6,}[ \t]*)+$/, "");
    return s;
};

export const splitFirstEnglishQuote = (head: string) => {
    const openIdx = head.search(/["“]/);
    if (openIdx < 0) return null;
    const rest = head.slice(openIdx + 1);
    const closeRel = rest.search(/["”]/);
    if (closeRel < 0) return null;
    const closeIdx = openIdx + 1 + closeRel;
    const pre = head.slice(0, openIdx);
    const open = head[openIdx];
    const en = head.slice(openIdx + 1, closeIdx);
    const close = head[closeIdx];
    const post = head.slice(closeIdx + 1);
    return { pre, open, en, close, post };
};

/** Chỉ bôi vàng mảnh EN (ưu tiên phần trong ngoặc kép đầu tiên) */
export const markEnglishQuotePartial = (head: string, englishNeedle?: string) => {
    if (!head) return "";

    const paint = (container: string, needle?: string) => {
        if (!needle) return escapeHtml(container);
        if (!isAsciiSentence(needle) && !isAsciiSentence(container)) {
            return escapeHtml(container);
        }
        const idx = findIndexNormalized(container, needle);
        if (idx < 0) return escapeHtml(container);
        const a = escapeHtml(container.slice(0, idx));
        const b = escapeHtml(container.slice(idx, idx + needle.length));
        const c = escapeHtml(container.slice(idx + needle.length));
        return a + `<mark>${b}</mark>` + c;
    };

    const q = splitFirstEnglishQuote(head);
    if (q) {
        const pre = escapeHtml(q.pre);
        const open = escapeHtml(q.open);
        const close = escapeHtml(q.close);
        const post = escapeHtml(q.post);
        const enHtml = paint(q.en, englishNeedle);
        return pre + open + enHtml + close + post;
    }
    return paint(head, englishNeedle);
};

/** Tách section thành head (trước header vocab) + body (sau) */
export const splitSectionAtHeader = (sectionText: string): { before: string; after: string } | null => {
    if (!sectionText) return null;

    const sentRE = new RegExp(
        `(^|\\n)[^\\S\\r\\n]*${VOCAB_SENTINEL.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}[^\\S\\r\\n]*`
    );
    const m1 = sectionText.match(sentRE);
    if (m1 && m1.index != null) {
        const idx = m1.index + m1[0].length;
        const before = sectionText.slice(0, m1.index).replace(/\s+$/, "");
        const rest = sectionText.slice(idx);
        const after = rest.startsWith("\n") ? rest.slice(1) : rest;
        return { before, after };
    }

    const m2 = sectionText.match(VOCAB_HEADER_RE);
    if (m2 && m2.index != null) {
        const idx = m2.index + m2[0].length;
        const before = sectionText.slice(0, m2.index).replace(/\s+$/, "");
        const rest = sectionText.slice(idx);
        const after = rest.startsWith("\n") ? rest.slice(1) : rest;
        return { before, after };
    }
    return null;
};

/** Dựng HTML head(EN highlight) + body(VN không highlight) */
export const buildSectionFullHtml = (rawSection: string, englishNeedle?: string) => {
    const clean = stripDividerLines(rawSection);
    const split = splitSectionAtHeader(clean);
    if (!split) return "";
    const head = split.before.trim();
    const body = split.after;
    const headHtml = head ? markEnglishQuotePartial(head, englishNeedle) + "\n" : "";
    const bodyHtml = escapeHtml(body);
    return headHtml + bodyHtml;
};

export const buildSectionExplainHtmlByPos = (
    content: string,
    sectionStarts: { line: number; pos: number }[],
    anchorPos: number,
    englishNeedle?: string
) => {
    const { startPos, endPos } = getSectionBoundsByPos(sectionStarts, anchorPos, content.length);
    const raw = content.slice(startPos, endPos);
    return { html: buildSectionFullHtml(raw, englishNeedle), sectionStartPos: startPos };
};

export const buildSectionExplainHtmlByLine = (
    content: string,
    starts: number[],
    sectionStarts: { line: number; pos: number }[],
    fromLine: number,
    englishNeedle?: string
) => {
    const { startPos, endPos } = getSectionBoundsByLine(starts, sectionStarts, fromLine, content.length);
    const raw = content.slice(startPos, endPos);
    return { html: buildSectionFullHtml(raw, englishNeedle), sectionStartPos: startPos };
};

/** Fallback: render context (clamp trong section) */
export const buildContextHtml = (
    content: string,
    lines: string[],
    starts: number[],
    headerIdx: number,
    hit: { start: number; end: number },
    up = CONTEXT_LINES_UP,
    down = CONTEXT_LINES_DOWN,
    englishNeedle?: string,
    sectionStarts?: { line: number; pos: number }[]
) => {
    const hitLine = lineIndexForPos(starts, lines, hit.start);
    const vocabFirstLine = headerIdx >= 0 ? headerIdx + 1 : 0;
    let fromLine = Math.max(vocabFirstLine, hitLine - up);
    let toLine = Math.min(lines.length - 1, hitLine + down);

    if (sectionStarts && sectionStarts.length) {
        const { startPos, endPos } = getSectionBoundsByLine(starts, sectionStarts, hitLine, content.length);
        const startLineClamp = lineIndexForPos(starts, lines, startPos);
        const endLineClamp = lineIndexForPos(starts, lines, Math.max(startPos, endPos - 1));
        fromLine = Math.max(fromLine, startLineClamp);
        toLine = Math.min(toLine, endLineClamp);
    }

    const charStart = starts[fromLine];
    const charEnd = starts[toLine] + (lines[toLine]?.length ?? 0);
    const rawSnippet = content.slice(charStart, charEnd);

    const tryFull = buildSectionFullHtml(rawSnippet, englishNeedle);
    if (tryFull) return tryFull;

    if (englishNeedle) {
        const trySplit = splitSectionAtHeader(rawSnippet);
        const headPart = trySplit ? trySplit.before : rawSnippet;
        const bodyPart = trySplit ? trySplit.after : "";

        const idxEn = findIndexNormalized(headPart, englishNeedle);
        if (idxEn >= 0) {
            const A = escapeHtml(headPart.slice(0, idxEn));
            const B = escapeHtml(headPart.slice(idxEn, idxEn + englishNeedle.length));
            const C = escapeHtml(headPart.slice(idxEn + englishNeedle.length));
            const headHtml = A + `<mark>${B}</mark>` + C;
            const bodyHtml = bodyPart ? "\n" + escapeHtml(bodyPart) : "";
            return headHtml + bodyHtml;
        }
    }

    return escapeHtml(rawSnippet);
};
