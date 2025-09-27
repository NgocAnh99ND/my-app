// src/types/yt.d.ts
export { };

declare global {
    interface Window {
        YT: typeof YT;
        onYouTubeIframeAPIReady?: () => void;
    }

    namespace YT {
        /** Player states */
        enum PlayerState {
            UNSTARTED = -1,
            ENDED = 0,
            PLAYING = 1,
            PAUSED = 2,
            BUFFERING = 3,
            CUED = 5,
        }

        /** PlayerVars (đã bao gồm các option hay dùng) */
        interface PlayerVars {
            autoplay?: 0 | 1;
            controls?: 0 | 1;
            rel?: 0 | 1;
            start?: number;
            end?: number;
            mute?: 0 | 1;
            modestbranding?: 0 | 1;
            // bổ sung
            playsinline?: 0 | 1;
            cc_lang_pref?: string;
            cc_load_policy?: 0 | 1;
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

        interface PlayerEvent {
            target: Player;
        }

        interface OnStateChangeEvent extends PlayerEvent {
            data: PlayerState;
        }

        interface PlayerErrorEvent extends PlayerEvent {
            data: number;
        }

        /** Player chính */
        class Player {
            constructor(elementId: string | HTMLElement, options: PlayerOptions);

            // playback
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

            // info
            getPlayerState(): PlayerState;
            getCurrentTime(): number;
            getDuration(): number;
            getVideoUrl(): string;
            getVideoEmbedCode(): string;

            // load video (cả 2 overload)
            loadVideoById(videoId: string, startSeconds?: number, suggestedQuality?: string): void;
            loadVideoById(args: {
                videoId: string;
                startSeconds?: number;
                endSeconds?: number;
                suggestedQuality?: string;
            }): void;

            cueVideoById(videoId: string, startSeconds?: number, suggestedQuality?: string): void;
            cueVideoById(args: {
                videoId: string;
                startSeconds?: number;
                endSeconds?: number;
                suggestedQuality?: string;
            }): void;

            // tiện ích thường thiếu trong @types
            getIframe?(): HTMLIFrameElement;
            setOption?(module: string, option: string, value: any): void;

            destroy(): void;
        }
    }
}
