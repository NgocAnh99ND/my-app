import { sectionDividerRegex, sectionHeaderRegex } from "./constants";

export const computeSectionStarts = (lines: string[], starts: number[]) => {
    const sections: { line: number; pos: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (sectionHeaderRegex.test(lines[i]) || sectionDividerRegex.test(lines[i])) {
            sections.push({ line: i, pos: starts[i] });
        }
    }
    return sections;
};

export const lineIndexForPos = (starts: number[], lines: string[], pos: number) => {
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
};

export const getSectionBoundsByPos = (
    sectionStarts: { line: number; pos: number }[],
    anchorPos: number,
    totalLen: number
) => {
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
};

export const getSectionBoundsByLine = (
    starts: number[],
    sectionStarts: { line: number; pos: number }[],
    lineIdx: number,
    totalLen: number
) => {
    const pos = starts[Math.max(0, Math.min(lineIdx, starts.length - 1))] || 0;
    return getSectionBoundsByPos(sectionStarts, pos, totalLen);
};
