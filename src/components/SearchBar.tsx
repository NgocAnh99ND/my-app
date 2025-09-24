import type { FC } from "react";
import Input from "./Input";
import IconButton from "./IconButton";

type SearchBarProps = {
    value: string;
    onChange: (v: string) => void;
    onClear: () => void;
    onSearch: () => void;
    placeholder?: string;
    className?: string;
};

const SearchBar: FC<SearchBarProps> = ({
    value,
    onChange,
    onClear,
    onSearch,
    placeholder = "Search",
    className = "",
}) => (
    <div
        className={`flex items-center border border-blue-500 rounded-full overflow-hidden bg-white relative h-10 w-full max-w-[560px] ${className}`}
    >
        <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 border-none outline-none px-3 pr-7 text-base"
        />
        {/* Nút clear input */}
        {value && (
            <IconButton
                icon={
                    <img src="/icons/deleteButton.svg" alt="Xóa" width={20} height={20} />
                }
                onClick={onClear}
                className="absolute right-16 top-1/2 -translate-y-1/2"
                ariaLabel="Clear input"
            />
        )}
        {/* Nút search */}
        <button
            type="button"
            onClick={onSearch}
            className="search-button border-none bg-gray-100 px-4 cursor-pointer text-lg h-full rounded-r-full"
        >
            🔍
        </button>
    </div>
);

export default SearchBar;