// src/components/VideoPlayer.tsx
import React, { useEffect, useMemo, useRef } from "react";

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
  onToggleSearch?: () => void; // ✅ callback toggle SearchBox
};

const YT_SCRIPT_SRC = "https://www.youtube.com/iframe_api";

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
  onToggleSearch,
}) => {
  const playerRef = useRef<YT.Player | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const timeIntervalRef = useRef<number | null>(null);
  const initialTimeRef = useRef(initialTime);

  // luôn update ref
  useEffect(() => {
    initialTimeRef.current = initialTime || 0;
  }, [initialTime]);

  const mountId = useMemo(
    () => `playerMount_${Math.random().toString(36).slice(2)}`,
    []
  );

  useEffect(() => {
    let destroyed = false;

    ensureYouTubeAPILoaded().then(() => {
      if (destroyed) return;

      const mountEl =
        mountRef.current ||
        (document.getElementById(mountId) as HTMLDivElement | null);
      if (!mountEl) return;

      if (playerRef.current) {
        playerRef.current.loadVideoById({
          videoId,
          startSeconds: initialTimeRef.current,
        });
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
            // ép iframe fill wrapper, không viền đen
            try {
              const iframe = event.target.getIframe?.();
              if (iframe) {
                iframe.style.width = "100%";
                iframe.style.height = "100%";
                iframe.style.position = "absolute";
                iframe.style.inset = "0";
              }
            } catch {}

            if (defaultPlaybackRate) {
              event.target.setPlaybackRate(defaultPlaybackRate);
            }

            // Resume lại thời gian đã lưu
            if (initialTimeRef.current > 0) {
              event.target.seekTo(initialTimeRef.current, true);
            }

            if (shouldPlay) {
              event.target.playVideo();
            }

            onReady?.(event.target);
          },
          onStateChange: (event: YT.OnStateChangeEvent) => {
            onStateChange?.(event);

            if (!onTimeUpdate) return;
            if (timeIntervalRef.current) {
              clearInterval(timeIntervalRef.current);
              timeIntervalRef.current = null;
            }
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
  }, [mountId, videoId]);

  // Đồng bộ play/pause
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    if (shouldPlay) p.playVideo();
    else p.pauseVideo();
  }, [shouldPlay]);

  // Đồng bộ tốc độ
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !defaultPlaybackRate) return;
    p.setPlaybackRate(defaultPlaybackRate);
  }, [defaultPlaybackRate]);

  // Đồng bộ phụ đề
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !autoSubtitleLang) return;
    // @ts-ignore
    p.setOption("captions", "track", { languageCode: autoSubtitleLang });
  }, [autoSubtitleLang]);

  return (
    <div className={`relative w-full bg-black ${className}`}>
      {/* giữ tỷ lệ 16:9 */}
      <div className="relative w-full aspect-video">
        <div id={mountId} ref={mountRef} className="absolute inset-0" />
      </div>

      {/* ✅ Nút Tìm cố định bên trái, giữa màn hình */}
      <button
        onClick={onToggleSearch}
        className="fixed left-0 top-12 -translate-y-1/2 
                   w-[30px] h-[30px] 
                   bg-red-600 text-white 
                   rounded z-[1600] 
                   hover:bg-red-700"
      >
        🔍
      </button>
    </div>
  );
};

export default VideoPlayer;
