// Chuẩn hoá/escape/tìm kiếm mềm

export const normalize = (s: string) =>
    s
        .toLowerCase()
        .replace(/[“”"’']/g, "'")
        .replace(/[.,!?;:()[\]{}/\\]/g, "")
        .replace(/\s+/g, " ")
        .trim();

export const normForSearch = (s: string) =>
    s
        .toLowerCase()
        .replace(/[“”]/g, '"')
        .replace(/[’']/g, "'")
        .replace(/\s+/g, " ")
        .trim();

export const findIndexNormalized = (haystack: string, needle: string) => {
    const H = normForSearch(haystack);
    const N = normForSearch(needle);
    if (!N) return -1;
    const idx = H.indexOf(N);
    if (idx < 0) return -1;
    const esc = needle
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/[“”]/g, `["“”]`)
        .replace(/[’']/g, `['’]`)
        .replace(/\s+/g, `\\s+`);
    const re = new RegExp(esc, "i");
    const m = haystack.match(re);
    return m && m.index != null ? m.index : -1;
};

export const isAsciiSentence = (s: string) => {
    const letters = s.replace(/[^A-Za-z]/g, "").length;
    const total = s.replace(/\s/g, "").length;
    return total > 0 && letters / total >= 0.6;
};

export const escapeHtml = (s: string) =>
    s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
