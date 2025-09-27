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
const VIEWPORT_PAD = 130;

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

/* ================= text utils ================= */
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

function buildVocabLineIndex(lines: string[], starts: number[], headerIdx: number) {
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
    const s0 = content.indexOf(needle, vocabStart);
    if (s0 >= 0) return { start: s0, end: s0 + needle.length };

    const normNeedle = normalize(needle);
    if (!normNeedle) return null;
    for (const ln of vocabIndex) {
        if (ln.norm.includes(normNeedle)) return { start: ln.start, end: ln.end };
    }
    return null;
}

function firstIdxAfter(entries: TranscriptEntry[], t: number) {
    let lo = 0, hi = entries.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (entries[mid].sec > t) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}

/* ================= hybrid editor helpers ================= */
/** Convert chỉ số ký tự (start/end) -> DOM Range trong mirror */
function rangeByChar(
    root: HTMLElement,
    start: number,
    end: number
): Range | null {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    function locate(pos: number) {
        let remaining = pos;
        let n: Node | null;
        while ((n = walker.nextNode())) {
            const t = n as Text;
            const len = t.data.length;
            if (remaining <= len) return { node: t, offset: remaining };
            remaining -= len;
        }
        return null;
    }
    const s = Math.max(0, Math.min(start, root.innerText.length));
    const e = Math.max(s, Math.min(end, root.innerText.length));
    const sPos = locate(s);
    const ePos = (() => {
        // walker đã ở cuối, tạo walker mới để tìm end
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        let remain = e;
        let nn: Node | null;
        while ((nn = w.nextNode())) {
            const t = nn as Text;
            const len = t.data.length;
            if (remain <= len) return { node: t, offset: remain };
            remain -= len;
        }
        return null;
    })();

    if (!sPos || !ePos) return null;
    const rg = document.createRange();
    rg.setStart(sPos.node, sPos.offset);
    rg.setEnd(ePos.node, ePos.offset);
    return rg;
}

const NoteEditor: FC<NoteEditorProps> = ({ currentTime = 0 }) => {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");

    // tìm nhanh trong note
    const [searchArea, setSearchArea] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // dữ liệu parse
    const [entries, setEntries] = useState<TranscriptEntry[]>([]);
    const [vocabStart, setVocabStart] = useState(0);
    const [vocabIndex, setVocabIndex] = useState<ReturnType<typeof buildVocabLineIndex>>([]);

    // con trỏ "mốc kế tiếp"
    const [nextIdx, setNextIdx] = useState(0);
    const prevTimeRef = useRef(0);

    // Hybrid editor refs
    const wrapRef = useRef<HTMLDivElement | null>(null);     // khung cuộn
    const mirrorRef = useRef<HTMLDivElement | null>(null);   // hiển thị chữ (thấy được)
    const inputRef = useRef<HTMLTextAreaElement | null>(null); // textarea chồng lên (ẩn)

    // Ẩn gợi ý tiêu đề khi click ngoài
    const titleWrapperRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const wrap = titleWrapperRef.current;
            if (wrap && !wrap.contains(e.target as Node)) setShowSuggestions(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    /* Parse khi content thay đổi */
    useEffect(() => {
        const { lines, starts, headerIdx, vocabStart } = locateVocabulary(content);
        setVocabStart(vocabStart);
        const es = parseTranscriptFromTop(lines, headerIdx);
        setEntries(es);
        setVocabIndex(buildVocabLineIndex(lines, starts, headerIdx));
        setNextIdx(firstIdxAfter(es, prevTimeRef.current));

        // đồng bộ mirror text (tránh dùng dangerouslySetInnerHTML)
        if (mirrorRef.current) {
            mirrorRef.current.textContent = content;
        }
    }, [content]);

    /* Đồng bộ input <textarea> khi mount/clear/paste */
    useEffect(() => {
        if (inputRef.current && inputRef.current.value !== content) {
            inputRef.current.value = content;
        }
    }, [content]);

    /* Auto-scroll theo currentTime — cuộn TRONG khung wrap (div) */
    useEffect(() => {
        const prev = prevTimeRef.current;
        prevTimeRef.current = currentTime;

        const wrap = wrapRef.current;
        const mirror = mirrorRef.current;
        const input = inputRef.current;
        if (!wrap || !mirror || !input || entries.length === 0) return;

        // Seek lùi → reset mốc
        if (currentTime < prev - SEEK_BACK_THRESHOLD) {
            setNextIdx(firstIdxAfter(entries, currentTime));
            return;
        }
        if (nextIdx >= entries.length || currentTime < entries[nextIdx].sec) return;

        // Nhảy qua nhiều mốc → lấy mốc cuối <= currentTime
        let j = nextIdx;
        while (j + 1 < entries.length && currentTime >= entries[j + 1].sec) j++;

        const text = entries[j].text.trim();
        setNextIdx(j + 1);
        if (text.length < MIN_SEARCH_LEN) return;

        const hit = findInVocabulary(content, vocabStart, text, vocabIndex);
        if (!hit) return;

        // Đặt selection trong <textarea> để thao tác copy/edit vẫn đúng,
        // nhưng SCROLL bằng mirror + wrap (ổn định trên iOS)
        try { input.focus({ preventScroll: true } as any); } catch { }
        try { input.setSelectionRange(hit.start, hit.end); } catch { }

        requestAnimationFrame(() => {
            const rg = rangeByChar(mirror, hit.start, hit.end);
            if (!rg) return;
            const rect = rg.getBoundingClientRect();
            const wrapRect = wrap.getBoundingClientRect();
            const deltaTop = rect.top - wrapRect.top;
            const targetTop = Math.max(0, wrap.scrollTop + deltaTop - VIEWPORT_PAD);

            const anyWrap = wrap as any;
            try {
                if (typeof anyWrap.scrollTo === "function") {
                    anyWrap.scrollTo({ top: targetTop, behavior: "smooth" });
                } else {
                    anyWrap.scrollTop = targetTop;
                }
            } catch {
                (wrap as any).scrollTop = targetTop;
            }

            // Sync scroll của textarea cho caret không lệch
            input.scrollTop = wrap.scrollTop;
        });
    }, [currentTime, entries, nextIdx, content, vocabStart, vocabIndex]);

    /* ===== CRUD ghi chú ===== */
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
        const txt = localStorage.getItem("note_" + noteTitle) ?? "";
        setTitle(noteTitle);
        setContent(txt);
        setShowSuggestions(false);
        if (mirrorRef.current) mirrorRef.current.textContent = txt;
        if (inputRef.current) inputRef.current.value = txt;
    };

    const handleClearTitle = () => setTitle("");
    const handleClearContent = () => {
        setContent("");
        if (mirrorRef.current) mirrorRef.current.textContent = "";
        if (inputRef.current) inputRef.current.value = "";
    };
    const handleClearSearchArea = () => setSearchArea("");

    const handlePasteContent = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setContent(text);
            if (mirrorRef.current) mirrorRef.current.textContent = text;
            if (inputRef.current) inputRef.current.value = text;
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
        setSuggestions([]); setShowSuggestions(false);
        setTitle(""); setContent(""); setNextIdx(0);
        if (mirrorRef.current) mirrorRef.current.textContent = "";
        if (inputRef.current) inputRef.current.value = "";
    };

    /* ===== Search: Enter + nút 🔍 ===== */
    const doSearch = () => {
        const wrap = wrapRef.current;
        const mirror = mirrorRef.current;
        const input = inputRef.current;
        if (!searchArea.trim() || !wrap || !mirror || !input) return;

        const idx = content.toLowerCase().indexOf(searchArea.toLowerCase());
        if (idx !== -1) {
            try { input.focus({ preventScroll: true } as any); } catch { }
            requestAnimationFrame(() => {
                const rg = rangeByChar(mirror, idx, idx + searchArea.length);
                if (!rg) return;
                const rect = rg.getBoundingClientRect();
                const wrapRect = wrap.getBoundingClientRect();
                const deltaTop = rect.top - wrapRect.top;
                const targetTop = Math.max(0, wrap.scrollTop + deltaTop - VIEWPORT_PAD);

                const anyWrap = wrap as any;
                try {
                    if (typeof anyWrap.scrollTo === "function") {
                        anyWrap.scrollTo({ top: targetTop, behavior: "smooth" });
                    } else {
                        anyWrap.scrollTop = targetTop;
                    }
                } catch {
                    (wrap as any).scrollTop = targetTop;
                }

                // đặt selection thật trong textarea (cho copy/edit)
                try { input.setSelectionRange(idx, idx + searchArea.length); } catch { }
                input.scrollTop = wrap.scrollTop;
            });
        } else {
            alert("Không tìm thấy từ cần tìm.");
        }
    };

    const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        doSearch();
    };

    /* ===== Render ===== */
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

            {/* Hybrid editor */}
            <div className="flex-1 flex flex-col mb-2 relative">
                {/* Placeholder khi rỗng */}
                {content.trim().length === 0 && (
                    <div className="pointer-events-none absolute left-3 top-2 text-gray-400 whitespace-pre-wrap">
                        {NOTE_PLACEHOLDER}
                    </div>
                )}

                {/* Khung cuộn (div) */}
                <div
                    ref={wrapRef}
                    className="relative flex-1 w-full rounded border border-gray-300 box-border text-base leading-[25px] focus-within:border-blue-500"
                    style={{
                        overflowY: "auto",
                        WebkitOverflowScrolling: "touch",
                    }}
                >
                    {/* Lớp hiển thị mirror (thấy chữ) */}
                    <div
                        ref={mirrorRef}
                        className="absolute inset-0 p-2 whitespace-pre-wrap break-words"
                        aria-hidden="false"
                    />

                    {/* Textarea nhận input (chồng lên, trong suốt) */}
                    <textarea
                        ref={inputRef}
                        defaultValue={content}
                        spellCheck={false}
                        onInput={(e) => {
                            const v = (e.currentTarget.value ?? "").replace(/\r/g, "");
                            setContent(v);
                            if (mirrorRef.current) mirrorRef.current.textContent = v;
                        }}
                        className="absolute inset-0 p-2 w-full h-full resize-none bg-transparent text-transparent caret-black outline-none"
                        style={{
                            // dùng đúng font/line-height để caret & selection khớp vị trí
                            fontFamily: "inherit",
                            fontSize: "inherit",
                            lineHeight: "25px",
                            letterSpacing: "inherit",
                            // cho iOS cuộn mượt khi người dùng kéo tay
                            WebkitOverflowScrolling: "touch",
                            // selection vẫn hoạt động (màu caret đen, chữ transparent)
                            // nếu muốn thấy selection, có thể tô overlay riêng.
                        }}
                    />
                </div>

                {content && (
                    <IconButton
                        icon={<img src="/icons/deleteButton.svg" alt="Xóa" width={20} height={20} />}
                        onClick={handleClearContent}
                        className="absolute right-0 top-0"
                    />
                )}
            </div>

            {/* Footer: Search + actions */}
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
                    onClick={() => {
                        const wrap = wrapRef.current;
                        const input = inputRef.current;
                        if (!wrap) return;
                        const anyWrap = wrap as any;
                        try {
                            if (typeof anyWrap.scrollTo === "function") anyWrap.scrollTo({ top: 0, behavior: "smooth" });
                            else anyWrap.scrollTop = 0;
                        } catch {
                            (wrap as any).scrollTop = 0;
                        }
                        if (input) input.scrollTop = 0;
                    }}
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
        </div>
    );
};

export default NoteEditor;
