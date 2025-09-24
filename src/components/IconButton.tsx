import type { ReactNode } from "react";

type IconButtonProps = {
    icon: ReactNode;
    onClick?: () => void;
    className?: string;
    ariaLabel?: string;
};

const IconButton = ({
    icon,
    onClick,
    className = "",
    ariaLabel,
}: IconButtonProps) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex items-center justify-center rounded transition-colors p-2 ${className}`}
        aria-label={ariaLabel}
    >
        {icon}
    </button>
);

export default IconButton;
