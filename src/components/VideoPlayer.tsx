import type { FC } from "react";

export type VideoPlayerProps = {
    videoId: string;
    className?: string;
    initialTime?: number;
    onTimeUpdate?: (currentTime: number) => void;
    defaultPlaybackRate?: number;
    autoSubtitleLang?: string;
    shouldPlay?: boolean; // thêm để nhận trạng thái Play/Pause
};

const YT_BASE_URL = "https://www.youtube.com/embed/";

const VideoPlayer: FC<VideoPlayerProps> = ({ videoId, className = "" }) => (
    <div className={`relative w-full bg-black ${className}`}>
        <iframe
            id="player"
            src={`${YT_BASE_URL}${videoId}?enablejsapi=1&controls=1&cc_load_policy=1&rel=0`}
            frameBorder="0"
            allowFullScreen
            className="w-full aspect-video max-w-full"
            title="YouTube Player"
        />
    </div>
);

export default VideoPlayer;