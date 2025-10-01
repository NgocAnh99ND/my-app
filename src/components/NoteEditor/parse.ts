import { VOCAB_HEADER_RE, VOCAB_SENTINEL } from "./constants";
import type { TranscriptEntry } from "./types";

export const timeToSec = (s: string) => {
    const p = s.trim().split(":").map(Number);
    if (p.some((n) => Number.isNaN(n))) return NaN;
    if (p.length === 2) return p[0] * 60 + p[1];
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    return NaN;
};

export const computeLines = (content: string) => {
    const lines: string[] = [];
    const starts: number[] = [];
    let pos = 0;
    while (pos <= content.length) {
        starts.push(pos);
        const nl = content.indexOf("\n", pos);
        if (nl === -1) {
            lines.push(content.slice(pos).replace(/\r$/, ""));
            break;
        } else {
            lines.push(content.slice(pos, nl).replace(/\r$/, ""));
            pos = nl + 1;
        }
    }
    return { lines, starts };
};

export const isVocabHeaderLine = (line: string) => {
    if (line.includes(VOCAB_SENTINEL)) return true;
    return VOCAB_HEADER_RE.test("\n" + line);
};

export const locateVocabulary = (content: string) => {
    const { lines, starts } = computeLines(content);
    const headerIdx = lines.findIndex(isVocabHeaderLine);
    const vocabStart =
        headerIdx >= 0
            ? headerIdx + 1 < starts.length
                ? starts[headerIdx + 1]
                : content.length
            : content.length;
    return { lines, starts, headerIdx, vocabStart };
};

export const parseTranscriptFromTop = (
    lines: string[],
    headerIdx: number
): TranscriptEntry[] => {
    const end = headerIdx >= 0 ? headerIdx : lines.length;
    const entries: TranscriptEntry[] = [];
    for (let i = 0; i < end; i++) {
        const raw = lines[i];
        const m = raw.match(/^\s*((?:\d{1,3}:)?\d{1,2}:\d{2})\s*(?:[-–—]\s*)?(.*)$/);
        if (!m) continue;
        const t = timeToSec(m[1]);
        const txt = (m[2] || "").trim();
        if (!isFinite(t) || !txt) continue;
        entries.push({ sec: t, text: txt });
    }
    return entries;
};

export const firstIdxAfter = (entries: TranscriptEntry[], t: number) => {
    let lo = 0,
        hi = entries.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (entries[mid].sec > t) hi = mid;
        else lo = mid + 1;
    }
    return lo;
};
