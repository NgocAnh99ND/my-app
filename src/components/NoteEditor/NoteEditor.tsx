// src/components/NoteEditor/NoteEditor.tsx
import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type FC,
    type FormEvent,
    type ReactNode,
} from "react";
import Input from "../Input";
import IconButton from "../IconButton";
import SuggestionList from "../SuggestionList";
import { useNoteEngine } from "./useNoteEngine";
import { NOTE_PLACEHOLDER } from "./constants";

type NoteEditorProps = { currentTime?: number };

const isMobileUA =
    typeof navigator !== "undefined" &&
    /Android|iP(hone|ad|od)|Mobi/i.test(navigator.userAgent);

/** Khoảng cách cách mép trên một chút khi cuộn hit lên đầu */
const EDIT_TOP_OFFSET = 28;

const NoteEditor: FC<NoteEditorProps> = ({ currentTime = 0 }) => {
    // UI states
    const [mode, setMode] = useState<"read" | "edit">(isMobileUA ? "read" : "edit");
    const [title, setTitle] = useState("");
    const [searchArea, setSearchArea] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const titleWrapperRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<HTMLDivElement>(null);

    // Div contentEditable để edit
    const editorRef = useRef<HTMLDivElement>(null);

    // Engine cho READ mode (đồng bộ với video)
    const {
        content,
        setContent,
        displayHtml,
        viewerEmptyText,
        clearEngine,
        showDebug,
        setShowDebug,
        debugInfo,
    } = useNoteEngine(currentTime);

    // --- SEARCH trong EDIT mode ---
    const [editSearchTerm, setEditSearchTerm] = useState<string>("");
    const [editHits, setEditHits] = useState<Array<{ start: number; end: number }>>([]);
    const [editHitIndex, setEditHitIndex] = useState<number>(-1);

    // ref tới span của hit đang active => cuộn tức thì
    const activeHitRef = useRef<HTMLSpanElement | null>(null);
    const setActiveRef = (el: HTMLSpanElement | null) => {
        activeHitRef.current = el;
    };

    // Click ngoài -> ẩn gợi ý
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (titleWrapperRef.current && !titleWrapperRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Scroll viewer về đầu khi đổi đoạn (read mode)
    useEffect(() => {
        if (!viewerRef.current) return;
        viewerRef.current.scrollTop = 0;
    }, [displayHtml]);

    // Gợi ý danh sách bản lưu
    const fetchNotes = (keyword = "") => {
        const q = keyword.trim().toLowerCase();
        const notes: string[] = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith("note_")) continue;

            const noteTitle = key.slice(5);
            const noteContent = localStorage.getItem(key) ?? "";

            if (!q) {
                notes.push(noteTitle); // không có keyword -> lấy tất cả
            } else if (noteTitle.toLowerCase().includes(q) || noteContent.toLowerCase().includes(q)) {
                notes.push(noteTitle);
            }
        }

        notes.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
        setSuggestions(notes);
        setShowSuggestions(notes.length > 0);
    };

    const handleSaveNote = () => {
        const name = title.trim();
        if (!name) return alert("Nhập tên bản lưu.");
        if (!content.trim()) return alert("Nhập nội dung.");
        localStorage.setItem("note_" + name, content.trim());
        alert("Đã lưu: " + name);
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
        setTitle("");
        clearEngine();
    };

    // ====== TÌM KIẾM TRONG EDIT MODE ======
    const escapeReg = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const findAllHits = (text: string, term: string) => {
        if (!term.trim()) return [];
        const re = new RegExp(escapeReg(term), "ig");
        const hits: Array<{ start: number; end: number }> = [];
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
            const start = m.index;
            const end = start + m[0].length;
            hits.push({ start, end });
            if (m.index === re.lastIndex) re.lastIndex++; // an toàn
        }
        return hits;
    };

    /** Nhảy tới kết quả tiếp theo của term trong EDIT mode */
    const doEditSearchNext = (term: string) => {
        const t = term.trim();
        if (!t) return;

        // Nếu đổi term -> tính lại toàn bộ hits
        if (t.toLowerCase() !== editSearchTerm.toLowerCase()) {
            const hits = findAllHits(content, t);
            setEditSearchTerm(t);
            setEditHits(hits);
            if (!hits.length) {
                setEditHitIndex(-1);
                alert("Không tìm thấy kết quả.");
                return;
            }
            setEditHitIndex(0);
            return;
        }

        // Cùng term -> sang hit kế tiếp
        if (!editHits.length) {
            alert("Không tìm thấy kết quả.");
            return;
        }
        const next = (editHitIndex + 1) % editHits.length;
        setEditHitIndex(next);
    };

    // Submit nút 🔍
    const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const term = searchArea.trim();
        if (!term) return;

        if (mode === "edit") {
            doEditSearchNext(term); // chỉ tìm trong EDIT
        }
    };

    // Khi content đổi trong EDIT: reset hits để tránh sai lệch index
    useEffect(() => {
        setEditHits([]);
        setEditHitIndex(-1);
        // giữ lại term người dùng đã gõ (searchArea) nhưng không auto tìm lại
    }, [content]);

    // Cuộn TỨC THÌ và ĐÚNG VỊ TRÍ tới hit đang chọn (không smooth, trừ padding, không cuộn khi đã nằm trong khung)
    useLayoutEffect(() => {
        const container = mode === "edit" ? editorRef.current : viewerRef.current;
        const el = activeHitRef.current;
        if (!container || !el) return;

        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();

        const bandTop = containerRect.top + EDIT_TOP_OFFSET;
        const bandBottom = containerRect.bottom; // cho phép đụng đáy mới cuộn

        const isAbove = elRect.top < bandTop;
        const isBelow = elRect.bottom > bandBottom;

        if (isAbove || isBelow) {
            // Khoảng cách của span tới mép trên container (theo viewport),
            // cộng với scrollTop hiện tại -> ra scrollTop tuyệt đối mong muốn.
            const target =
                container.scrollTop + (elRect.top - containerRect.top) - EDIT_TOP_OFFSET;

            const maxScroll = container.scrollHeight - container.clientHeight;
            const clamped = Math.max(0, Math.min(target, maxScroll));

            // TẮT mọi smooth-scroll
            (container as any).style.scrollBehavior = "auto";
            container.scrollTop = clamped;
        }
    }, [mode, editHitIndex, editHits.length]);

    // Render content với highlight khi có term
    const renderWithHighlights = (
        text: string,
        hits: Array<{ start: number; end: number }>,
        activeIdx: number
    ): ReactNode => {
        if (!hits.length) return text;

        const nodes: ReactNode[] = [];
        let last = 0;

        hits.forEach((h, i) => {
            if (h.start > last) {
                nodes.push(<span key={`t-${last}`}>{text.slice(last, h.start)}</span>);
            }
            const isActive = i === activeIdx;
            const ref = isActive ? setActiveRef : undefined;
            nodes.push(
                <span
                    key={`h-${h.start}-${h.end}`}
                    ref={ref}
                    className={isActive ? "bg-yellow-300 text-black rounded px-0.5" : "bg-yellow-200 rounded px-0.5"}
                >
                    {text.slice(h.start, h.end)}
                </span>
            );
            last = h.end;
        });

        if (last < text.length) {
            nodes.push(<span key={`t-last-${last}`}>{text.slice(last)}</span>);
        }

        return nodes;
    };

    const viewerBannerHtml = useMemo(
        () =>
            viewerEmptyText
                ? { __html: `<span class="text-gray-400">${viewerEmptyText}</span>` }
                : { __html: displayHtml },
        [viewerEmptyText, displayHtml]
    );

    return (
        <div className="h-full flex flex-col bg-white rounded-xl shadow-lg p-2 overflow-hidden">
            {/* Title + gợi ý bản lưu */}
            <div className="relative mb-2 shrink-0" ref={titleWrapperRef}>
                <Input
                    type="text"
                    value={title}
                    onChange={(e) => {
                        const v = e.target.value;
                        setTitle(v);
                        fetchNotes(v);
                    }}
                    placeholder="Tên bản lưu..."
                    className="w-full pr-8"
                    onFocus={() => fetchNotes("")}
                    onClick={() => fetchNotes("")}
                />

                {title && (
                    <IconButton
                        icon={<img src="/icons/deleteButton.svg" alt="X" width={20} height={20} />}
                        onClick={() => {
                            setTitle("");
                            fetchNotes("");
                            setShowSuggestions(true);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                    />
                )}

                {showSuggestions && (
                    <SuggestionList
                        suggestions={suggestions}
                        onSelect={(noteTitle) => {
                            setTitle(noteTitle);
                            setContent(localStorage.getItem("note_" + noteTitle) ?? "");
                            setShowSuggestions(false);
                            setEditHits([]);
                            setEditHitIndex(-1);
                            setEditSearchTerm("");
                            setSearchArea("");
                        }}
                    />
                )}
            </div>

            {/* Chuyển chế độ */}
            <div className="flex items-center gap-2 mb-2 shrink-0">
                <button
                    onClick={() => setMode("read")}
                    className={`px-2 py-1 rounded ${mode === "read" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
                >
                    Xem
                </button>
                <button
                    onClick={() => setMode("edit")}
                    className={`px-2 py-1 rounded ${mode === "edit" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
                >
                    Chỉnh sửa
                </button>

                <label className="ml-auto flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} /> Debug
                </label>
            </div>

            {/* Nội dung chính */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {mode === "edit" ? (
                    <div className="flex-1 min-h-0 flex flex-col border rounded bg-white overflow-hidden">
                        <div
                            ref={editorRef}
                            contentEditable
                            suppressContentEditableWarning
                            onInput={(e) => {
                                const text = (e.currentTarget.textContent ?? "").replace(/\r\n/g, "\n");
                                setContent(text);
                            }}
                            className="flex-1 min-h-0 p-3 text-base leading-[25px] whitespace-pre-wrap overflow-auto outline-none"
                            style={{ scrollBehavior: "auto" }} // đảm bảo KHÔNG smooth
                            spellCheck={false}
                        >
                            {editSearchTerm && editHits.length > 0
                                ? renderWithHighlights(content, editHits, Math.max(0, editHitIndex))
                                : content || <span className="text-gray-400 select-none">{NOTE_PLACEHOLDER}</span>}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 flex flex-col border rounded bg-gray-50 overflow-hidden">
                        <div
                            ref={viewerRef}
                            className="flex-1 min-h-0 p-3 text-base leading-[25px] whitespace-pre-wrap overflow-auto"
                            // eslint-disable-next-line react/no-danger
                            dangerouslySetInnerHTML={viewerBannerHtml}
                            style={{ scrollBehavior: "auto" }} // không smooth
                        />
                    </div>
                )}
            </div>

            {/* Thanh Actions: CHỈ hiện ở Edit */}
            {mode === "edit" && (
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
                            className="flex-1 px-2 pr-8 text-base border-none outline-none"
                        />
                        {searchArea && (
                            <IconButton
                                icon={<img src="/icons/deleteButton.svg" alt="X" width={20} height={20} />}
                                onClick={() => setSearchArea("")}
                                className="absolute right-12 top-1/2 -translate-y-1/2"
                            />
                        )}
                        <button type="submit" className="bg-gray-100 px-3 cursor-pointer text-lg h-full">
                            🔍
                        </button>
                    </form>

                    <IconButton
                        icon={<img src="/icons/clipboard-paste.svg" alt="Paste" width={24} height={24} />}
                        onClick={async () => {
                            try {
                                const text = await navigator.clipboard.readText();
                                setContent(text);
                                setEditHits([]);
                                setEditHitIndex(-1);
                            } catch {
                                alert("Không thể lấy clipboard");
                            }
                        }}
                        className="bg-gray-200 hover:bg-gray-300 rounded h-[30px] w-[30px]"
                    />

                    <button
                        onClick={handleSaveNote}
                        className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-800"
                    >
                        Lưu
                    </button>

                    <IconButton
                        icon={<img src="/icons/trash.svg" alt="Clear all" width={20} height={20} />}
                        onClick={handleClearAllNotes}
                        className="bg-gray-300 hover:bg-red-500 rounded h-[30px] w-[30px]"
                    />
                </div>
            )}

            {showDebug && (
                <div className="mt-2 text-[11px] text-gray-600 space-x-3 shrink-0">
                    <span>Transcript: {debugInfo.entriesCount}</span>
                    <span>t={currentTime.toFixed(1)}s</span>
                    <span>nextIdx={debugInfo.nextIdx}</span>
                    <span>headerIdx={debugInfo.headerIdx}</span>
                    <span>sections={debugInfo.sectionsCount}</span>
                </div>
            )}
        </div>
    );
};

export default NoteEditor;
