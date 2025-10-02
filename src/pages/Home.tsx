// src/pages/Home.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import VideoPlayer from "../components/VideoPlayer";
import PlayerControls from "../components/PlayerControls";
import SearchBar from "../components/SearchBar";
import YoutubeLinkInput from "../components/YoutubeLinkInput";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import NoteEditor from "../components/NoteEditor/NoteEditor";

const extractVideoId = (link: string) => {
  const reg =
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([^\s&#?/]+)/;
  const match = link.match(reg);
  return match ? match[1] : "";
};

const LAST_TIME_KEY = "lastVideoTime";
const LAST_VIDEO_KEY = "lastVideoId";

const Home: React.FC = () => {
  const navigate = useNavigate();

  // Thời gian hiện tại của video để sync NoteEditor
  const [currentTime, setCurrentTime] = useState(0);

  const [videoUrl, setVideoUrl] = useState(
    "https://www.youtube.com/watch?v=M7lc1UVf-VE"
  );
  const [seekSeconds, setSeekSeconds] = useState(2);
  const [customStep, setCustomStep] = useState(0.2);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [initialTime, setInitialTime] = useState(0);
  const [showSearchBox, setShowSearchBox] = useState(false);

  const [activateSubtitleAndSpeed, setActivateSubtitleAndSpeed] =
    useState(false);
  const [searchText, setSearchText] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");

  // Giữ từ khóa đã tìm gần nhất để nút “→” mở lại Result
  const [lastSearch, setLastSearch] = useState<string>(
    () => localStorage.getItem("searchKeyword") || ""
  );

  const videoId = extractVideoId(videoUrl) || "M7lc1UVf-VE";

  const {
    handleReady,
    handleStateChange,
    seekForward,
    seekBackward,
    togglePlayPause,
    enterFullscreen,
    isPlaying,
  } = useYouTubePlayer();

  // Ưu tiên phát video chọn từ trang Result (qua localStorage)
  useEffect(() => {
    const selected = localStorage.getItem("selectedVideoUrl");
    if (selected) {
      const id = extractVideoId(selected);
      if (id) {
        setVideoUrl(selected);
        localStorage.setItem(LAST_VIDEO_KEY, id);
        localStorage.setItem(LAST_TIME_KEY, "0");
        setInitialTime(0);
        setCurrentTime(0);
      }
      localStorage.removeItem("selectedVideoUrl");
      return;
    }

    const lastId = localStorage.getItem(LAST_VIDEO_KEY);
    const lastTimeStr = localStorage.getItem(LAST_TIME_KEY);

    if (lastId) setVideoUrl(`https://www.youtube.com/watch?v=${lastId}`);

    const lastTime = lastTimeStr ? parseFloat(lastTimeStr) : 0;
    const t = isFinite(lastTime) ? lastTime : 0;
    setInitialTime(t);
    setCurrentTime(t);
  }, []);

  // Lắng nghe thay đổi searchKeyword từ tab khác (khi tìm ở trang Result)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "searchKeyword") setLastSearch(e.newValue || "");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Cập nhật currentTime liên tục để NoteEditor theo kịp video
  const handleTimeUpdate = (t: number) => {
    setCurrentTime(t);
    localStorage.setItem(LAST_TIME_KEY, String(t));
  };

  const onIncreaseSeek = () =>
    setSeekSeconds((s) => parseFloat((s + customStep).toFixed(1)));
  const onDecreaseSeek = () =>
    setSeekSeconds((s) => Math.max(0, parseFloat((s - customStep).toFixed(1))));
  const onEnterFullscreen = () => setIsFullscreen(true);
  const onExitFullscreen = () => setIsFullscreen(false);

  // SearchBar -> Result
  const handleClearSearch = () => setSearchText("");
  const handleSearch = () => {
    if (!searchText.trim()) return;
    const kw = searchText.trim();
    localStorage.setItem("searchKeyword", kw);
    setLastSearch(kw);
    navigate(`/result?keyword=${encodeURIComponent(kw)}`);
  };

  // YoutubeLinkInput
  const handleClearYoutubeLink = () => setYoutubeLink("");
  const handlePasteYoutubeLink = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setYoutubeLink(text);
    } catch {
      alert("Không thể lấy dữ liệu clipboard");
    }
  };
  const handlePlayYoutubeLink = () => {
    const id = extractVideoId(youtubeLink);
    if (!id) return;
    setVideoUrl(youtubeLink);
    localStorage.setItem(LAST_VIDEO_KEY, id);
    localStorage.setItem(LAST_TIME_KEY, "0");
    setInitialTime(0);
    setCurrentTime(0);
  };

  // Mở lại Result với từ khóa gần nhất
  const goToLastResult = () => {
    const kw = (localStorage.getItem("searchKeyword") || lastSearch).trim();
    if (kw) navigate(`/result?keyword=${encodeURIComponent(kw)}`);
    else navigate("/result");
  };

  const showGoResult = true;

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-gray-100">
      {/* Vùng VIDEO: khống chế chiều cao để dành chỗ cho NoteEditor + Controls */}
      <div className="shrink-0">
        <div className="w-full max-h-[42vh] overflow-hidden relative">
          <VideoPlayer
            videoId={videoId}
            className={isFullscreen ? "fixed top-0 left-0 w-screen h-[95vh] z-[1000]" : "w-full"}
            initialTime={initialTime}
            onTimeUpdate={handleTimeUpdate}
            defaultPlaybackRate={activateSubtitleAndSpeed ? 0.8 : undefined}
            autoSubtitleLang={activateSubtitleAndSpeed ? "en" : undefined}
            shouldPlay={true}
            onReady={handleReady}
            onStateChange={handleStateChange}
            onToggleSearch={() => setShowSearchBox((s) => !s)}
          />

          {/* Nút mở lại trang Result (góc trên phải) */}
          {showGoResult && (
            <button
              onClick={goToLastResult}
              aria-label={lastSearch ? `Mở kết quả cho "${lastSearch}"` : "Mở trang kết quả"}
              className={`fixed top-10 right-0 z-[1600] w-11 h-11 rounded-full shadow
                ${lastSearch ? "bg-gray-500 hover:bg-red-500" : "bg-gray-300 hover:bg-gray-300 cursor-pointer"}
                text-white flex items-center justify-center active:translate-y-px`}
              title={lastSearch ? `Go to results: ${lastSearch}` : "Go to results"}
            >
              <span className="text-xl leading-none">→</span>
            </button>
          )}

          {/* Ô Search nổi + nhập link YouTube (toggle bởi nút 🔍 trong VideoPlayer) */}
          {showSearchBox && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 rounded-lg shadow-lg px-3 flex flex-col items-center w-[90%] max-w-[600px] z-[2000]">
              <SearchBar
                value={searchText}
                onChange={setSearchText}
                onClear={handleClearSearch}
                onSearch={handleSearch}
              />
              <YoutubeLinkInput
                value={youtubeLink}
                onChange={setYoutubeLink}
                onClear={handleClearYoutubeLink}
                onPaste={handlePasteYoutubeLink}
                onPlay={handlePlayYoutubeLink}
                placeholder="Enter link YouTube..."
                className="mt-2"
              />
            </div>
          )}
        </div>
      </div>

      {/* Vùng NOTEEDITOR: chiếm phần còn lại, chỉ phần con cuộn */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="mx-auto h-full max-w-[740px]">
          <NoteEditor currentTime={currentTime} />
        </div>
      </div>

      {/* Thanh điều khiển dưới: cố định chiều cao, không tràn */}
      <div className="shrink-0 mb-16">
        <div className="flex w-full justify-center py-2">
          <PlayerControls
            seekSeconds={seekSeconds}
            setSeekSeconds={setSeekSeconds}
            customStep={customStep}
            setCustomStep={setCustomStep}
            isFullscreen={isFullscreen}
            onSeekForward={() => seekForward(seekSeconds)}
            onSeekBackward={() => seekBackward(seekSeconds)}
            onIncreaseSeek={onIncreaseSeek}
            onDecreaseSeek={onDecreaseSeek}
            onEnterFullscreen={() => {
              onEnterFullscreen();
              enterFullscreen();
            }}
            onExitFullscreen={onExitFullscreen}
            onActivateSubtitleAndSpeed={() => setActivateSubtitleAndSpeed(true)}
            onTogglePlayPause={togglePlayPause}
            isPlaying={isPlaying}
          />
        </div>
      </div>
    </div>
  );
};

export default Home;
