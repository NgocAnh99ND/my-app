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
    onSelectVideo: (videoId: string) => void;
};

const ResultList = ({ items, onSelectVideo }: ResultListProps) => {
    return (
        <div
            id="resultsContainer"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
            {items.map((it) => {
                const videoId = it.id?.videoId;
                if (!videoId) return null;
                return (
                    <ResultItem
                        key={videoId}
                        videoId={videoId}
                        title={it.snippet?.title ?? ""}
                        thumbnail={it.snippet?.thumbnails?.medium?.url ?? ""}
                        onClick={onSelectVideo}
                    />
                );
            })}
        </div>
    );
};

export default ResultList;
