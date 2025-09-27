// src/pages/Home.tsx
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import VideoPlayer from "../components/VideoPlayer";
import PlayerControls from "../components/PlayerControls";
import SearchBar from "../components/SearchBar";
import YoutubeLinkInput from "../components/YoutubeLinkInput";
import NoteEditor from "../components/NoteEditor";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";

// Hàm tách videoId từ link YouTube
function extractVideoId(link: string) {
  const reg =
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([^\s&#?/]+)/;
  const match = link.match(reg);
  return match ? match[1] : "";
}

const LAST_TIME_KEY = "lastVideoTime";
const LAST_VIDEO_KEY = "lastVideoId";

const Home = () => {
  const navigate = useNavigate();

  // State video
  const [videoUrl, setVideoUrl] = useState(
    "https://www.youtube.com/watch?v=M7lc1UVf-VE"
  );
  const [seekSeconds, setSeekSeconds] = useState(2);
  const [customStep, setCustomStep] = useState(0.2);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [initialTime, setInitialTime] = useState(0);
  const [showSearchBox, setShowSearchBox] = useState(false);

  // Phụ đề & tốc độ
  const [activateSubtitleAndSpeed, setActivateSubtitleAndSpeed] =
    useState(false);

  // Search state
  const [searchText, setSearchText] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");

  // ✅ Thêm: theo dõi thời gian hiện tại để truyền cho NoteEditor
  const [currentTime, setCurrentTime] = useState(0);

  // Dùng để nút "→ Result" nhớ keyword gần nhất
  const [lastKeyword, setLastKeyword] = useState<string>(
    () => localStorage.getItem("searchKeyword") || ""
  );

  const videoId = extractVideoId(videoUrl) || "M7lc1UVf-VE";

  // Hook player
  const {
    handleReady,
    handleStateChange,
    seekForward,
    seekBackward,
    togglePlayPause,
    enterFullscreen,
    isPlaying,
  } = useYouTubePlayer();

  // Khi load trang, đọc videoId + thời gian cuối cùng
  useEffect(() => {
    const lastId = localStorage.getItem(LAST_VIDEO_KEY);
    const lastTimeStr = localStorage.getItem(LAST_TIME_KEY);

    if (lastId) {
      setVideoUrl(`https://www.youtube.com/watch?v=${lastId}`);
    }

    const lastTime = lastTimeStr ? parseFloat(lastTimeStr) : 0;
    setInitialTime(lastTime);
    setCurrentTime(lastTime);
  }, []);

  // ✅ Callback nhận thời gian hiện tại từ VideoPlayer (gọi mỗi giây)
  const handleTimeUpdate = (t: number) => {
    localStorage.setItem(LAST_TIME_KEY, String(t));
    setCurrentTime(t); // ← rất quan trọng cho NoteEditor
  };

  // Tăng/giảm bước tua
  const onIncreaseSeek = () =>
    setSeekSeconds((s) => parseFloat((s + customStep).toFixed(1)));
  const onDecreaseSeek = () =>
    setSeekSeconds((s) =>
      Math.max(0, parseFloat((s - customStep).toFixed(1)))
    );

  // Fullscreen
  const onEnterFullscreen = () => setIsFullscreen(true);
  const onExitFullscreen = () => setIsFullscreen(false);

  // SearchBar
  const handleClearSearch = () => setSearchText("");
  const handleSearch = () => {
    if (!searchText.trim()) return;
    const kw = searchText.trim();
    localStorage.setItem("searchKeyword", kw);
    setLastKeyword(kw); // để nút "→" cập nhật ngay
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
    localStorage.setItem(LAST_VIDEO_KEY, id); // lưu videoId mới
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-gray-100">
      {/* Vùng video + nút ở góc */}
      <div className="w-full relative">
        <VideoPlayer
          videoId={videoId}
          className={
            isFullscreen
              ? "fixed top-0 left-0 w-screen h-[95vh] z-[1000]"
              : "w-full"
          }
          initialTime={initialTime}
          onTimeUpdate={handleTimeUpdate}   // ✅ rất quan trọng
          defaultPlaybackRate={activateSubtitleAndSpeed ? 0.8 : undefined}
          autoSubtitleLang={activateSubtitleAndSpeed ? "en" : undefined}
          shouldPlay={true}
          onReady={handleReady}
          onStateChange={handleStateChange}
          onToggleSearch={() => setShowSearchBox((s) => !s)}
        />

        {/* ✅ Nút "→" góc trên phải: quay lại Result với keyword gần nhất */}
        <div className="absolute top-2 right-2 z-[1600]">
          <Link
            to={lastKeyword ? `/result?keyword=${encodeURIComponent(lastKeyword)}` : "/result"}
            className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-red-600 text-white hover:bg-red-700"
            title={lastKeyword ? `Đến kết quả: "${lastKeyword}"` : "Đến trang kết quả"}
          >
            →
          </Link>
        </div>

        {/* SearchBox nổi */}
        {showSearchBox && (
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2
                       rounded-lg shadow-lg px-3
                       flex flex-col items-center w-[90%] max-w-[600px]
                       z-[2000]"
          >
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

      {/* NoteEditor nhận currentTime để tự cuộn đến dòng giải thích phù hợp */}
      <NoteEditor currentTime={currentTime} />

      {/* PlayerControls */}
      <div className="flex w-full justify-center mt-2 mb-20">
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
  );
};

export default Home;
