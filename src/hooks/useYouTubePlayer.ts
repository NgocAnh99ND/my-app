import { useState, useCallback } from "react";

export function useYouTubePlayer() {
  const [player, setPlayer] = useState<YT.Player | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleReady = useCallback((p: YT.Player) => {
    setPlayer(p);
  }, []);

  const play = useCallback(() => {
    player?.playVideo();
  }, [player]);

  const pause = useCallback(() => {
    player?.pauseVideo();
  }, [player]);

  const togglePlayPause = useCallback(() => {
    if (!player) return;
    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }, [player]);

  const seekForward = useCallback(
    (seconds: number) => {
      if (!player) return;
      const current = player.getCurrentTime();
      player.seekTo(current + seconds, true);
    },
    [player]
  );

  const seekBackward = useCallback(
    (seconds: number) => {
      if (!player) return;
      const current = player.getCurrentTime();
      player.seekTo(Math.max(0, current - seconds), true);
    },
    [player]
  );

  const enterFullscreen = useCallback(() => {
    const iframe = document.getElementById("player") as HTMLIFrameElement;
    if (iframe?.requestFullscreen) iframe.requestFullscreen();
  }, []);

  /** Lắng nghe thay đổi trạng thái của player */
  const handleStateChange = useCallback((event: YT.OnStateChangeEvent) => {
    if (event.data === YT.PlayerState.PLAYING) {
      setIsPlaying(true);
    } else if (
      event.data === YT.PlayerState.PAUSED ||
      event.data === YT.PlayerState.ENDED
    ) {
      setIsPlaying(false);
    }
  }, []);

  return {
    player,
    handleReady,
    handleStateChange,
    play,
    pause,
    togglePlayPause,
    seekForward,
    seekBackward,
    enterFullscreen,
    isPlaying,
  };
}
