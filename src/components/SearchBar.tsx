import type { FC } from "react";
import { useState } from "react";
import Input from "./Input";
import IconButton from "./IconButton";
import SuggestionList from "./SuggestionList";

type SearchBarProps = {
    value: string;
    onChange: (v: string) => void;
    onClear: () => void;
    onSearch: () => void;
    placeholder?: string;
    className?: string;
};

const STORAGE_KEY = "search_keywords";
const MAX_HISTORY = 15;

function loadHistory(): string[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw) as unknown;
        return Array.isArray(arr) ? (arr.filter((x) => typeof x === "string") as string[]) : [];
    } catch {
        return [];
    }
}

function saveHistory(term: string) {
    const t = term.trim();
    if (!t) return;
    const current = loadHistory();
    const without = current.filter((x) => x.toLowerCase() !== t.toLowerCase());
    const next = [t, ...without].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

const SearchBar: FC<SearchBarProps> = ({
    value,
    onChange,
    onClear,
    onSearch,
    placeholder = "Search",
    className = "",
}) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const refreshSuggestions = (keyword = "") => {
        const all = loadHistory();
        const filtered = keyword
            ? all.filter((k) => k.toLowerCase().includes(keyword.toLowerCase()))
            : all;
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
    };

    const handleFocus = () => {
        refreshSuggestions(value);
    };

    const handleClick = () => {
        refreshSuggestions(value);
    };

    const handleChange = (v: string) => {
        onChange(v);
        // cập nhật gợi ý theo nội dung đang gõ
        refreshSuggestions(v);
    };

    const handleSelectSuggestion = (term: string) => {
        onChange(term);
        setShowSuggestions(false);
    };

    const handleClear = () => {
        onClear();
        setShowSuggestions(false);
    };

    const handleSearchClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        // lưu lịch sử trước, rồi gọi onSearch bên ngoài
        saveHistory(value);
        onSearch();
        // cập nhật gợi ý mới nhất (đưa term vừa tìm lên đầu)
        refreshSuggestions(value);
    };

    return (
        <div className={`relative w-full max-w-[560px] ${className}`}>
            <div className="flex items-center border border-blue-500 rounded-full overflow-hidden bg-white h-10 w-full">
                <Input
                    type="text"
                    value={value}
                    onChange={(e) => handleChange(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 border-none outline-none px-3 pr-10 text-base"
                    onFocus={handleFocus}
                    onClick={handleClick}
                />

                {/* Nút clear input */}
                {value && (
                    <IconButton
                        icon={<img src="/icons/deleteButton.svg" alt="Xóa" width={20} height={20} />}
                        onClick={handleClear}
                        className="absolute right-12 top-1/2 -translate-y-1/2"
                        ariaLabel="Xóa nội dung tìm kiếm"
                    />
                )}

                {/* Nút search */}
                <button
                    type="button"
                    onClick={handleSearchClick}
                    aria-label="Thực hiện tìm kiếm"
                    className="border-none bg-gray-100 px-4 cursor-pointer text-lg h-full rounded-r-full"
                >
                    🔍
                </button>
            </div>

            {/* Gợi ý dưới ô input */}
            {showSuggestions && (
                <div className="absolute left-0 right-0 mt-1 z-50">
                    <SuggestionList
                        suggestions={suggestions}
                        onSelect={handleSelectSuggestion}
                    />
                </div>
            )}
        </div>
    );
};

export default SearchBar;
