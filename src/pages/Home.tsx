import { useState, useEffect } from "react";
import VideoPlayer from "../components/VideoPlayer";
import PlayerControls from "../components/PlayerControls";
import SearchBar from "../components/SearchBar";
import YoutubeLinkInput from "../components/YoutubeLinkInput";
import NoteEditor from "../components/NoteEditor";

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

    // State cho nút nhỏ bật phụ đề & tốc độ
    const [activateSubtitleAndSpeed, setActivateSubtitleAndSpeed] =
        useState(false);
    // State cho Play/Pause
    const [isPlaying, setIsPlaying] = useState(true);

    // State cho search
    const [searchText, setSearchText] = useState("");
    const [youtubeLink, setYoutubeLink] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);

    const videoId = extractVideoId(videoUrl);

    // Khi lần đầu load trang, đọc thời gian cuối cùng từ localStorage
    useEffect(() => {
        const lastTimeStr = localStorage.getItem(LAST_TIME_KEY);
        const lastTime = lastTimeStr ? parseFloat(lastTimeStr) : 0;
        setInitialTime(lastTime);
    }, [videoId]); // Khi đổi video cũng đọc lại

    // Callback nhận thời gian hiện tại từ VideoPlayer
    const handleTimeUpdate = (currentTime: number) => {
        localStorage.setItem(LAST_TIME_KEY, String(currentTime));
    };

    // Dummy logic các nút điều khiển
    const onSeekForward = () => alert(`Tua tới +${seekSeconds}s`);
    const onSeekBackward = () => alert(`Tua lùi -${seekSeconds}s`);
    const onIncreaseSeek = () =>
        setSeekSeconds((s) => parseFloat((s + customStep).toFixed(1)));
    const onDecreaseSeek = () =>
        setSeekSeconds((s) => Math.max(0, parseFloat((s - customStep).toFixed(1))));
    const onEnterFullscreen = () => setIsFullscreen(true);
    const onExitFullscreen = () => setIsFullscreen(false);

    // Play/Pause logic
    const handleTogglePlayPause = () => setIsPlaying((p) => !p);

    // Xử lý SearchBar
    const handleClearSearch = () => setSearchText("");
    const handleSearch = () => {
        alert("Search: " + searchText);
    };

    // Xử lý YoutubeLinkInput
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

    // Suggestion demo: lấy từ localStorage khi input focus
    const handleYoutubeLinkFocus = () => {
        const history = JSON.parse(localStorage.getItem("youtubeLinks") || "[]");
        setSuggestions(history);
    };

    return (
        <div className="flex flex-col w-full min-h-screen bg-gray-100">
            {/* VideoPlayer ở trên cùng, full width */}
            <div className="w-full">
                <VideoPlayer
                    videoId={videoId}
                    className={
                        isFullscreen
                            ? "fixed top-0 left-0 w-screen h-[95vh] z-[1000]"
                            : "w-full"
                    }
                    initialTime={initialTime} // truyền thời gian khởi tạo
                    onTimeUpdate={handleTimeUpdate} // truyền callback lưu thời gian
                    defaultPlaybackRate={activateSubtitleAndSpeed ? 0.8 : undefined}
                    autoSubtitleLang={activateSubtitleAndSpeed ? "en" : undefined}
                    shouldPlay={isPlaying}
                />
            </div>

            {/* Các thành phần dưới video: SearchBar, YoutubeLinkInput */}
            <div className="flex flex-col items-center w-full max-w-[800px] mt-4 gap-1">
                {/* SearchBar cho keyword */}
                <SearchBar
                    value={searchText}
                    onChange={setSearchText}
                    onClear={handleClearSearch}
                    onSearch={handleSearch}
                />

                {/* YoutubeLinkInput cho nhập link, suggestion */}
                <YoutubeLinkInput
                    value={youtubeLink}
                    onChange={setYoutubeLink}
                    onClear={handleClearYoutubeLink}
                    onPaste={handlePasteYoutubeLink}
                    onPlay={handlePlayYoutubeLink}
                    suggestions={suggestions}
                    onSelectSuggestion={handleSelectSuggestion}
                    placeholder="Enter link YouTube..."
                    onFocus={handleYoutubeLinkFocus}
                />
            </div>

            {/* NoteEditor chiếm toàn bộ phần còn lại phía dưới */}
            <NoteEditor />

            {/* PlayerControls nằm dưới NoteEditor, không fixed */}
            <div className="flex w-full justify-center mt-4 mb-4">
                <PlayerControls
                    seekSeconds={seekSeconds}
                    setSeekSeconds={setSeekSeconds}
                    customStep={customStep}
                    setCustomStep={setCustomStep}
                    isFullscreen={isFullscreen}
                    onSeekForward={onSeekForward}
                    onSeekBackward={onSeekBackward}
                    onIncreaseSeek={onIncreaseSeek}
                    onDecreaseSeek={onDecreaseSeek}
                    onEnterFullscreen={onEnterFullscreen}
                    onExitFullscreen={onExitFullscreen}
                    onActivateSubtitleAndSpeed={() => setActivateSubtitleAndSpeed(true)}
                    onTogglePlayPause={handleTogglePlayPause}
                    isPlaying={isPlaying}
                />
            </div>
        </div>
    );
};

export default Home;