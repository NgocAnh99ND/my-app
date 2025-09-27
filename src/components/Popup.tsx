import type { ReactNode } from "react";

type PopupProps = {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    title?: string;
};

const Popup = ({ open, onClose, children, title }: PopupProps) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-lg">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{title}</h3>
                    <button
                        className="px-2 py-1 rounded hover:bg-gray-100"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
                <div>{children}</div>
            </div>
        </div>
    );
};

export default Popup;
