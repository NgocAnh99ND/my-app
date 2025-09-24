import { useEffect, useRef } from "react";

export type VideoPlayerProps = {
    videoId: string;
    className?: string;
    initialTime?: number;
    onTimeUpdate?: (currentTime: number) => void;
    defaultPlaybackRate?: number;
    autoSubtitleLang?: string;
    shouldPlay?: boolean;
    onReady?: (player: YT.Player) => void;
    onStateChange?: (event: YT.OnStateChangeEvent) => void;
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({
    videoId,
    className = "",
    initialTime = 0,
    onTimeUpdate,
    defaultPlaybackRate,
    autoSubtitleLang,
    shouldPlay,
    onReady,
    onStateChange,
}) => {
    const playerRef = useRef<YT.Player | null>(null);
    const intervalRef = useRef<number | null>(null);

    // Load YouTube IFrame API
    useEffect(() => {
        if (window.YT && window.YT.Player) {
            createPlayer();
        } else {
            const tag = document.createElement("script");
            tag.src = "https://www.youtube.com/iframe_api";
            document.body.appendChild(tag);
            (window as any).onYouTubeIframeAPIReady = createPlayer;
        }

        function createPlayer() {
            if (playerRef.current) {
                playerRef.current.loadVideoById(videoId, initialTime);
                return;
            }
            playerRef.current = new YT.Player("player", {
                videoId,
                playerVars: {
                    autoplay: shouldPlay ? 1 : 0,
                    controls: 1,
                    rel: 0,
                    cc_lang_pref: autoSubtitleLang || undefined,
                    cc_load_policy: autoSubtitleLang ? 1 : 0,
                },
                events: {
                    onReady: (event: YT.PlayerEvent) => {
                        if (defaultPlaybackRate) {
                            event.target.setPlaybackRate(defaultPlaybackRate);
                        }
                        if (initialTime) {
                            event.target.seekTo(initialTime, true); // ✅ nhảy tới thời điểm đã lưu
                        }
                        if (shouldPlay) {
                            event.target.playVideo();
                        }
                        if (onReady) {
                            onReady(event.target);
                        }
                    },
                    onStateChange: (event: YT.OnStateChangeEvent) => {
                        if (onStateChange) {
                            onStateChange(event);
                        }
                        if (onTimeUpdate) {
                            // clear interval cũ
                            if (intervalRef.current) {
                                clearInterval(intervalRef.current);
                                intervalRef.current = null;
                            }
                            // chỉ theo dõi khi video đang play
                            if (event.data === YT.PlayerState.PLAYING) {
                                intervalRef.current = window.setInterval(() => {
                                    if (playerRef.current) {
                                        onTimeUpdate(playerRef.current.getCurrentTime());
                                    }
                                }, 1000);
                            }
                        }
                    },
                },
            });
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            playerRef.current?.destroy();
            playerRef.current = null;
        };
    }, [videoId, initialTime]); // ✅ thêm dependency initialTime

    // đồng bộ shouldPlay từ props
    useEffect(() => {
        if (!playerRef.current) return;
        if (shouldPlay) {
            playerRef.current.playVideo();
        } else {
            playerRef.current.pauseVideo();
        }
    }, [shouldPlay]);

    return (
        <div className={`relative w-full bg-black ${className}`}>
            <div id="player" className="w-full aspect-video max-w-full" />
        </div>
    );
};

export default VideoPlayer;
