type SuggestionListProps = {
    suggestions: string[];
    onSelect: (value: string) => void;
};

function extractVideoId(url: string): string | null {
    const reg =
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([^\s&#?/]+)/;
    const match = url.match(reg);
    return match ? match[1] : null;
}

const SuggestionList = ({ suggestions, onSelect }: SuggestionListProps) => (
    <div className="absolute top-full left-0 w-full bg-white border border-gray-300 rounded shadow z-20 max-h-60 overflow-y-auto text-left">
        {suggestions.map((item, idx) => {
            const videoId = extractVideoId(item);
            const thumbnail = videoId
                ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
                : null;

            return (
                <div
                    key={idx}
                    className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100"
                    onClick={() => onSelect(item)}
                >
                    {thumbnail && (
                        <img
                            src={thumbnail}
                            alt="thumbnail"
                            className="w-12 h-8 object-cover rounded"
                        />
                    )}
                    <span className="truncate text-sm">{item}</span>
                </div>
            );
        })}
    </div>
);

export default SuggestionList;
