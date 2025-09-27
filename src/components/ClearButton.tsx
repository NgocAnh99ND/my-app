import IconButton from "./IconButton";

type ClearButtonProps = {
    onClick?: () => void;
    className?: string;
    ariaLabel?: string;
};

const ClearButton = ({ onClick, className = "", ariaLabel = "Clear" }: ClearButtonProps) => (
    <IconButton
        icon={<img src="/icons/deleteButton.svg" alt="Xóa" width={20} height={20} />}
        onClick={onClick}
        className={className}
        ariaLabel={ariaLabel}
    />
);

export default ClearButton;
