import type { FC } from "react";
import IconButton from "./IconButton";
import Input from "./Input";

type PlayerControlsProps = {
    seekSeconds: number;
    setSeekSeconds: (v: number) => void;
    customStep: number;
    setCustomStep: (v: number) => void;
    isFullscreen: boolean;
    onSeekForward: () => void;
    onSeekBackward: () => void;
    onIncreaseSeek: () => void;
    onDecreaseSeek: () => void;
    onEnterFullscreen: () => void;
    onExitFullscreen: () => void;
    onActivateSubtitleAndSpeed: () => void;
    onTogglePlayPause: () => void; // mới thêm
    isPlaying: boolean; // mới thêm
};

const buttonClass =
    "flex items-center justify-center rounded-lg transition-colors h-10 w-10 p-0 bg-gray-100 hover:bg-blue-100";
const inputClass =
    "h-10 rounded-lg text-center border border-blue-500 text-base outline-none w-12";

const PlayerControls: FC<PlayerControlsProps> = ({
    seekSeconds,
    setSeekSeconds,
    customStep,
    setCustomStep,
    isFullscreen,
    onSeekForward,
    onSeekBackward,
    onIncreaseSeek,
    onDecreaseSeek,
    onActivateSubtitleAndSpeed,
    onTogglePlayPause,
    isPlaying,
}) => (
    <div
        className={`w-full flex flex-row items-center justify-evenly bg-white/90 p-2 rounded-lg shadow-lg ${isFullscreen ? "mt-[70px]" : ""
            }`}
    >
        {/* Button nhỏ: Bật phụ đề tiếng Anh & tốc độ 0.8 */}
        <IconButton
            icon={
                <span className="text-xs font-bold leading-3">
                    EN
                    <br />
                    0.75x
                </span>
            }
            onClick={onActivateSubtitleAndSpeed}
            ariaLabel="Bật phụ đề tiếng Anh và tốc độ 0.75"
            className="flex items-center justify-center rounded-lg transition-colors h-8 w-8 p-0 bg-blue-100 hover:bg-blue-200 mr-2"
        />

        <IconButton
            icon={
                <img src="/icons/chevrons-up.svg" alt="Up" width={24} height={24} />
            }
            onClick={onIncreaseSeek}
            ariaLabel="Tăng bước tua"
            className={buttonClass}
        />
        {/* Button: Giảm bước tua */}
        <IconButton
            icon={
                <img src="/icons/chevrons-down.svg" alt="Down" width={24} height={24} />
            }
            onClick={onDecreaseSeek}
            ariaLabel="Giảm bước tua"
            className={buttonClass}
        />
        {/* Input: bước tua tùy chỉnh */}
        <Input
            type="number"
            min={0.2}
            step={0.2}
            value={customStep}
            onChange={(e) => setCustomStep(Number(e.target.value))}
            className={inputClass}
        />
        {/* Input: thời gian tua */}
        <Input
            type="number"
            min={0.2}
            step={0.2}
            value={seekSeconds}
            onChange={(e) => setSeekSeconds(Number(e.target.value))}
            className={inputClass}
        />
        {/* Button: Tua lùi */}
        <IconButton
            icon={<img src="/icons/rewind.svg" alt="Rewind" width={24} height={24} />}
            onClick={onSeekBackward}
            className={buttonClass}
            ariaLabel="Tua lùi"
        />
        {/* Button: Tua tới */}
        <IconButton
            icon={
                <img
                    src="/icons/fast-forward.svg"
                    alt="Fast forward"
                    width={24}
                    height={24}
                />
            }
            onClick={onSeekForward}
            className={buttonClass}
            ariaLabel="Tua tới"
        />
        {/* Button cuối cùng: Play/Pause */}
        <IconButton
            icon={
                isPlaying ? (
                    <img src="/icons/pause.svg" alt="Pause" width={24} height={24} />
                ) : (
                    <img src="/icons/play.svg" alt="Play" width={24} height={24} />
                )
            }
            onClick={onTogglePlayPause}
            ariaLabel={isPlaying ? "Tạm dừng video" : "Phát video"}
            className={buttonClass + " ml-2"}
        />
    </div>
);

export default PlayerControls;