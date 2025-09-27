import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import ResultList from "../components/ResultList";

const API_KEY = import.meta.env.VITE_YT_API_KEY || "";

type YTSearchItem = {
    id: { videoId: string };
    snippet: {
        title: string;
        thumbnails: { medium: { url: string } };
    };
};

export default function Result() {
    const navigate = useNavigate();
    const [params] = useSearchParams();

    const initialKeyword =
        params.get("keyword") ?? localStorage.getItem("searchKeyword") ?? "";

    const [keyword, setKeyword] = useState(initialKeyword);
    const [items, setItems] = useState<YTSearchItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const apiUrl = useMemo(() => {
        if (!keyword || !API_KEY) return null;
        const q = encodeURIComponent(keyword);
        return `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&maxResults=10&key=${API_KEY}`;
    }, [keyword]);

    useEffect(() => {
        if (!apiUrl) {
            setItems([]);
            return;
        }
        const ctrl = new AbortController();
        setLoading(true);
        setErr(null);

        fetch(apiUrl, { signal: ctrl.signal })
            .then((res) => res.json())
            .then((data) => setItems((data?.items as YTSearchItem[]) ?? []))
            .catch((e) => {
                if (e.name !== "AbortError") setErr(String(e));
            })
            .finally(() => setLoading(false));

        return () => ctrl.abort();
    }, [apiUrl]);

    useEffect(() => {
        if (keyword) localStorage.setItem("searchKeyword", keyword);
    }, [keyword]);

    const doSearch = () => {
        const kw = keyword.trim();
        if (!kw) return;
        navigate(`/result?keyword=${encodeURIComponent(kw)}`);
    };

    const handleSelectVideo = (videoId: string) => {
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        localStorage.setItem("selectedVideoUrl", videoUrl);

        // lưu đường dẫn để Home hiện mũi tên quay lại đúng keyword
        const backLink = `/result?keyword=${encodeURIComponent(keyword)}`;
        localStorage.setItem("backToResult", backLink);

        navigate("/"); // quay lại Home
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Header sticky thân thiện mobile */}
            <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b">
                <div className="mx-auto max-w-5xl px-3 pt-[env(safe-area-inset-top)]">
                    <div className="flex items-center justify-between gap-2 py-2">
                        <button
                            onClick={() => navigate(-1)}
                            className="h-10 px-3 rounded border text-sm hover:bg-gray-50 active:scale-[0.99]"
                            title="Back"
                        >
                            ⟵ Back
                        </button>
                        <Link
                            to="/"
                            className="h-10 px-3 inline-flex items-center justify-center rounded border text-sm hover:bg-gray-50"
                        >
                            Home
                        </Link>
                    </div>

                    {/* Search dàn hàng dọc trên mobile, full width */}
                    <div className="pb-2">
                        <SearchBar
                            value={keyword}
                            onChange={setKeyword}
                            onClear={() => setKeyword("")}
                            onSearch={doSearch}
                            placeholder="Search videos…"
                            className="w-full"
                        />
                    </div>
                </div>
            </header>

            {/* Nội dung */}
            <main className="mx-auto max-w-5xl px-3 py-3">
                <h2 className="text-base sm:text-xl font-semibold mb-2">
                    Kết quả tìm kiếm
                </h2>

                {/* Trạng thái */}
                {loading && (
                    <div className="flex items-center gap-2 py-4">
                        <span className="inline-block w-5 h-5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
                        <span>Đang tải…</span>
                    </div>
                )}
                {!loading && !API_KEY && (
                    <p className="text-red-600">
                        Thiếu <code>VITE_YT_API_KEY</code>. Thêm vào file <code>.env</code>{" "}
                        để gọi YouTube API.
                    </p>
                )}
                {err && <p className="text-red-600">Lỗi: {err}</p>}
                {!loading && !err && items.length === 0 && keyword && API_KEY && (
                    <p>Không có kết quả.</p>
                )}

                {/* Danh sách kết quả (responsive grid) */}
                {!loading && !err && items.length > 0 && (
                    <ResultList items={items} onSelectVideo={handleSelectVideo} />
                )}
            </main>
        </div>
    );
}
