import { MIN_SEARCH_LEN } from "./constants";
import { normalize, normForSearch, findIndexNormalized } from "./text";
import { lineIndexForPos } from "./section";

export type VocabIndexItem = { start: number; end: number; raw: string; norm: string };

export const tokensFromSentence = (s: string) =>
    normForSearch(s)
        .split(" ")
        .filter((w) => w.length >= 3)
        .slice(0, 8);

export const buildVocabLineIndex = (lines: string[], starts: number[], headerIdx: number) => {
    const out: VocabIndexItem[] = [];
    const begin = headerIdx >= 0 ? headerIdx + 1 : lines.length;
    for (let i = begin; i < lines.length; i++) {
        const raw = lines[i];
        if (!raw.trim()) continue;
        const start = starts[i];
        out.push({ start, end: start + raw.length, raw, norm: normalize(raw) });
    }
    return out;
};

export const pickBestVocabLineIdxDirectional = (
    tokens: string[],
    vocabIndex: VocabIndexItem[],
    lines: string[],
    starts: number[],
    minStartPos?: number
): number => {
    if (!tokens.length || vocabIndex.length === 0) return -1;
    let best = -1;
    let bestScore = 0;
    for (const v of vocabIndex) {
        if (minStartPos != null && v.start < minStartPos) continue;
        let sc = 0;
        for (const t of tokens) if (v.norm.includes(t)) sc++;
        if (sc > bestScore) {
            bestScore = sc;
            best = lineIndexForPos(starts, lines, v.start);
        }
    }
    return best;
};

export const pickBestVocabLineIdx = (
    tokens: string[],
    vocabIndex: VocabIndexItem[],
    lines: string[],
    starts: number[]
): number => pickBestVocabLineIdxDirectional(tokens, vocabIndex, lines, starts, undefined);

/* ====== THUẬT TOÁN MỚI: tái dựng câu và “đuôi + bổ sung” ====== */
export const splitIntoSentencesKeepDot = (s: string) => {
    const out: string[] = [];
    let acc = "";
    for (const ch of s) {
        acc += ch;
        if (ch === "." || ch === "?" || ch === "!") {
            out.push(acc.trim());
            acc = "";
        }
    }
    if (acc.trim()) out.push(acc.trim());
    return out.filter(Boolean);
};

export const getFullPreviousSentence = (entries: { text: string }[], idx: number, maxBackLines = 3) => {
    let buf = entries[idx]?.text ?? "";
    let i = idx - 1;
    let count = 0;
    while (i >= 0 && count < maxBackLines) {
        buf = `${entries[i].text} ${buf}`.trim();
        if (/[.!?]/.test(buf)) break;
        i--;
        count++;
    }
    const sentences = splitIntoSentencesKeepDot(buf);
    if (!sentences.length) return "";
    const last = sentences[sentences.length - 1];
    return /[.!?]$/.test(last) ? last : sentences.length >= 2 ? sentences[sentences.length - 2] : last;
};

export const completeSentenceForward = (
    entries: { text: string }[],
    idxStart: number,
    initial: string,
    maxForwardLines = 2
) => {
    if (/[.!?]$/.test(initial.trim())) return initial.trim();
    let acc = initial.trim();
    let i = idxStart + 1;
    let steps = 0;
    while (i < entries.length && steps < maxForwardLines) {
        const nxt = entries[i].text.trim();
        acc = (acc + " " + nxt).trim();
        if (/[.!?]/.test(acc)) break;
        i++;
        steps++;
    }
    const parts = splitIntoSentencesKeepDot(acc);
    return parts.length ? parts[0] : acc;
};

export const buildSearchPlanForLine = (entries: { text: string }[], idx: number) => {
    const line = entries[idx]?.text ?? "";
    const nextLine = entries[idx + 1]?.text ?? "";
    const segs = splitIntoSentencesKeepDot(line);

    const plan: Array<{ highlightNeedle: string; searchNeedle: string }> = [];
    if (!segs.length) return plan;

    const first = segs[0];
    if (/[.!?]$/.test(first)) {
        const fullPrev = getFullPreviousSentence(entries, idx);
        const searchNeedle = fullPrev || first;
        if (first.trim().length >= MIN_SEARCH_LEN) {
            plan.push({ highlightNeedle: first, searchNeedle });
        }
    }

    for (let i = 1; i < segs.length; i++) {
        const sent = segs[i];
        if (sent.trim().length >= MIN_SEARCH_LEN) {
            plan.push({ highlightNeedle: sent, searchNeedle: sent });
        }
    }

    const tailNoDot = segs[segs.length - 1];
    if (tailNoDot && !/[.!?]$/.test(tailNoDot)) {
        const completed = completeSentenceForward(entries, idx, tailNoDot + " " + nextLine);
        if (tailNoDot.trim().length >= MIN_SEARCH_LEN) {
            plan.push({ highlightNeedle: tailNoDot.trim(), searchNeedle: completed.trim() });
        }
    }

    if (!plan.length && line.trim().length >= MIN_SEARCH_LEN) {
        plan.push({ highlightNeedle: line.trim(), searchNeedle: line.trim() });
    }
    return plan;
};

export const findBestHit = (
    content: string,
    vocabStart: number,
    needle: string,
    vocabIndex: VocabIndexItem[],
    lines: string[],
    starts: number[],
    headerIdx: number
): { start: number; end: number } | null => {
    if (!needle.trim()) return null;

    const raw = normForSearch(content.slice(Math.max(0, vocabStart)));
    const posInSlice = raw.indexOf(normForSearch(needle));
    if (posInSlice >= 0) {
        const globalSlice = content.slice(Math.max(0, vocabStart));
        const idx = findIndexNormalized(globalSlice, needle);
        if (idx >= 0) {
            const start = Math.max(0, vocabStart) + idx;
            return { start, end: start + needle.length };
        }
    }

    const tokens = tokensFromSentence(needle);
    if (tokens.length) {
        let bestIdx = -1,
            bestScore = 0;
        for (let i = 0; i < vocabIndex.length; i++) {
            const ln = vocabIndex[i];
            let score = 0;
            for (const t of tokens) if (ln.norm.includes(t)) score++;
            if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }
        if (bestIdx >= 0 && bestScore > 0) {
            const ln = vocabIndex[bestIdx];
            return { start: ln.start, end: ln.end };
        }
    }

    const anywhereIdx = findIndexNormalized(content, needle);
    if (anywhereIdx >= 0) return { start: anywhereIdx, end: anywhereIdx + needle.length };

    if (headerIdx >= 0) {
        const end = headerIdx;
        let bestLine = -1,
            bestScore = 0;
        for (let i = 0; i < end; i++) {
            const normLn = normalize(lines[i] || "");
            let score = 0;
            for (const t of tokens) if (normLn.includes(t)) score++;
            if (score > bestScore) {
                bestScore = score;
                bestLine = i;
            }
        }
        if (bestLine >= 0 && bestScore > 0) {
            const start = starts[bestLine];
            const endPos = start + (lines[bestLine]?.length ?? 0);
            return { start, end: endPos };
        }
    }
    return null;
};
