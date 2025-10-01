// Các hằng số/regex tách từ file cũ

export const SEEK_BACK_THRESHOLD = 1.5;
export const MIN_SEARCH_LEN = 3; // bắt cả từ ngắn như "joy."
export const CONTEXT_LINES_UP = 4;
export const CONTEXT_LINES_DOWN = 6;

export const NOTE_PLACEHOLDER = `Dán theo cấu trúc:

00:00:00 - And I'm starting to get really nervous
00:00:02 - because for a long time no one says
...

:::VOCAB:::
Nervous: lo lắng, bồn chồn
Deep breath: hít một hơi thật sâu
...`;

export const VOCAB_SENTINEL = ":::VOCAB:::";

/** Nới lỏng để hợp mobile/bullet */
export const VOCAB_HEADER_RE = new RegExp(
    String.raw`(^|\n)[^\S\r\n]*(?:[+\-•*o●◦·‣▪▫]+[.)]?[^\S\r\n]*)?(?:key[^\S\r\n]*)?(?:vocab(?:ulary)?|vocabulary|từ[^\S\r\n]*vựng)[^\S\r\n]*(?:-|:|：|–|—)?[^\S\r\n]*`,
    "i"
);

/** Dòng số thứ tự section như "46." (cho phép khoảng trắng) */
export const sectionHeaderRegex = /^\s*\d+\.\s*$/;
/** Dòng gạch phân đoạn (nếu có) */
export const sectionDividerRegex = /^[\u2500\u2501\u2504\u2505_\-=–—]{6,}\s*$/;
