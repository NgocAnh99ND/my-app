import type { FC, FormEvent } from "react";
import { useState } from "react";
import Input from "./Input";
import IconButton from "./IconButton";
import SuggestionList from "./SuggestionList";

type SearchBarProps = {
    value: string;
    onChange: (v: string) => void;
    onClear: () => void;
    onSearch: () => void;          // sẽ được gọi khi submit (Enter) hoặc bấm nút
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

    const handleFocus = () => refreshSuggestions(value);
    const handleClick = () => refreshSuggestions(value);

    const handleChange = (v: string) => {
        onChange(v);
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

    // ✅ Submit chung cho Enter (desktop/mobile) và nút 🔍
    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!value.trim()) return;
        saveHistory(value);
        onSearch();
        refreshSuggestions(value);
    };

    return (
        <div className={`relative w-full max-w-[560px] ${className}`}>
            <form
                onSubmit={handleSubmit}
                className="flex items-center border border-blue-500 rounded-full overflow-hidden bg-white h-10 w-full"
            >
                <Input
                    type="search"
                    value={value}
                    onChange={(e) => handleChange(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 border-none outline-none px-3 pr-10 text-base"
                    onFocus={handleFocus}
                    onClick={handleClick}
                    enterKeyHint="search"       // mobile: hiện nút "Search"
                    autoComplete="off"
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

                {/* Nút search (cũng submit form) */}
                <button
                    type="submit"
                    aria-label="Thực hiện tìm kiếm"
                    className="border-none bg-gray-100 px-4 cursor-pointer text-lg h-full rounded-r-full"
                >
                    🔍
                </button>
            </form>

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
