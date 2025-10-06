import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

type YTItem = {
    id: { videoId: string };
    snippet: { title: string; thumbnails?: { medium?: { url?: string } } };
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

    // ✅ Thông báo realtime cho YoutubeLinkInput biết localStorage có thay đổi
    window.dispatchEvent(new Event("youtube_links_updated"));
}

export default function Result() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [items, setItems] = useState<YTItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const keyword = params.get("keyword") ?? localStorage.getItem("searchKeyword") ?? "";
    const API_KEY = import.meta.env.VITE_YT_API_KEY as string | undefined;

    useEffect(() => {
        if (!keyword) {
            setItems([]);
            return;
        }
        if (!API_KEY) {
            setErr("Thiếu API key. Hãy đặt VITE_YT_API_KEY trong .env");
            setItems([]);
            return;
        }
        setLoading(true);
        setErr(null);

        const url =
            "https://www.googleapis.com/youtube/v3/search" +
            `?part=snippet&type=video&maxResults=12&q=${encodeURIComponent(keyword)}` +
            `&key=${API_KEY}`;

        fetch(url)
            .then((r) => r.json())
            .then((data) => {
                if (data?.items) setItems(data.items);
                else {
                    setItems([]);
                    setErr("Không lấy được kết quả.");
                }
            })
            .catch((e) => {
                setErr(String(e));
                setItems([]);
            })
            .finally(() => setLoading(false));
    }, [keyword, API_KEY]);

    const results = useMemo(
        () =>
            (items || [])
                .map((it) => {
                    const id = it?.id?.videoId;
                    const title = it?.snippet?.title ?? "(no title)";
                    const thumb = it?.snippet?.thumbnails?.medium?.url;
                    return id ? { id, title, thumb } : null;
                })
                .filter(Boolean) as { id: string; title: string; thumb?: string }[],
        [items]
    );

    const handlePick = (videoId: string) => {
        const url = `https://www.youtube.com/watch?v=${videoId}`;

        // ✅ Lưu vào localStorage (để YoutubeLinkInput hiển thị ở Suggestion)
        saveHistory(url);

        // ✅ Gửi về Home để phát video
        localStorage.setItem("selectedVideoUrl", url);
        navigate("/");
    };

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-3">
                <h1 className="text-xl font-semibold">Search Results</h1>
                <div className="flex gap-3">
                    <button onClick={() => navigate(-1)} className="border px-3 py-1 rounded">
                        ⟵ Back
                    </button>
                    <Link to="/" className="underline px-2 py-1">Home</Link>
                </div>
            </div>

            <p className="mb-4">
                Keyword: <b>{keyword || "(empty)"} </b>
            </p>

            {loading && <p>Đang tải...</p>}
            {err && <p className="text-red-600">{err}</p>}
            {!loading && !err && results.length === 0 && <p>No result.</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {results.map((r) => (
                    <button
                        key={r.id}
                        onClick={() => handlePick(r.id)}
                        className="text-left bg-white rounded shadow hover:shadow-md transition p-2"
                    >
                        {r.thumb && (
                            <img
                                src={r.thumb}
                                alt={r.title}
                                className="w-full rounded mb-2 object-cover"
                            />
                        )}
                        <div className="text-sm line-clamp-2">{r.title}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}
