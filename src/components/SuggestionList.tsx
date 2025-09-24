type SuggestionListProps = {
    suggestions: string[];
    onSelect: (value: string) => void;
};

const SuggestionList = ({ suggestions, onSelect }: SuggestionListProps) => (
    <div className="absolute top-full left-0 w-full bg-white border border-gray-300 rounded shadow z-20 max-h-40 overflow-y-auto text-left">
        {suggestions.map((item, idx) => (
            <div
                key={idx}
                className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                onClick={() => onSelect(item)}
            >
                {item}
            </div>
        ))}
    </div>
);

export default SuggestionList;