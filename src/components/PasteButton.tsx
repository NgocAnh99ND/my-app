import IconButton from "./IconButton";

type PasteButtonProps = {
    onClick?: () => void;
    className?: string;
};

const PasteButton = ({ onClick, className = "" }: PasteButtonProps) => (
    <IconButton
        icon={<img src="/icons/clipboard-paste.svg" alt="Paste" width={24} height={24} />}
        onClick={onClick}
        className={`bg-gray-200 hover:bg-gray-300 rounded h-[37px] w-[37px] ${className}`}
        ariaLabel="Paste clipboard"
    />
);

export default PasteButton;
