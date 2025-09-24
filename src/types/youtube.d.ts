// src/types/youtube.d.ts

declare namespace YT {
    /** Trạng thái player */
    enum PlayerState {
        UNSTARTED = -1,
        ENDED = 0,
        PLAYING = 1,
        PAUSED = 2,
        BUFFERING = 3,
        CUED = 5,
    }

    /** Cấu hình khi khởi tạo Player */
    interface PlayerVars {
        autoplay?: 0 | 1;
        controls?: 0 | 1;
        rel?: 0 | 1;
        start?: number;
        end?: number;
        cc_lang_pref?: string;
        cc_load_policy?: 0 | 1;
        mute?: 0 | 1;
        modestbranding?: 0 | 1;
    }

    interface PlayerOptions {
        height?: string;
        width?: string;
        videoId?: string;
        playerVars?: PlayerVars;
        events?: {
            onReady?: (event: PlayerEvent) => void;
            onStateChange?: (event: OnStateChangeEvent) => void;
            onError?: (event: PlayerErrorEvent) => void;
        };
    }

    /** Player chính */
    class Player {
        constructor(elementId: string | HTMLElement, options: PlayerOptions);

        // Playback controls
        playVideo(): void;
        pauseVideo(): void;
        stopVideo(): void;
        seekTo(seconds: number, allowSeekAhead: boolean): void;
        mute(): void;
        unMute(): void;
        isMuted(): boolean;
        setVolume(volume: number): void;
        getVolume(): number;
        setPlaybackRate(rate: number): void;
        getPlaybackRate(): number;

        // Info
        getPlayerState(): PlayerState;
        getCurrentTime(): number;
        getDuration(): number;
        getVideoUrl(): string;
        getVideoEmbedCode(): string;

        // Load video
        loadVideoById(videoId: string, startSeconds?: number, suggestedQuality?: string): void;
        cueVideoById(videoId: string, startSeconds?: number, suggestedQuality?: string): void;

        // Destroy
        destroy(): void;
    }

    /** Event khi Player sẵn sàng */
    interface PlayerEvent {
        target: Player;
    }

    /** Event khi thay đổi trạng thái */
    interface OnStateChangeEvent extends PlayerEvent {
        data: PlayerState;
    }

    /** Event khi lỗi */
    interface PlayerErrorEvent extends PlayerEvent {
        data: number;
    }
}
