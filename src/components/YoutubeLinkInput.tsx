import type { FC } from "react";
import Input from "./Input";
import IconButton from "./IconButton";
import SuggestionList from "./SuggestionList"; // bạn sẽ tạo ở phần suggestion riêng

type YoutubeLinkInputProps = {
    value: string;
    onChange: (v: string) => void;
    onClear: () => void;
    onPaste: () => void;
    onPlay: () => void;
    suggestions: string[];
    onSelectSuggestion: (link: string) => void;
    placeholder?: string;
    className?: string;
    onFocus?: () => void; // <-- Thêm dòng này!
};

const YoutubeLinkInput: FC<YoutubeLinkInputProps> = ({
    value,
    onChange,
    onClear,
    onPaste,
    onPlay,
    suggestions,
    onSelectSuggestion,
    placeholder = "Enter link YouTube...",
    className = "",
}) => (
    <div
        className={`flex items-center relative w-full max-w-[560px] ${className}`}
    >
        <div className="relative flex-1">
            <Input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full pr-10 bg-white"
            />
            {value && (
                <IconButton
                    icon={
                        <img
                            src="/icons/deleteButton.svg"
                            alt="Xóa"
                            width={20}
                            height={20}
                        />
                    }
                    onClick={onClear}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    ariaLabel="Clear input"
                />
            )}
            {/* Suggestions khi input focus */}
            {suggestions.length > 0 && (
                <SuggestionList
                    suggestions={suggestions}
                    onSelect={onSelectSuggestion}
                />
            )}
        </div>
        <IconButton
            icon={
                <img
                    src="/icons/clipboard-paste.svg"
                    alt="Paste"
                    width={24}
                    height={24}
                />
            }
            onClick={onPaste}
            className="ml-2 bg-gray-200 hover:bg-gray-300 rounded h-[37px] w-[37px]"
            ariaLabel="Paste clipboard"
        />
        <button
            type="button"
            onClick={onPlay}
            className="ml-2 px-4 py-2 text-white bg-red-700 rounded hover:bg-red-800 transition-colors cursor-pointer"
        >
            Play
        </button>
    </div>
);

export default YoutubeLinkInput;