// src/components/NoteEditor.tsx
import { useEffect, useRef, useState } from "react";
import type { FC, FormEvent } from "react";
import Input from "./Input";
import IconButton from "./IconButton";
import SuggestionList from "./SuggestionList";

type NoteEditorProps = {
    /** thời gian video (giây), cập nhật ~1s/lần từ Home */
    currentTime?: number;
};

type TranscriptEntry = { sec: number; text: string };

const SEEK_BACK_THRESHOLD = 1.5;
const MIN_SEARCH_LEN = 6;

const VIEWPORT_PAD = 130; // đẩy dòng trúng cách đỉnh ~130px

const NOTE_PLACEHOLDER = `
Dán theo cấu trúc:

00:00:00 - And I'm starting to get really nervous
00:00:02 - because for a long time no one says
...

Key Vocabulary
Nervous: lo lắng, bồn chồn
Deep breath: hít một hơi thật sâu
...`;

const headerRegex = /^\s*key\s*(?:-|:)?\s*vocab/i;

const timeToSec = (s: string) => {
    const p = s.trim().split(":").map(Number);
    if (p.some((n) => Number.isNaN(n))) return NaN;
    if (p.length === 2) return p[0] * 60 + p[1];
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    return NaN;
};

/* ---------- dựng chỉ số dòng & offset chuẩn ---------- */
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

function locateVocabulary(content: string) {
    const { lines, starts } = computeLines(content);
    const headerIdx = lines.findIndex((ln) => headerRegex.test(ln));
    const vocabStart =
        headerIdx >= 0
            ? headerIdx + 1 < starts.length
                ? starts[headerIdx + 1]
                : content.length
            : content.length;
    return { lines, starts, headerIdx, vocabStart };
}

function parseTranscriptFromTop(lines: string[], headerIdx: number): TranscriptEntry[] {
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

function findInVocabulary(
    content: string,
    vocabStart: number,
    needle: string,
    vocabIndex: ReturnType<typeof buildVocabLineIndex>
): { start: number; end: number } | null {
    // raw match trước
    const s0 = content.indexOf(needle, vocabStart);
    if (s0 >= 0) return { start: s0, end: s0 + needle.length };

    // fallback theo dòng đã normalize
    const normNeedle = normalize(needle);
    if (!normNeedle) return null;
    for (const ln of vocabIndex) {
        if (ln.norm.includes(normNeedle)) return { start: ln.start, end: ln.end };
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

/* ---------- mirror utils: đo offset pixel chính xác ---------- */
function copyTextareaStylesToMirror(ta: HTMLTextAreaElement, mirror: HTMLDivElement) {
    const cs = getComputedStyle(ta);
    const props = [
        "fontFamily",
        "fontSize",
        "fontStyle",
        "fontWeight",
        "lineHeight",
        "letterSpacing",
        "textTransform",
        "textIndent",
        "textAlign",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "borderTopWidth",
        "borderRightWidth",
        "borderBottomWidth",
        "borderLeftWidth",
        "boxSizing",
        "wordBreak",
        "overflowWrap",
    ] as const;
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordBreak = "break-word";
    mirror.style.overflowWrap = "anywhere";
    mirror.style.position = "fixed";
    mirror.style.visibility = "hidden";
    mirror.style.zIndex = "-1";
    mirror.style.left = "-9999px";
    mirror.style.top = "-9999px";
    mirror.style.width = ta.clientWidth + "px";
    props.forEach((p) => {
        // @ts-ignore
        mirror.style[p] = cs[p] as any;
    });
}

/** Đo toạ độ top (pixel) của vị trí `idx` trong content, theo wrap thật */
function measureOffsetTopPx(
    ta: HTMLTextAreaElement,
    mirror: HTMLDivElement,
    content: string,
    idx: number
) {
    copyTextareaStylesToMirror(ta, mirror);
    // set nội dung trước vị trí + marker zero-width
    mirror.textContent = content.slice(0, idx);
    const marker = document.createElement("span");
    marker.textContent = "\u200b"; // zero-width
    mirror.appendChild(marker);
    const top = marker.offsetTop; // pixel từ top mirror
    mirror.textContent = ""; // clean
    return top;
}

/* ==================== Component ==================== */
const NoteEditor: FC<NoteEditorProps> = ({ currentTime = 0 }) => {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");

    // tìm nhanh trong note
    const [searchArea, setSearchArea] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // dữ liệu đã parse
    const [entries, setEntries] = useState<TranscriptEntry[]>([]);
    const [vocabStart, setVocabStart] = useState(0);
    const [vocabIndex, setVocabIndex] = useState<ReturnType<typeof buildVocabLineIndex>>([]);

    // con trỏ "mốc kế tiếp"
    const [nextIdx, setNextIdx] = useState(0);
    const prevTimeRef = useRef(0);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const titleWrapperRef = useRef<HTMLDivElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null); // mirror ẩn để đo offset

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
        const { lines, starts, headerIdx, vocabStart } = locateVocabulary(content);
        setVocabStart(vocabStart);
        const es = parseTranscriptFromTop(lines, headerIdx);
        setEntries(es);
        setVocabIndex(buildVocabLineIndex(lines, starts, headerIdx));
        setNextIdx(firstIdxAfter(es, prevTimeRef.current));
    }, [content]);

    /* Đồng bộ theo thời gian: chỉ cuộn khi vượt mốc kế tiếp */
    useEffect(() => {
        const prev = prevTimeRef.current;
        prevTimeRef.current = currentTime;

        const ta = textareaRef.current;
        const mirror = mirrorRef.current;
        if (!ta || !mirror || entries.length === 0) return;

        // Seek lùi: reset mốc
        if (currentTime < prev - SEEK_BACK_THRESHOLD) {
            setNextIdx(firstIdxAfter(entries, currentTime));
            return;
        }

        if (nextIdx >= entries.length || currentTime < entries[nextIdx].sec) return;

        // nếu nhảy qua nhiều mốc trong 1 tick → lấy mốc cuối <= currentTime
        let j = nextIdx;
        while (j + 1 < entries.length && currentTime >= entries[j + 1].sec) j++;

        const text = entries[j].text.trim();
        setNextIdx(j + 1);

        if (text.length < MIN_SEARCH_LEN) return;

        const hit = findInVocabulary(content, vocabStart, text, vocabIndex);
        if (!hit) return;

        // highlight
        try { ta.focus(); } catch { }
        try { ta.setSelectionRange(hit.start, hit.end); } catch { }

        // ✅ đo offset chính xác và cuộn
        const topPx = measureOffsetTopPx(ta, mirror, content, hit.start);
        ta.scrollTo({ top: Math.max(0, topPx - VIEWPORT_PAD), behavior: "smooth" });
    }, [currentTime, entries, nextIdx, content, vocabStart, vocabIndex]);

    /* --------- CRUD ghi chú (giữ nguyên) --------- */
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

    const handleTitleChange = (v: string) => { setTitle(v); fetchNotes(v); };

    const handleSelectSuggestion = (noteTitle: string) => {
        setTitle(noteTitle);
        setContent(localStorage.getItem("note_" + noteTitle) ?? "");
        setShowSuggestions(false);
    };

    const handleClearTitle = () => setTitle("");
    const handleClearContent = () => setContent("");
    const handleClearSearchArea = () => setSearchArea("");

    const handlePasteContent = async () => {
        try { const text = await navigator.clipboard.readText(); setContent(text); }
        catch { alert("Không thể lấy dữ liệu clipboard"); }
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
        setSuggestions([]); setShowSuggestions(false);
        setTitle(""); setContent("");
        setNextIdx(0);
    };

    // ---- Search: dùng chung cho Enter & nút 🔍 ----
    const doSearch = () => {
        if (!searchArea.trim() || !textareaRef.current || !mirrorRef.current) return;
        const ta = textareaRef.current;
        const idx = content.toLowerCase().indexOf(searchArea.toLowerCase());
        if (idx !== -1) {
            try { ta.focus(); } catch { }
            try { ta.setSelectionRange(idx, idx + searchArea.length); } catch { }
            const topPx = measureOffsetTopPx(ta, mirrorRef.current, content, idx);
            ta.scrollTo({ top: Math.max(0, topPx - VIEWPORT_PAD), behavior: "smooth" });
        } else {
            alert("Không tìm thấy từ cần tìm.");
        }
    };

    const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        doSearch();
    };

    /* ---------------- render ---------------- */
    return (
        <div className="flex-1 relative bg-white p-3 rounded-xl w-full max-w-[725px] shadow-lg flex flex-col mt-2">
            {/* Tiêu đề + gợi ý */}
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

            {/* Nội dung ghi chú */}
            <div className="flex-1 flex flex-col mb-2 relative">
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={NOTE_PLACEHOLDER}
                    className="flex-1 w-full p-2 rounded border border-gray-300 resize-none box-border text-base leading-[25px] focus:border-blue-500 focus:outline-none"
                    spellCheck={false}
                />
                {/* mirror ẩn để đo toạ độ — giữ trong DOM để sẵn sàng đo */}
                <div ref={mirrorRef} aria-hidden="true" />

                {content && (
                    <IconButton
                        icon={<img src="/icons/deleteButton.svg" alt="Xóa" width={20} height={20} />}
                        onClick={handleClearContent}
                        className="absolute right-0 top-0"
                    />
                )}
            </div>

            {/* Footer: Search (Enter + nút) + actions */}
            <div className="flex items-center justify-end gap-2 mt-2">
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
                <IconButton
                    icon={<img src="/icons/arrow-up.svg" alt="Scroll lên đầu" width={20} height={20} />}
                    onClick={() => textareaRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
                    className="bg-gray-100 hover:bg-gray-200 rounded-full h-[30px] w-[30px]"
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

            {entries.length > 0 && (
                <div className="absolute left-3 bottom-3 text-xs text-gray-500 space-x-3">
                    <span>Transcript lines: {entries.length}</span>
                    <span>t={currentTime?.toFixed(1)}s</span>
                    <span>nextIdx={Math.min(nextIdx, entries.length)}</span>
                </div>
            )}
        </div>
    );
};

export default NoteEditor;
