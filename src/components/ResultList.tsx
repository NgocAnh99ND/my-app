import ResultItem from "./ResultItem";

type YTSearchItem = {
    id: { videoId: string };
    snippet: {
        title: string;
        thumbnails: { medium: { url: string } };
    };
};

type ResultListProps = {
    items: YTSearchItem[];
    onSelectVideo: (videoUrl: string) => void; // chỉ cần videoUrl
};

const STORAGE_KEY = "youtube_links";
const MAX_HISTORY = 50;

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

    // ✅ Phát tín hiệu realtime cho YoutubeLinkInput biết có link mới
    window.dispatchEvent(new Event("youtube_links_updated"));
}

const ResultList = ({ items, onSelectVideo }: ResultListProps) => {
    return (
        <div
            id="resultsContainer"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
            {items.map((it) => {
                const videoId = it.id?.videoId;
                if (!videoId) return null;

                const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

                const handleClick = () => {
                    // ✅ Lưu vào localStorage
                    saveHistory(videoUrl);

                    // ✅ Callback để Home hoặc ResultPage xử lý phát video
                    onSelectVideo(videoUrl);
                };

                return (
                    <ResultItem
                        key={videoId}
                        videoId={videoId}
                        title={it.snippet?.title ?? ""}
                        thumbnail={it.snippet?.thumbnails?.medium?.url ?? ""}
                        onClick={handleClick}
                    />
                );
            })}
        </div>
    );
};

export default ResultList;
