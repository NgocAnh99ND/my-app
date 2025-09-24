import type { ReactNode } from 'react';

type ButtonProps = {
    children: ReactNode;
    onClick?: () => void;
    className?: string;
    type?: "button" | "submit" | "reset";
};

const Button = ({
    children,
    onClick,
    className = "",
    type = "button",
}: ButtonProps) => (
    <button
        type={type}
        onClick={onClick}
        className={`px-4 py-2 text-white bg-red-700 rounded hover:bg-red-800 transition-colors cursor-pointer ${className}`}
    >
        {children}
    </button>
);

export default Button;