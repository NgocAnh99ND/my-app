// src/components/NoteEditor.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { FC, FormEvent } from "react";
import Input from "./Input";
import IconButton from "./IconButton";
import SuggestionList from "./SuggestionList";

type NoteEditorProps = { currentTime?: number };
type TranscriptEntry = { sec: number; text: string };

const SEEK_BACK_THRESHOLD = 1.5;
const MIN_SEARCH_LEN = 3; // bắt cả từ ngắn như "joy."
const CONTEXT_LINES_UP = 4;
const CONTEXT_LINES_DOWN = 6;

const NOTE_PLACEHOLDER = `Dán theo cấu trúc:

00:00:00 - And I'm starting to get really nervous
00:00:02 - because for a long time no one says
...

:::VOCAB:::
Nervous: lo lắng, bồn chồn
Deep breath: hít một hơi thật sâu
...`;

const VOCAB_SENTINEL = ":::VOCAB:::";

/** Nới lỏng để hợp mobile/bullet */
const VOCAB_HEADER_RE = new RegExp(
    String.raw`(^|\n)[^\S\r\n]*(?:[+\-•*o●◦·‣▪▫]+[.)]?[^\S\r\n]*)?(?:key[^\S\r\n]*)?(?:vocab(?:ulary)?|vocabulary|từ[^\S\r\n]*vựng)[^\S\r\n]*(?:-|:|：|–|—)?[^\S\r\n]*`,
    "i"
);

/** Dòng số thứ tự section như "46." (cho phép khoảng trắng) */
const sectionHeaderRegex = /^\s*\d+\.\s*$/;
/** Dòng gạch phân đoạn (nếu có) */
const sectionDividerRegex = /^[\u2500\u2501\u2504\u2505_\-=–—]{6,}\s*$/;

const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
const isMobileUA = /Android|iP(hone|ad|od)|Mobi/i.test(ua);

/* ---------- helpers ---------- */
const timeToSec = (s: string) => {
    const p = s.trim().split(":").map(Number);
    if (p.some((n) => Number.isNaN(n))) return NaN;
    if (p.length === 2) return p[0] * 60 + p[1];
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    return NaN;
};

function computeLines(content: string) {
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
}

function isVocabHeaderLine(line: string) {
    if (line.includes(VOCAB_SENTINEL)) return true;
    return VOCAB_HEADER_RE.test("\n" + line);
}

function locateVocabulary(content: string) {
    const { lines, starts } = computeLines(content);
    const headerIdx = lines.findIndex(isVocabHeaderLine);
    const vocabStart =
        headerIdx >= 0
            ? headerIdx + 1 < starts.length
                ? starts[headerIdx + 1]
                : content.length
            : content.length;
    return { lines, starts, headerIdx, vocabStart };
}

function parseTranscriptFromTop(
    lines: string[],
    headerIdx: number
): TranscriptEntry[] {
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
}

function normalize(s: string) {
    return s
        .toLowerCase()
        .replace(/[“”"’']/g, "'")
        .replace(/[.,!?;:()[\]{}/\\]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/** Chuẩn hóa để so khớp không phân biệt hoa-thường/ngoặc/space */
function normForSearch(s: string) {
    return s
        .toLowerCase()
        .replace(/[“”]/g, '"')
        .replace(/[’']/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

/** Tìm index theo normalized, rồi match lại trên bản gốc gần đúng */
function findIndexNormalized(haystack: string, needle: string) {
    const H = normForSearch(haystack);
    const N = normForSearch(needle);
    if (!N) return -1;
    const idx = H.indexOf(N);
    if (idx < 0) return -1;
    // map ngược bằng regex "gần đúng"
    const esc = needle
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/[“”]/g, `["“”]`)
        .replace(/[’']/g, `['’]`)
        .replace(/\s+/g, `\\s+`);
    const re = new RegExp(esc, "i");
    const m = haystack.match(re);
    return m && m.index != null ? m.index : -1;
}

/** Ước lượng "câu tiếng Anh" để tránh bôi vàng phần nghĩa tiếng Việt */
function isAsciiSentence(s: string) {
    const letters = s.replace(/[^A-Za-z]/g, "").length;
    const total = s.replace(/\s/g, "").length;
    return total > 0 && letters / total >= 0.6;
}

function buildVocabLineIndex(
    lines: string[],
    starts: number[],
    headerIdx: number
) {
    const out: { start: number; end: number; raw: string; norm: string }[] = [];
    const begin = headerIdx >= 0 ? headerIdx + 1 : lines.length;
    for (let i = begin; i < lines.length; i++) {
        const raw = lines[i];
        if (!raw.trim()) continue;
        const start = starts[i];
        out.push({ start, end: start + raw.length, raw, norm: normalize(raw) });
    }
    return out;
}

function computeSectionStarts(lines: string[], starts: number[]) {
    const sections: { line: number; pos: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (sectionHeaderRegex.test(lines[i]) || sectionDividerRegex.test(lines[i])) {
            sections.push({ line: i, pos: starts[i] });
        }
    }
    return sections;
}

function lineIndexForPos(starts: number[], lines: string[], pos: number) {
    let lo = 0,
        hi = starts.length - 1,
        ans = 0;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const lineLen = lines[mid]?.length ?? 0;
        const start = starts[mid];
        const end = start + lineLen + 1;
        if (pos >= start && pos < end) return mid;
        if (pos < start) hi = mid - 1;
        else {
            ans = mid;
            lo = mid + 1;
        }
    }
    return ans;
}

function escapeHtml(s: string) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** Bỏ các dòng gạch phân cách ở đầu/đuôi section (nếu có) */
function stripDividerLines(s: string) {
    // đầu
    s = s.replace(/^(?:[\u2500\u2501\u2504\u2505_\-=–—]{6,}[ \t]*\r?\n)+/, "");
    // đuôi
    s = s.replace(/(?:\r?\n[\u2500\u2501\u2504\u2505_\-=–—]{6,}[ \t]*)+$/, "");
    return s;
}

/** Lấy cặp ngoặc kép đầu tiên (tiếng Anh) trong phần head */
function splitFirstEnglishQuote(head: string) {
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
}

/** Chỉ bôi vàng cụm needle trong đoạn tiếng Anh (cặp ngoặc kép đầu tiên) — case-insensitive/normalize */
function markEnglishQuotePartial(head: string, englishNeedle?: string) {
    if (!head) return "";

    const paint = (container: string, needle?: string) => {
        if (!needle) return escapeHtml(container);
        // Nếu cả container và needle đều không giống EN, tránh bôi nhầm nghĩa tiếng Việt
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
    // Nếu có ngoặc: chỉ sơn phần text trong ngoặc
    if (q) {
        const pre = escapeHtml(q.pre);
        const open = escapeHtml(q.open);
        const close = escapeHtml(q.close);
        const post = escapeHtml(q.post);
        const enHtml = paint(q.en, englishNeedle);
        return pre + open + enHtml + close + post;
    }
    // Không có ngoặc: thử bôi trong toàn head nhưng vẫn áp điều kiện EN
    return paint(head, englishNeedle);
}

/** Tách section thành 2 phần: trước header vocab và sau header vocab */
function splitSectionAtHeader(sectionText: string): { before: string; after: string } | null {
    if (!sectionText) return null;

    // Ưu tiên sentinel
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

    // Fallback theo chữ
    const m2 = sectionText.match(VOCAB_HEADER_RE);
    if (m2 && m2.index != null) {
        const idx = m2.index + m2[0].length;
        const before = sectionText.slice(0, m2.index).replace(/\s+$/, "");
        const rest = sectionText.slice(idx);
        const after = rest.startsWith("\n") ? rest.slice(1) : rest;
        return { before, after };
    }
    return null;
}

/* ---------- ranh giới section ---------- */
function getSectionBoundsByPos(
    sectionStarts: { line: number; pos: number }[],
    anchorPos: number,
    totalLen: number
) {
    if (!sectionStarts.length) return { startPos: 0, endPos: totalLen };
    let startPos = 0;
    let endPos = totalLen;
    for (let i = 0; i < sectionStarts.length; i++) {
        const s = sectionStarts[i];
        if (s.pos <= anchorPos) {
            startPos = s.pos;
            endPos = i + 1 < sectionStarts.length ? sectionStarts[i + 1].pos : totalLen;
        } else break;
    }
    return { startPos, endPos };
}

function getSectionBoundsByLine(
    starts: number[],
    sectionStarts: { line: number; pos: number }[],
    lineIdx: number,
    totalLen: number
) {
    const pos = starts[Math.max(0, Math.min(lineIdx, starts.length - 1))] || 0;
    return getSectionBoundsByPos(sectionStarts, pos, totalLen);
}

/** Dựng HTML: head (bôi vàng phần EN theo needle) + body (KHÔNG bôi) */
function buildSectionFullHtml(rawSection: string, englishNeedle?: string) {
    const clean = stripDividerLines(rawSection);
    const split = splitSectionAtHeader(clean);
    if (!split) return ""; // không thấy header -> để caller fallback
    const head = split.before.trim();
    const body = split.after;
    const headHtml = head ? markEnglishQuotePartial(head, englishNeedle) + "\n" : "";
    const bodyHtml = escapeHtml(body); // KHÔNG bôi vàng ở vocab/body
    return headHtml + bodyHtml;
}

function buildSectionExplainHtmlByPos(
    content: string,
    sectionStarts: { line: number; pos: number }[],
    anchorPos: number,
    englishNeedle?: string
) {
    const { startPos, endPos } = getSectionBoundsByPos(sectionStarts, anchorPos, content.length);
    const raw = content.slice(startPos, endPos);
    return { html: buildSectionFullHtml(raw, englishNeedle), sectionStartPos: startPos };
}

function buildSectionExplainHtmlByLine(
    content: string,
    starts: number[],
    sectionStarts: { line: number; pos: number }[],
    fromLine: number,
    englishNeedle?: string
) {
    const { startPos, endPos } = getSectionBoundsByLine(
        starts,
        sectionStarts,
        fromLine,
        content.length
    );
    const raw = content.slice(startPos, endPos);
    return { html: buildSectionFullHtml(raw, englishNeedle), sectionStartPos: startPos };
}

/* ---------- fallback: context (vẫn clamp trong section) ---------- */
function buildContextHtml(
    content: string,
    lines: string[],
    starts: number[],
    headerIdx: number,
    hit: { start: number; end: number },
    up = CONTEXT_LINES_UP,
    down = CONTEXT_LINES_DOWN,
    englishNeedle?: string,
    sectionStarts?: { line: number; pos: number }[]
) {
    const hitLine = lineIndexForPos(starts, lines, hit.start);
    const vocabFirstLine = headerIdx >= 0 ? headerIdx + 1 : 0;
    let fromLine = Math.max(vocabFirstLine, hitLine - up);
    let toLine = Math.min(lines.length - 1, hitLine + down);

    if (sectionStarts && sectionStarts.length) {
        const { startPos, endPos } = getSectionBoundsByLine(
            starts,
            sectionStarts,
            hitLine,
            content.length
        );
        const startLineClamp = lineIndexForPos(starts, lines, startPos);
        const endLineClamp = lineIndexForPos(starts, lines, Math.max(startPos, endPos - 1));
        fromLine = Math.max(fromLine, startLineClamp);
        toLine = Math.min(toLine, endLineClamp);
    }

    const charStart = starts[fromLine];
    const charEnd = starts[toLine] + (lines[toLine]?.length ?? 0);
    const rawSnippet = content.slice(charStart, charEnd);

    // Nếu tách được section trong snippet -> dùng renderer chuẩn (bôi chỉ ở head)
    const tryFull = buildSectionFullHtml(rawSnippet, englishNeedle);
    if (tryFull) return tryFull;

    // Fallback mới: chỉ bôi englishNeedle trong phần head (nếu đoán được), tránh bôi body tiếng Việt
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
            return headHtml + bodyHtml; // KHÔNG bôi vàng body
        }
    }

    // Nếu vẫn không match, trả về snippet đã escape (không bôi để tránh bôi nhầm VN)
    return escapeHtml(rawSnippet);
}

/* ---------- chọn dòng vocab khớp nhất ---------- */
function tokensFromSentence(s: string) {
    return normForSearch(s)
        .split(" ")
        .filter((w) => w.length >= 3) // trước là 4 -> tăng bắt cụm ngắn như "joy"
        .slice(0, 8);
}

function pickBestVocabLineIdxDirectional(
    tokens: string[],
    vocabIndex: ReturnType<typeof buildVocabLineIndex>,
    lines: string[],
    starts: number[],
    minStartPos?: number
): number {
    if (!tokens.length || vocabIndex.length === 0) return -1;
    let best = -1;
    let bestScore = 0;
    for (const v of vocabIndex) {
        if (minStartPos != null && v.start < minStartPos) continue; // chỉ xét phần sau
        let sc = 0;
        for (const t of tokens) if (v.norm.includes(t)) sc++;
        if (sc > bestScore) {
            bestScore = sc;
            best = lineIndexForPos(starts, lines, v.start);
        }
    }
    return best;
}

function pickBestVocabLineIdx(
    tokens: string[],
    vocabIndex: ReturnType<typeof buildVocabLineIndex>,
    lines: string[],
    starts: number[]
): number {
    return pickBestVocabLineIdxDirectional(tokens, vocabIndex, lines, starts, undefined);
}

/* ---------- tìm “best hit” ---------- */
function findBestHit(
    content: string,
    vocabStart: number,
    needle: string,
    vocabIndex: ReturnType<typeof buildVocabLineIndex>,
    lines: string[],
    starts: number[],
    headerIdx: number
): { start: number; end: number } | null {
    if (!needle.trim()) return null;

    // Ưu tiên tìm trong vùng sau vocabStart (giải thích)
    const raw = normForSearch(content.slice(Math.max(0, vocabStart)));
    const posInSlice = raw.indexOf(normForSearch(needle));
    if (posInSlice >= 0) {
        // cố map lại index thô bằng findIndexNormalized
        const globalSlice = content.slice(Math.max(0, vocabStart));
        const idx = findIndexNormalized(globalSlice, needle);
        if (idx >= 0) {
            const start = Math.max(0, vocabStart) + idx;
            return { start, end: start + needle.length };
        }
    }

    // Match theo token với vocabIndex
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

    // Fallback toàn văn
    const anywhereIdx = findIndexNormalized(content, needle);
    if (anywhereIdx >= 0) return { start: anywhereIdx, end: anywhereIdx + needle.length };

    // Fallback cuối: tìm gần transcript phần đầu nếu chưa tới vocab header
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
}

function firstIdxAfter(entries: TranscriptEntry[], t: number) {
    let lo = 0,
        hi = entries.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (entries[mid].sec > t) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}

/* ====== THUẬT TOÁN MỚI: tái dựng câu và tìm theo “đuôi + bổ sung” ====== */

/** Tách text thành mảng câu, giữ nguyên dấu kết câu (., ?, !) */
function splitIntoSentencesKeepDot(s: string): string[] {
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
}

/** Lấy câu trước đó đầy đủ, đi lùi tối đa maxBackLines để tìm dấu chấm. */
function getFullPreviousSentence(entries: TranscriptEntry[], idx: number, maxBackLines = 3) {
    let buf = entries[idx]?.text ?? "";
    let i = idx - 1;
    let count = 0;
    while (i >= 0 && count < maxBackLines) {
        buf = `${entries[i].text} ${buf}`.trim();
        if (/[.!?]/.test(buf)) break;
        i--;
        count++;
    }
    // Lấy câu kết thúc gần nhất
    const sentences = splitIntoSentencesKeepDot(buf);
    if (!sentences.length) return "";
    const last = sentences[sentences.length - 1];
    return /[.!?]$/.test(last) ? last : sentences.length >= 2 ? sentences[sentences.length - 2] : last;
}

/** Bổ sung phần thiếu cho câu chưa có dấu kết thúc bằng cách lấy dòng kế tiếp. */
function completeSentenceForward(
    entries: TranscriptEntry[],
    idxStart: number,
    initial: string,
    maxForwardLines = 2
) {
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
    // cắt đến dấu câu đầu tiên để được 1 câu hoàn chỉnh
    const parts = splitIntoSentencesKeepDot(acc);
    return parts.length ? parts[0] : acc;
}

/** Sinh các “yêu cầu tìm kiếm” theo thứ tự ưu tiên từ một dòng transcript. */
function buildSearchPlanForLine(
    entries: TranscriptEntry[],
    idx: number
): Array<{ highlightNeedle: string; searchNeedle: string }> {
    const line = entries[idx]?.text ?? "";
    const nextLine = entries[idx + 1]?.text ?? "";
    const segs = splitIntoSentencesKeepDot(line);

    const plan: Array<{ highlightNeedle: string; searchNeedle: string }> = [];
    if (!segs.length) return plan;

    // 1) Đuôi câu trước (nếu phần đầu kết thúc bằng dấu câu)
    const first = segs[0];
    if (/[.!?]$/.test(first)) {
        const fullPrev = getFullPreviousSentence(entries, idx);
        const searchNeedle = fullPrev || first;
        if (first.trim().length >= MIN_SEARCH_LEN) {
            plan.push({
                highlightNeedle: first,
                searchNeedle,
            });
        }
    }

    // 2) Các câu tiếp theo trong chính dòng
    for (let i = 1; i < segs.length; i++) {
        const sent = segs[i];
        if (sent.trim().length >= MIN_SEARCH_LEN) {
            plan.push({
                highlightNeedle: sent,
                searchNeedle: sent,
            });
        }
    }

    // 3) Nếu cuối dòng còn mảnh chưa chấm — bổ sung từ dòng sau
    const tailNoDot = segs[segs.length - 1];
    if (tailNoDot && !/[.!?]$/.test(tailNoDot)) {
        const completed = completeSentenceForward(entries, idx, tailNoDot + " " + nextLine);
        if (tailNoDot.trim().length >= MIN_SEARCH_LEN) {
            plan.push({
                highlightNeedle: tailNoDot.trim(),
                searchNeedle: completed.trim(),
            });
        }
    }

    // 4) Nếu không tách được gì, vẫn thử cả dòng
    if (!plan.length && line.trim().length >= MIN_SEARCH_LEN) {
        plan.push({ highlightNeedle: line.trim(), searchNeedle: line.trim() });
    }

    return plan;
}

/* ==================== Component ==================== */
const NoteEditor: FC<NoteEditorProps> = ({ currentTime = 0 }) => {
    const [mode, setMode] = useState<"read" | "edit">(isMobileUA ? "read" : "edit");
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [searchArea, setSearchArea] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const [lines, setLines] = useState<string[]>([]);
    const [starts, setStarts] = useState<number[]>([]);
    const [headerIdx, setHeaderIdx] = useState<number>(-1);
    const [vocabStart, setVocabStart] = useState(0);
    const [entries, setEntries] = useState<TranscriptEntry[]>([]);
    const [vocabIndex, setVocabIndex] = useState<ReturnType<typeof buildVocabLineIndex>>([]);
    const [sectionStarts, setSectionStarts] = useState<{ line: number; pos: number }[]>([]);
    const [nextIdx, setNextIdx] = useState(0);

    const prevTimeRef = useRef(0);
    const [displayHtml, setDisplayHtml] = useState<string>("");
    const [showDebug, setShowDebug] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const titleWrapperRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<HTMLDivElement>(null);

    /** NEW: bám theo section đang hiển thị */
    const lastSectionStartRef = useRef<number | null>(null);

    /* Ẩn gợi ý tiêu đề khi click ngoài */
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (titleWrapperRef.current && !titleWrapperRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    /* Parse lại khi content thay đổi */
    useEffect(() => {
        const located = locateVocabulary(content);
        setLines(located.lines);
        setStarts(located.starts);
        setHeaderIdx(located.headerIdx);
        setVocabStart(located.vocabStart);

        const es = parseTranscriptFromTop(located.lines, located.headerIdx);
        setEntries(es);

        setVocabIndex(buildVocabLineIndex(located.lines, located.starts, located.headerIdx));
        setSectionStarts(computeSectionStarts(located.lines, located.starts));
        setNextIdx(firstIdxAfter(es, prevTimeRef.current));
        setDisplayHtml("");
        lastSectionStartRef.current = null; // reset bám section khi thay content
    }, [content]);

    /* Đồng bộ theo thời gian – áp dụng thuật toán “đuôi + bổ sung” */
    useEffect(() => {
        const prev = prevTimeRef.current;
        prevTimeRef.current = currentTime;
        if (entries.length === 0) return;

        // Seek lùi -> cho phép nhảy về trước: reset bám section
        if (currentTime < prev - SEEK_BACK_THRESHOLD) {
            setNextIdx(firstIdxAfter(entries, currentTime));
            lastSectionStartRef.current = null;
            return;
        }

        // Xác định dòng transcript đang "bao" currentTime
        const j = Math.max(0, Math.min(firstIdxAfter(entries, currentTime) - 1, entries.length - 1));
        // Cập nhật con trỏ chạy tiến (không dùng trực tiếp cho plan nhưng giữ để debug tương thích cũ)
        setNextIdx(firstIdxAfter(entries, currentTime));

        // Tạo kế hoạch tìm kiếm theo dòng hiện tại
        const plan = buildSearchPlanForLine(entries, j);
        if (!plan.length) return;

        const allowedMinPos = Math.max(vocabStart, lastSectionStartRef.current ?? vocabStart);

        // Duyệt các phương án theo thứ tự ưu tiên
        for (const { highlightNeedle, searchNeedle } of plan) {
            if (highlightNeedle.length < MIN_SEARCH_LEN) continue;

            // 1) ƯU TIÊN: khớp vocab theo hướng tiến (tokens của searchNeedle)
            const tokens = tokensFromSentence(searchNeedle);
            const vocabLineIdx = pickBestVocabLineIdxDirectional(
                tokens,
                vocabIndex,
                lines,
                starts,
                allowedMinPos
            );

            if (vocabLineIdx >= 0 && starts[vocabLineIdx] >= vocabStart) {
                const { html, sectionStartPos } = buildSectionExplainHtmlByLine(
                    content,
                    starts,
                    sectionStarts,
                    vocabLineIdx,
                    // chỉ highlight đúng mảnh trên UI:
                    highlightNeedle
                );
                if (html) {
                    setDisplayHtml(html);
                    lastSectionStartRef.current = sectionStartPos;
                    return;
                }
            }

            // 2) Fallback: tìm theo văn bản (searchNeedle) rồi clamp theo section và highlight mảnh
            const hit = findBestHit(
                content,
                vocabStart,
                searchNeedle,
                vocabIndex,
                lines,
                starts,
                headerIdx
            );
            if (hit) {
                const { html, sectionStartPos } = buildSectionExplainHtmlByPos(
                    content,
                    sectionStarts,
                    hit.start,
                    highlightNeedle
                );
                // chỉ chấp nhận nếu không lùi về trước
                if (html && sectionStartPos >= allowedMinPos) {
                    setDisplayHtml(html);
                    lastSectionStartRef.current = sectionStartPos;
                    return;
                }

                // 3) Fallback cuối: context (vẫn clamp trong section), vẫn highlight mảnh ở head nếu có
                setDisplayHtml(
                    buildContextHtml(
                        content,
                        lines,
                        starts,
                        headerIdx,
                        hit,
                        undefined,
                        undefined,
                        highlightNeedle,
                        sectionStarts
                    )
                );
                const { startPos } = getSectionBoundsByPos(sectionStarts, hit.start, content.length);
                lastSectionStartRef.current = startPos;
                return;
            }
            // thử phương án tiếp theo trong plan...
        }
        // nếu tất cả phương án đều không tìm được -> giữ nguyên displayHtml
    }, [
        currentTime,
        entries,
        vocabStart,
        vocabIndex,
        lines,
        starts,
        headerIdx,
        sectionStarts,
        content,
    ]);

    // Luôn đưa viewer về đầu khi thay đoạn
    useEffect(() => {
        const el = viewerRef.current;
        if (!el) return;
        requestAnimationFrame(() => {
            el.scrollTop = 0;
            requestAnimationFrame(() => {
                el.scrollTop = 0;
            });
        });
    }, [displayHtml]);

    /* --------- CRUD ghi chú + Search thủ công --------- */
    const fetchNotes = (keyword = "") => {
        const notes: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("note_")) {
                const noteTitle = key.slice(5);
                const noteContent = localStorage.getItem(key) ?? "";
                if (
                    !keyword ||
                    noteTitle.toLowerCase().includes(keyword.toLowerCase()) ||
                    noteContent.toLowerCase().includes(keyword.toLowerCase())
                ) {
                    notes.push(noteTitle);
                }
            }
        }
        setSuggestions(notes);
        setShowSuggestions(notes.length > 0);
    };

    const handleTitleChange = (v: string) => {
        setTitle(v);
        fetchNotes(v);
    };

    const handleSelectSuggestion = (noteTitle: string) => {
        setTitle(noteTitle);
        setContent(localStorage.getItem("note_" + noteTitle) ?? "");
        setShowSuggestions(false);
    };

    const handleClearTitle = () => setTitle("");
    const handleClearContent = () => {
        setContent("");
        setDisplayHtml("");
        lastSectionStartRef.current = null;
    };
    const handleClearSearchArea = () => setSearchArea("");

    const handlePasteContent = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setContent(text);
        } catch {
            alert("Không thể lấy dữ liệu clipboard");
        }
    };

    const handleSaveNote = () => {
        const name = title.trim();
        if (!name) return alert("Vui lòng nhập tên bản lưu.");
        if (!content.trim()) return alert("Vui lòng nhập nội dung.");
        localStorage.setItem("note_" + name, content.trim());
        alert("Đã lưu với tên: " + name);
        fetchNotes("");
    };

    const handleClearAllNotes = () => {
        let removed = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("note_")) {
                localStorage.removeItem(key);
                removed++;
                i--;
            }
        }
        alert(`Đã xoá ${removed} bản lưu!`);
        setSuggestions([]);
        setShowSuggestions(false);
        setTitle("");
        setContent("");
        setNextIdx(0);
        setDisplayHtml("");
        lastSectionStartRef.current = null;
    };

    // Search thủ công: giữ logic cũ, nhưng vẫn ưu tiên vocab trước, và chỉ bôi ở head
    const doSearch = () => {
        if (!searchArea.trim()) return;
        const tokens = tokensFromSentence(searchArea);
        const vocabLineIdx = pickBestVocabLineIdx(tokens, vocabIndex, lines, starts);
        if (vocabLineIdx >= 0 && starts[vocabLineIdx] >= vocabStart) {
            const { html, sectionStartPos } = buildSectionExplainHtmlByLine(
                content,
                starts,
                sectionStarts,
                vocabLineIdx,
                searchArea
            );
            if (html) {
                setDisplayHtml(html);
                lastSectionStartRef.current = sectionStartPos;
                return;
            }
        }
        const hit = findBestHit(
            content,
            vocabStart,
            searchArea,
            vocabIndex,
            lines,
            starts,
            headerIdx
        );
        if (hit) {
            const { html, sectionStartPos } = buildSectionExplainHtmlByPos(
                content,
                sectionStarts,
                hit.start,
                searchArea
            );
            if (html) {
                setDisplayHtml(html);
                lastSectionStartRef.current = sectionStartPos;
            } else {
                // fallback context (cho search thủ công) — không bôi body
                setDisplayHtml(
                    buildContextHtml(
                        content,
                        lines,
                        starts,
                        headerIdx,
                        hit,
                        undefined,
                        undefined,
                        searchArea,
                        sectionStarts
                    )
                );
                const { startPos } = getSectionBoundsByPos(sectionStarts, hit.start, content.length);
                lastSectionStartRef.current = startPos;
            }
        } else alert("Không tìm thấy từ cần tìm.");
    };

    const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        doSearch();
    };

    const viewerEmptyText = useMemo(() => {
        if (!content.trim()) return "Chưa có nội dung. Hãy dán transcript + :::VOCAB::: (hoặc Key Vocabulary).";
        if (!displayHtml) return "Chưa có đoạn nào khớp. Phát video hoặc dùng ô Search để xem đoạn liên quan.";
        return "";
    }, [content, displayHtml]);

    return (
        <div className="flex-1 min-h-0 relative bg-white p-3 rounded-xl w-full max-w-[725px] shadow-lg flex flex-col mt-2">
            <div className="relative mb-2" ref={titleWrapperRef}>
                <Input
                    type="text"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Nhập tên bản lưu..."
                    className="w-full pr-8"
                    onFocus={() => fetchNotes(title)}
                    onClick={() => fetchNotes(title)}
                />
                {title && (
                    <IconButton
                        icon={<img src="/icons/deleteButton.svg" alt="Xóa" width={20} height={20} />}
                        onClick={handleClearTitle}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                    />
                )}
                {showSuggestions && (
                    <SuggestionList suggestions={suggestions} onSelect={handleSelectSuggestion} />
                )}
            </div>

            <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-gray-600">Chế độ:</span>
                <button
                    type="button"
                    onClick={() => setMode("read")}
                    className={`px-2 py-1 rounded ${mode === "read" ? "bg-blue-600 text-white" : "bg-gray-200"
                        }`}
                >
                    Xem
                </button>
                <button
                    type="button"
                    onClick={() => setMode("edit")}
                    className={`px-2 py-1 rounded ${mode === "edit" ? "bg-blue-600 text-white" : "bg-gray-200"
                        }`}
                >
                    Chỉnh sửa
                </button>

                <label className="ml-auto flex items-center gap-2 text-xs text-gray-600">
                    <input
                        type="checkbox"
                        checked={showDebug}
                        onChange={(e) => setShowDebug(e.target.checked)}
                    />
                    {" "}
                    Debug
                </label>
            </div>

            <div className="flex flex-col gap-3 mb-2 flex-1 min-h-0">
                {mode === "edit" && (
                    <div className="relative">
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder={NOTE_PLACEHOLDER}
                            className="w-full p-2 rounded border border-gray-300 box-border text-base leading-[25px] focus:border-blue-500 focus:outline-none h-36 max-h-[30vh] resize-y"
                            spellCheck={false}
                        />
                        {content && (
                            <IconButton
                                icon={<img src="/icons/deleteButton.svg" alt="Xóa nội dung" width={20} height={20} />}
                                onClick={handleClearContent}
                                className="absolute right-2 top-2 bg-white/80 hover:bg-white rounded"
                                ariaLabel="Xóa nội dung ghi chú"
                            />
                        )}
                    </div>
                )}

                <div className="flex flex-col w-full rounded border border-gray-300 bg-gray-50 flex-1 min-h-0">
                    <div className="px-3 py-2 border-b text-sm text-gray-600 shrink-0">
                        Nội dung <b>tiêu đề + Key Vocabulary</b> của section hiện tại (tới trước số tiếp theo)
                    </div>
                    <div
                        ref={viewerRef}
                        className="flex-1 min-h-0 p-3 text-base leading-[25px] whitespace-pre-wrap break-words overflow-y-auto overscroll-contain"
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML={
                            viewerEmptyText
                                ? { __html: `<span class="text-gray-400">${viewerEmptyText}</span>` }
                                : { __html: displayHtml }
                        }
                    />
                </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-2 shrink-0">
                <form
                    onSubmit={handleSearchSubmit}
                    className="flex items-center border border-blue-500 rounded-full overflow-hidden bg-white relative h-8 w-[220px] mr-2"
                >
                    <Input
                        type="text"
                        value={searchArea}
                        onChange={(e) => setSearchArea(e.target.value)}
                        placeholder="Search"
                        className="flex-1 border-none outline-none px-2 pr-8 text-base"
                        enterKeyHint="search"
                        autoComplete="off"
                    />
                    {searchArea && (
                        <IconButton
                            icon={<img src="/icons/deleteButton.svg" alt="Xóa" width={20} height={20} />}
                            onClick={handleClearSearchArea}
                            className="absolute right-12 top-1/2 -translate-y-1/2"
                        />
                    )}
                    <button
                        type="submit"
                        className="bg-gray-100 px-3 cursor-pointer text-lg h-full rounded-r-full"
                        aria-label="Thực hiện tìm kiếm"
                    >
                        🔍
                    </button>
                </form>

                <IconButton
                    icon={<img src="/icons/clipboard-paste.svg" alt="Paste" width={24} height={24} />}
                    onClick={handlePasteContent}
                    className="bg-gray-200 hover:bg-gray-300 rounded h-[30px] w-[30px]"
                />

                <button
                    type="button"
                    onClick={handleSaveNote}
                    className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-800 transition-colors"
                >
                    Lưu
                </button>

                <IconButton
                    icon={<img src="/icons/trash.svg" alt="Clear all" width={20} height={20} />}
                    onClick={handleClearAllNotes}
                    className="bg-gray-300 hover:bg-red-500 rounded h-[30px] w-[30px]"
                />
            </div>

            {showDebug && (
                <div className="mt-2 text-[11px] text-gray-600 space-x-3 shrink-0">
                    <span>Transcript lines: {entries.length}</span>
                    <span>t={currentTime?.toFixed(1)}s</span>
                    <span>nextIdx={Math.min(nextIdx, entries.length)}</span>
                    <span>headerIdx={headerIdx}</span>
                    <span>sections={sectionStarts.length}</span>
                </div>
            )}
        </div>
    );
};

export default NoteEditor;
