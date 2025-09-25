// src/types/youtube-augment.d.ts

declare global {
    interface Window {
        YT: typeof YT;
        onYouTubeIframeAPIReady?: () => void;
    }

    namespace YT {
        // Bổ sung các playerVars thực tế YouTube hỗ trợ nhưng thiếu trong @types/youtube
        interface PlayerVars {
            playsinline?: 0 | 1;
            rel?: 0 | 1;
            modestbranding?: 0 | 1;
            cc_lang_pref?: string;
            cc_load_policy?: 0 | 1;
        }

        // Bổ sung các overload & API thiếu typings
        interface Player {
            getIframe(): HTMLIFrameElement;

            // Giữ overload string sẵn có:
            loadVideoById(videoId: string, startSeconds?: number, suggestedQuality?: string): void;
            cueVideoById(videoId: string, startSeconds?: number, suggestedQuality?: string): void;

            // Thêm overload dạng object (YouTube API có hỗ trợ)
            loadVideoById(args: {
                videoId: string;
                startSeconds?: number;
                endSeconds?: number;
                suggestedQuality?: string;
            }): void;

            cueVideoById(args: {
                videoId: string;
                startSeconds?: number;
                endSeconds?: number;
                suggestedQuality?: string;
            }): void;
        }
    }
}

export { };
