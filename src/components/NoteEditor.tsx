import { useState, useRef } from "react";
import Input from "./Input";
import IconButton from "./IconButton";
import SuggestionList from "./SuggestionList";

const NoteEditor = () => {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [searchArea, setSearchArea] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Lấy danh sách các bản lưu từ localStorage (có lọc theo keyword/tên)
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

    // Khi gõ tiêu đề
    const handleTitleChange = (v: string) => {
        setTitle(v);
        fetchNotes(v);
    };

    // Khi chọn suggestion
    const handleSelectSuggestion = (noteTitle: string) => {
        setTitle(noteTitle);
        setContent(localStorage.getItem("note_" + noteTitle) ?? "");
        setShowSuggestions(false);
    };

    // Xóa input
    const handleClearTitle = () => setTitle("");
    const handleClearContent = () => setContent("");
    const handleClearSearchArea = () => setSearchArea("");

    // Paste clipboard
    const handlePasteContent = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setContent(text);
        } catch {
            alert("Không thể lấy dữ liệu clipboard");
        }
    };

    // Lưu note vào localStorage
    const handleSaveNote = () => {
        if (!title.trim()) {
            alert("Vui lòng nhập tên bản lưu.");
            return;
        }
        if (!content.trim()) {
            alert("Vui lòng nhập nội dung.");
            return;
        }
        localStorage.setItem("note_" + title.trim(), content.trim());
        alert("Đã lưu với tên: " + title.trim());
        fetchNotes(""); // cập nhật gợi ý mới
    };

    // Xóa toàn bộ note
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
    };

    // Tìm kiếm từ trong textarea
    const handleSearchFromArea = () => {
        if (!searchArea.trim()) return;
        const idx = content.toLowerCase().indexOf(searchArea.toLowerCase());
        if (idx !== -1 && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(idx, idx + searchArea.length);
            // cuộn đến vị trí tìm thấy
            const lines = content.substring(0, idx).split("\n").length;
            textareaRef.current.scrollTop = (lines - 1) * 33; // 33px dòng (có thể chỉnh)
        } else {
            alert("Không tìm thấy từ cần tìm.");
        }
    };

    // Cuộn lên đầu textarea
    const handleScrollTop = () => {
        if (textareaRef.current) textareaRef.current.scrollTop = 0;
    };

    return (
        <div className="flex-1 relative bg-white p-3 rounded-xl w-full max-w-[725px] shadow-lg flex flex-col mt-4">
            {/* Tiêu đề + gợi ý bản lưu */}
            <div className="relative mb-2">
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
                        icon={
                            <img
                                src="/icons/deleteButton.svg"
                                alt="Xóa"
                                width={20}
                                height={20}
                            />
                        }
                        onClick={handleClearTitle}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                    />
                )}
                {/* Gợi ý bản lưu */}
                {showSuggestions && (
                    <SuggestionList
                        suggestions={suggestions}
                        onSelect={handleSelectSuggestion}
                    />
                )}
            </div>

            {/* Nội dung note */}
            <div className="flex-1 flex flex-col mb-2 relative">
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste nội dung tại đây..."
                    className="flex-1 w-full p-2 rounded border border-gray-300 resize-none box-border text-base leading-[25px] focus:border-blue-500 focus:outline-none"
                />
                {content && (
                    <IconButton
                        icon={
                            <img
                                src="/icons/deleteButton.svg"
                                alt="Xóa"
                                width={20}
                                height={20}
                            />
                        }
                        onClick={handleClearContent}
                        className="absolute right-0 top-0"
                    />
                )}
            </div>

            {/* Footer: các chức năng phụ */}
            <div className="flex items-center justify-end gap-2 mt-2">
                {/* Search trong textarea */}
                <div className="flex items-center border border-blue-500 rounded-full overflow-hidden bg-white relative h-8 w-[200px] mr-2">
                    <Input
                        type="text"
                        value={searchArea}
                        onChange={(e) => setSearchArea(e.target.value)}
                        placeholder="Search"
                        className="flex-1 border-none outline-none px-2 pr-8 text-base"
                    />
                    {searchArea && (
                        <IconButton
                            icon={
                                <img
                                    src="/icons/deleteButton.svg"
                                    alt="Xóa"
                                    width={20}
                                    height={20}
                                />
                            }
                            onClick={handleClearSearchArea}
                            className="absolute right-12 top-1/2 -translate-y-1/2"
                        />
                    )}
                    <button
                        type="button"
                        onClick={handleSearchFromArea}
                        className="searchArea bg-gray-100 px-3 cursor-pointer text-lg h-full rounded-r-full"
                    >
                        🔍
                    </button>
                </div>
                {/* Paste clipboard */}
                <IconButton
                    icon={
                        <img
                            src="/icons/clipboard-paste.svg"
                            alt="Paste"
                            width={24}
                            height={24}
                        />
                    }
                    onClick={handlePasteContent}
                    className="bg-gray-200 hover:bg-gray-300 rounded h-[30px] w-[30px]"
                />
                {/* Cuộn lên đầu */}
                <IconButton
                    icon={
                        <img
                            src="/icons/arrow-up.svg"
                            alt="Scroll lên đầu"
                            width={20}
                            height={20}
                        />
                    }
                    onClick={handleScrollTop}
                    className="bg-gray-100 hover:bg-gray-200 rounded-full h-[30px] w-[30px]"
                />
                {/* Lưu */}
                <button
                    type="button"
                    onClick={handleSaveNote}
                    className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-800 transition-colors"
                >
                    Lưu
                </button>
                {/* Xóa toàn bộ */}
                <IconButton
                    icon={
                        <img
                            src="/icons/trash.svg"
                            alt="Clear all"
                            width={20}
                            height={20}
                        />
                    }
                    onClick={handleClearAllNotes}
                    className="bg-gray-300 hover:bg-red-500 rounded h-[30px] w-[30px]"
                />
            </div>
        </div>
    );
};

export default NoteEditor;