import type { FC } from "react";
import { useState } from "react";
import Input from "./Input";
import IconButton from "./IconButton";
import SuggestionList from "./SuggestionList";

type YoutubeLinkInputProps = {
    value: string;
    onChange: (v: string) => void;
    onClear: () => void;
    onPaste: () => void;
    onPlay: () => void;
    placeholder?: string;
    className?: string;
};

const STORAGE_KEY = "youtube_links";
const MAX_HISTORY = 15;

function loadHistory(): string[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw) as unknown;
        return Array.isArray(arr)
            ? (arr.filter((x) => typeof x === "string") as string[])
            : [];
    } catch {
        return [];
    }
}

function saveHistory(link: string) {
    const t = link.trim();
    if (!t) return;
    const current = loadHistory();
    const without = current.filter((x) => x.toLowerCase() !== t.toLowerCase());
    const next = [t, ...without].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

const YoutubeLinkInput: FC<YoutubeLinkInputProps> = ({
    value,
    onChange,
    onClear,
    onPaste,
    onPlay,
    placeholder = "Enter link YouTube...",
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
        refreshSuggestions(v);
    };

    const handleSelectSuggestion = (link: string) => {
        onChange(link);
        setShowSuggestions(false);
    };

    const handleClear = () => {
        onClear();
        setShowSuggestions(false);
    };

    const handlePlayClick = () => {
        if (value.trim()) {
            saveHistory(value);
            onPlay();
            setShowSuggestions(false);
        }
    };

    return (
        <div className={`flex items-center relative w-full max-w-[560px] ${className}`}>
            <div className="relative flex-1">
                <Input
                    type="text"
                    value={value}
                    onChange={(e) => handleChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full pr-10 bg-white"
                    onFocus={handleFocus}
                    onClick={handleClick}
                />
                {value && (
                    <IconButton
                        icon={<img src="/icons/deleteButton.svg" alt="Xóa" width={20} height={20} />}
                        onClick={handleClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        ariaLabel="Clear input"
                    />
                )}
                {/* Suggestions */}
                {showSuggestions && (
                    <SuggestionList
                        suggestions={suggestions}
                        onSelect={handleSelectSuggestion}
                    />
                )}
            </div>

            <IconButton
                icon={<img src="/icons/clipboard-paste.svg" alt="Paste" width={24} height={24} />}
                onClick={onPaste}
                className="ml-2 bg-gray-200 hover:bg-gray-300 rounded h-[37px] w-[37px]"
                ariaLabel="Paste clipboard"
            />

            <button
                type="button"
                onClick={handlePlayClick}
                className="ml-2 px-4 py-2 text-white bg-red-700 rounded hover:bg-red-800 transition-colors cursor-pointer"
            >
                Play
            </button>
        </div>
    );
};

export default YoutubeLinkInput;
