// src/components/VideoPlayer.tsx
import React, { useEffect, useMemo, useRef } from "react";

export type VideoPlayerProps = {
    videoId: string;
    className?: string;
    /** Giây bắt đầu khi tải video */
    initialTime?: number;
    /** Callback mỗi giây khi đang PLAY */
    onTimeUpdate?: (currentTime: number) => void;
    /** Tốc độ phát mặc định, vd: 1, 1.25, 1.5, 2 */
    defaultPlaybackRate?: number;
    /** Mã ngôn ngữ phụ đề tự bật, vd: "en", "vi" */
    autoSubtitleLang?: string;
    /** Điều khiển play/pause từ ngoài */
    shouldPlay?: boolean;
    /** Nhận YT.Player khi sẵn sàng */
    onReady?: (player: YT.Player) => void;
    /** Nhận sự kiện thay đổi trạng thái */
    onStateChange?: (event: YT.OnStateChangeEvent) => void;
};

const YT_SCRIPT_SRC = "https://www.youtube.com/iframe_api";

/** Tải YouTube IFrame API một lần */
function ensureYouTubeAPILoaded(): Promise<void> {
    return new Promise((resolve) => {
        if (window.YT && window.YT.Player) {
            resolve();
            return;
        }
        const exists = document.querySelector(`script[src="${YT_SCRIPT_SRC}"]`);
        if (exists) {
            const check = () => {
                if (window.YT && window.YT.Player) resolve();
                else setTimeout(check, 50);
            };
            check();
            return;
        }
        const tag = document.createElement("script");
        tag.src = YT_SCRIPT_SRC;
        document.body.appendChild(tag);
        window.onYouTubeIframeAPIReady = () => resolve();
    });
}

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
    const mountRef = useRef<HTMLDivElement | null>(null);
    const timeIntervalRef = useRef<number | null>(null);

    // ID duy nhất cho mount (an toàn khi có nhiều player)
    const mountId = useMemo(
        () => `playerMount_${Math.random().toString(36).slice(2)}`,
        []
    );

    // Khởi tạo player khi API sẵn sàng
    useEffect(() => {
        let destroyed = false;

        ensureYouTubeAPILoaded().then(() => {
            if (destroyed) return;

            const mountEl =
                mountRef.current || (document.getElementById(mountId) as HTMLDivElement | null);
            if (!mountEl) return;

            // Nếu player đã có, chỉ nạp id mới
            if (playerRef.current) {
                if (shouldPlay) {
                    playerRef.current.loadVideoById(videoId, initialTime || 0);
                } else {
                    playerRef.current.cueVideoById(videoId, initialTime || 0);
                }

                return;
            }

            playerRef.current = new window.YT.Player(mountEl as any, {
                videoId,
                playerVars: {
                    autoplay: shouldPlay ? 1 : 0,
                    controls: 1,
                    rel: 0,
                    modestbranding: 1,
                    playsinline: 1,
                    cc_lang_pref: autoSubtitleLang || undefined,
                    cc_load_policy: autoSubtitleLang ? 1 : 0,
                },
                events: {
                    onReady: (event: YT.PlayerEvent) => {
                        // Đảm bảo iframe fill wrapper (phòng YouTube set width/height cứng)
                        try {
                            const iframe = event.target.getIframe?.();
                            if (iframe) {
                                iframe.style.width = "100%";
                                iframe.style.height = "100%";
                                iframe.style.position = "absolute";
                                iframe.style.inset = "0";
                            }
                        } catch {
                            // fallback: query iframe con nếu cần
                            const iframe =
                                mountEl.querySelector("iframe") as HTMLIFrameElement | null;
                            if (iframe) {
                                iframe.style.width = "100%";
                                iframe.style.height = "100%";
                                iframe.style.position = "absolute";
                                iframe.style.inset = "0";
                            }
                        }

                        if (defaultPlaybackRate) {
                            try {
                                event.target.setPlaybackRate(defaultPlaybackRate);
                            } catch { }
                        }

                        if (initialTime) {
                            try {
                                event.target.seekTo(initialTime, true);
                            } catch { }
                        }

                        if (shouldPlay) {
                            try {
                                event.target.playVideo();
                            } catch { }
                        }

                        onReady?.(event.target);
                    },
                    onStateChange: (event: YT.OnStateChangeEvent) => {
                        onStateChange?.(event);

                        if (!onTimeUpdate) return;

                        // Clear interval cũ
                        if (timeIntervalRef.current) {
                            clearInterval(timeIntervalRef.current);
                            timeIntervalRef.current = null;
                        }

                        // Tick mỗi giây khi đang phát
                        if (event.data === window.YT.PlayerState.PLAYING) {
                            timeIntervalRef.current = window.setInterval(() => {
                                const t = playerRef.current?.getCurrentTime();
                                if (typeof t === "number") onTimeUpdate(t);
                            }, 1000);
                        }
                    },
                },
            });
        });

        return () => {
            destroyed = true;
            if (timeIntervalRef.current) {
                clearInterval(timeIntervalRef.current);
                timeIntervalRef.current = null;
            }
            playerRef.current?.destroy();
            playerRef.current = null;
        };
        // mountId chỉ tạo 1 lần
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mountId]);

    // Đồng bộ khi videoId/initialTime đổi (không recreate player)
    useEffect(() => {
        const p = playerRef.current;
        if (!p) return;
        if (shouldPlay) {
            p.loadVideoById({ videoId, startSeconds: initialTime || 0 });
        } else {
            p.cueVideoById({ videoId, startSeconds: initialTime || 0 });
        }
    }, [videoId, initialTime, shouldPlay]);

    // Đồng bộ shouldPlay (play/pause)
    useEffect(() => {
        const p = playerRef.current;
        if (!p) return;
        try {
            if (shouldPlay) p.playVideo();
            else p.pauseVideo();
        } catch { }
    }, [shouldPlay]);

    // Đồng bộ playback rate
    useEffect(() => {
        const p = playerRef.current;
        if (!p || !defaultPlaybackRate) return;
        try {
            p.setPlaybackRate(defaultPlaybackRate);
        } catch { }
    }, [defaultPlaybackRate]);

    // (Tuỳ chọn) set phụ đề động — có thể không luôn hiệu lực
    useEffect(() => {
        const p = playerRef.current;
        if (!p || !autoSubtitleLang) return;
        try {
            // @ts-ignore — setOption không đủ typings
            p.setOption("captions", "track", { languageCode: autoSubtitleLang });
        } catch { }
    }, [autoSubtitleLang]);

    return (
        <div className={`relative w-full bg-black ${className}`}>
            {/* Wrapper giữ TỈ LỆ 16:9 */}
            <div className="relative w-full aspect-video">
                {/* Mount player vào div con này, chiếm trọn wrapper */}
                <div id={mountId} ref={mountRef} className="absolute inset-0" />
            </div>
        </div>
    );
};

export default VideoPlayer;
