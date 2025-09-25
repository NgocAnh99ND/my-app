import { useState, useEffect } from "react";
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
  return match ? match[1] : "M7lc1UVf-VE";
}

const LAST_TIME_KEY = "lastVideoTime";

const Home = () => {
  // State cho video
  const [videoUrl, setVideoUrl] = useState(
    "https://www.youtube.com/watch?v=M7lc1UVf-VE"
  );
  const [seekSeconds, setSeekSeconds] = useState(2);
  const [customStep, setCustomStep] = useState(0.2);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [initialTime, setInitialTime] = useState(0);

  // State cho phụ đề & tốc độ
  const [activateSubtitleAndSpeed, setActivateSubtitleAndSpeed] =
    useState(false);

  // State cho search
  const [searchText, setSearchText] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const videoId = extractVideoId(videoUrl);

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

  // Khi load trang, đọc thời gian cuối cùng từ localStorage
  useEffect(() => {
    const lastTimeStr = localStorage.getItem(LAST_TIME_KEY);
    const lastTime = lastTimeStr ? parseFloat(lastTimeStr) : 0;
    setInitialTime(lastTime);
  }, [videoId]);

  // Callback nhận thời gian hiện tại từ VideoPlayer
  const handleTimeUpdate = (currentTime: number) => {
    localStorage.setItem(LAST_TIME_KEY, String(currentTime));
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
    alert("Search: " + searchText);
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
    setVideoUrl(youtubeLink);
  };
  const handleSelectSuggestion = (link: string) => {
    setYoutubeLink(link);
    setSuggestions([]);
  };

  const handleYoutubeLinkFocus = () => {
    const history = JSON.parse(localStorage.getItem("youtubeLinks") || "[]");
    setSuggestions(history);
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-gray-100">
      {/* VideoPlayer */}
      <div className="w-full">
        <VideoPlayer
          videoId={videoId}
          className={
            isFullscreen
              ? "fixed top-0 left-0 w-screen h-[95vh] z-[1000]"
              : "w-full"
          }
          initialTime={initialTime} // ✅ truyền lại thời điểm cũ
          onTimeUpdate={handleTimeUpdate} // ✅ liên tục lưu thời điểm mới
          defaultPlaybackRate={activateSubtitleAndSpeed ? 0.8 : undefined}
          autoSubtitleLang={activateSubtitleAndSpeed ? "en" : undefined}
          shouldPlay={true}
          onReady={handleReady}
          onStateChange={handleStateChange}
        />
      </div>

      {/* SearchBar + YoutubeLinkInput */}
      <div className="flex flex-col items-center w-full max-w-[800px] mt-4 gap-1">
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
        />
      </div>

      {/* NoteEditor */}
      <NoteEditor />

      {/* PlayerControls */}
      <div className="flex w-full justify-center mt-4 mb-4">
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
