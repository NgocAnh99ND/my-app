// src/components/NoteEditor/NoteEditor.tsx
import { useEffect, useMemo, useRef, useState, type FC, type FormEvent } from "react";
import Input from "../Input";
import IconButton from "../IconButton";
import SuggestionList from "../SuggestionList";
import { useNoteEngine } from "./useNoteEngine";
import { NOTE_PLACEHOLDER } from "./constants";

type NoteEditorProps = { currentTime?: number };

const isMobileUA =
    typeof navigator !== "undefined" &&
    /Android|iP(hone|ad|od)|Mobi/i.test(navigator.userAgent);

/** Khoảng cách cách mép trên một chút khi cuộn caret lên đầu */
const EDIT_TOP_OFFSET = 28;

/** Mirror textarea để tính toạ độ caret tương đối theo pixel (top) */
const getCaretTopPx = (ta: HTMLTextAreaElement, caretIndex: number) => {
    const computed = window.getComputedStyle(ta);
    const div = document.createElement("div");
    const span = document.createElement("span");

    // copy các style ảnh hưởng đến wrap/line-height/box
    const props = [
        "boxSizing",
        "width",
        "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
        "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
        "fontFamily", "fontSize", "fontWeight", "fontStyle",
        "letterSpacing", "textTransform", "lineHeight",
        "textAlign", "whiteSpace", "overflowWrap",
    ] as const;

    props.forEach((p) => {
        // @ts-ignore
        div.style[p] = computed[p];
    });

    // đảm bảo wrap giống textarea
    div.style.whiteSpace = "pre-wrap";
    div.style.overflowWrap = "break-word";
    div.style.position = "absolute";
    div.style.visibility = "hidden";
    div.style.pointerEvents = "none";
    div.style.top = "0";
    div.style.left = "0";
    div.style.zIndex = "-9999";

    const value = ta.value;
    const upToCaret = value.slice(0, Math.max(0, Math.min(caretIndex, value.length)));
    const rest = value.slice(Math.max(0, Math.min(caretIndex, value.length)));

    // Để giữ layout chính xác như textarea
    div.textContent = "";
    div.appendChild(document.createTextNode(upToCaret));
    // caret marker
    span.textContent = rest.length ? rest[0] : ".";
    // thu nhỏ marker để đo chính xác dòng hiện tại
    span.style.display = "inline-block";
    div.appendChild(span);

    document.body.appendChild(div);
    const markerTop = span.offsetTop; // top tương đối trong div
    document.body.removeChild(div);

    // offsetTop đã bao gồm padding trên của mirror => tương ứng nội dung scrollable
    return markerTop;
};

const NoteEditor: FC<NoteEditorProps> = ({ currentTime = 0 }) => {
    // UI states
    const [mode, setMode] = useState<"read" | "edit">(isMobileUA ? "read" : "edit");
    const [title, setTitle] = useState("");
    const [searchArea, setSearchArea] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const titleWrapperRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Engine cho READ mode (đồng bộ với video)
    const {
        content,
        setContent,
        displayHtml,
        viewerEmptyText,
        // doSearch,          // chỉ dùng ở READ (nếu cần)
        clearEngine,
        showDebug,
        setShowDebug,
        debugInfo,
    } = useNoteEngine(currentTime);

    // --- SEARCH trong EDIT mode ---
    const [editSearchTerm, setEditSearchTerm] = useState<string>("");
    const [editHits, setEditHits] = useState<Array<{ start: number; end: number }>>([]);
    const [editHitIndex, setEditHitIndex] = useState<number>(-1);

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
            } else if (
                noteTitle.toLowerCase().includes(q) ||
                noteContent.toLowerCase().includes(q)
            ) {
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

    /** Cuộn caret lên sát đỉnh textarea nhưng chừa offset nhỏ */
    const scrollCaretToTopWithOffset = (ta: HTMLTextAreaElement, startIndex: number) => {
        const caretTop = getCaretTopPx(ta, startIndex);
        const target = caretTop - EDIT_TOP_OFFSET;
        const maxScroll = ta.scrollHeight - ta.clientHeight;
        const clamped = Math.max(0, Math.min(target, maxScroll));

        // đặt selection trước rồi cuộn 2 khung hình để tránh tranh chấp layout
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                ta.scrollTop = clamped;
            });
        });
    };

    const focusToHitTop = (hit: { start: number; end: number }) => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(hit.start, hit.end);
        scrollCaretToTopWithOffset(el, hit.start);
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
            focusToHitTop(hits[0]);
            return;
        }

        // Cùng term -> sang hit kế tiếp
        if (!editHits.length) {
            alert("Không tìm thấy kết quả.");
            return;
        }
        const next = (editHitIndex + 1) % editHits.length;
        setEditHitIndex(next);
        focusToHitTop(editHits[next]);
    };

    // Submit nút 🔍
    const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const term = searchArea.trim();
        if (!term) return;

        if (mode === "edit") {
            doEditSearchNext(term);      // chỉ tìm trong EDIT
        } else {
            // READ mode: không hiển thị ô search/nút — nên không vào nhánh này
            // Nếu muốn hỗ trợ tạm: doSearch(term);
        }
    };

    const viewerBannerHtml = useMemo(
        () =>
            viewerEmptyText
                ? { __html: `<span class="text-gray-400">${viewerEmptyText}</span>` }
                : { __html: displayHtml },
        [viewerEmptyText, displayHtml]
    );

    return (
        <div className="h-full flex flex-col bg-white rounded-xl shadow-lg p-3 overflow-hidden">
            {/* Title + gợi ý bản lưu */}
            <div className="relative mb-2 shrink-0" ref={titleWrapperRef}>
                <Input
                    type="text"
                    value={title}
                    onChange={(e) => {
                        const v = e.target.value;
                        setTitle(v);
                        fetchNotes(v); // khi gõ thì lọc theo keyword
                    }}
                    placeholder="Tên bản lưu..."
                    className="w-full pr-8"
                    onFocus={() => fetchNotes("")}  // luôn show toàn bộ khi chưa gõ
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
                            // đổi nội dung -> reset hit tìm kiếm edit
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
                    <input
                        type="checkbox"
                        checked={showDebug}
                        onChange={(e) => setShowDebug(e.target.checked)}
                    />{" "}
                    Debug
                </label>
            </div>

            {/* Nội dung chính */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {mode === "edit" ? (
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => {
                            setContent(e.target.value);
                            // invalidate các hit cũ khi nội dung đổi
                            setEditHits([]);
                            setEditHitIndex(-1);
                        }}
                        placeholder={NOTE_PLACEHOLDER}
                        className="flex-1 min-h-0 w-full p-2 border rounded text-base leading-[25px]
              focus:border-blue-500 focus:outline-none
              resize-none overflow-auto"
                        spellCheck={false}
                    />
                ) : (
                    <div className="flex-1 min-h-0 flex flex-col border rounded bg-gray-50 overflow-hidden">
                        <div
                            ref={viewerRef}
                            className="flex-1 min-h-0 p-3 text-base leading-[25px] whitespace-pre-wrap overflow-auto"
                            // eslint-disable-next-line react/no-danger
                            dangerouslySetInnerHTML={viewerBannerHtml}
                        />
                    </div>
                )}
            </div>

            {/* Thanh Actions: CHỈ hiện ở Edit */}
            {mode === "edit" && (
                <div className="flex items-center justify-end gap-2 mt-2 shrink-0">
                    {/* Ô Search chỉ dùng trong Edit */}
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
