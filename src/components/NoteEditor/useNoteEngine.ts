import { useEffect, useMemo, useRef, useState } from "react";

import {
    MIN_SEARCH_LEN,
    SEEK_BACK_THRESHOLD,
} from "./constants";

import {
    locateVocabulary,
    parseTranscriptFromTop,
    firstIdxAfter,
} from "./parse";

import {
    computeSectionStarts,
    getSectionBoundsByPos,
} from "./section";

import {
    buildSectionExplainHtmlByLine,
    buildSectionExplainHtmlByPos,
    buildContextHtml,
} from "./render";

import {
    buildVocabLineIndex,
    tokensFromSentence,
    pickBestVocabLineIdx,
    pickBestVocabLineIdxDirectional,
    buildSearchPlanForLine,
    findBestHit,
} from "./search";

import type { TranscriptEntry } from "./types";

/** Hook “engine” cho NoteEditor */
export const useNoteEngine = (currentTime: number = 0) => {
    // --- state dữ liệu gốc ---
    const [content, setContent] = useState<string>("");

    // --- index/parse ---
    const [lines, setLines] = useState<string[]>([]);
    const [starts, setStarts] = useState<number[]>([]);
    const [headerIdx, setHeaderIdx] = useState<number>(-1);
    const [vocabStart, setVocabStart] = useState<number>(0);
    const [entries, setEntries] = useState<TranscriptEntry[]>([]);
    const [vocabIndex, setVocabIndex] = useState<ReturnType<typeof buildVocabLineIndex>>([]);
    const [sectionStarts, setSectionStarts] = useState<{ line: number; pos: number }[]>([]);
    const [nextIdx, setNextIdx] = useState<number>(0);

    // --- hiển thị ---
    const [displayHtml, setDisplayHtml] = useState<string>("");

    // --- debug ---
    const [showDebug, setShowDebug] = useState<boolean>(false);

    // --- refs phục vụ sync ---
    const prevTimeRef = useRef<number>(0);
    /** Bám theo section đang hiển thị để tránh “lùi” khi phát tới */
    const lastSectionStartRef = useRef<number | null>(null);

    // Parse lại khi content thay đổi
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

    // Đồng bộ theo thời gian – áp dụng thuật toán “đuôi + bổ sung”
    useEffect(() => {
        const prev = prevTimeRef.current;
        prevTimeRef.current = currentTime;

        if (!entries.length) return;

        // Nếu tua lùi đáng kể => reset bám section
        if (currentTime < prev - SEEK_BACK_THRESHOLD) {
            setNextIdx(firstIdxAfter(entries, currentTime));
            lastSectionStartRef.current = null;
            return;
        }

        // Dòng transcript đang bao currentTime
        const j = Math.max(0, Math.min(firstIdxAfter(entries, currentTime) - 1, entries.length - 1));
        setNextIdx(firstIdxAfter(entries, currentTime));

        // Kế hoạch tìm kiếm theo dòng hiện tại (đuôi + bổ sung)
        const plan = buildSearchPlanForLine(entries, j);
        if (!plan.length) return;

        const allowedMinPos = Math.max(vocabStart, lastSectionStartRef.current ?? vocabStart);

        for (const { highlightNeedle, searchNeedle } of plan) {
            if (highlightNeedle.length < MIN_SEARCH_LEN) continue;

            // 1) Ưu tiên match vocab theo hướng tiến
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
                    highlightNeedle
                );
                if (html) {
                    setDisplayHtml(html);
                    lastSectionStartRef.current = sectionStartPos;
                    return;
                }
            }

            // 2) Fallback: match theo văn bản rồi clamp theo section + highlight mảnh
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
                if (html && sectionStartPos >= allowedMinPos) {
                    setDisplayHtml(html);
                    lastSectionStartRef.current = sectionStartPos;
                    return;
                }

                // 3) Fallback cuối: context (clamp trong section)
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
        }
        // Không match => giữ nguyên displayHtml
    }, [currentTime, entries, vocabStart, vocabIndex, lines, starts, headerIdx, sectionStarts, content]);

    // API search thủ công
    const doSearch = (searchText: string) => {
        const term = searchText.trim();
        if (!term) return;

        const tokens = tokensFromSentence(term);
        const vocabLineIdx = pickBestVocabLineIdx(tokens, vocabIndex, lines, starts);

        if (vocabLineIdx >= 0 && starts[vocabLineIdx] >= vocabStart) {
            const { html, sectionStartPos } = buildSectionExplainHtmlByLine(
                content,
                starts,
                sectionStarts,
                vocabLineIdx,
                term
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
            term,
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
                term
            );
            if (html) {
                setDisplayHtml(html);
                lastSectionStartRef.current = sectionStartPos;
                return;
            }
            // context fallback
            setDisplayHtml(
                buildContextHtml(
                    content,
                    lines,
                    starts,
                    headerIdx,
                    hit,
                    undefined,
                    undefined,
                    term,
                    sectionStarts
                )
            );
            const { startPos } = getSectionBoundsByPos(sectionStarts, hit.start, content.length);
            lastSectionStartRef.current = startPos;
            return;
        }

        alert("Không tìm thấy từ cần tìm.");
    };

    const clearEngine = () => {
        setContent("");
        setDisplayHtml("");
        lastSectionStartRef.current = null;
    };

    const debugInfo = useMemo(
        () => ({
            entriesCount: entries.length,
            headerIdx,
            nextIdx: Math.min(nextIdx, entries.length),
            sectionsCount: sectionStarts.length,
        }),
        [entries.length, headerIdx, nextIdx, sectionStarts.length]
    );

    const viewerEmptyText = useMemo(() => {
        if (!content.trim())
            return "Chưa có nội dung. Hãy dán transcript + :::VOCAB::: (hoặc Key Vocabulary).";
        if (!displayHtml)
            return "Chưa có đoạn nào khớp. Phát video hoặc dùng ô Search để xem đoạn liên quan.";
        return "";
    }, [content, displayHtml]);

    return {
        // data
        content,
        setContent,

        // view
        displayHtml,
        viewerEmptyText,

        // engine actions
        doSearch,
        clearEngine,

        // debug
        showDebug,
        setShowDebug,
        debugInfo,
    };
};
