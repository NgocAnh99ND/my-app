type ResultItemProps = {
    videoId: string;
    title: string;
    thumbnail: string;
    onClick: (videoId: string) => void;
};

const ResultItem = ({ videoId, title, thumbnail, onClick }: ResultItemProps) => (
    <button
        onClick={() => onClick(videoId)}
        className="w-full text-left bg-white rounded-lg shadow hover:shadow-md active:scale-[0.99] transition p-2"
    >
        {/* Ảnh 16:9 full width (không tràn màn mobile) */}
        <div className="w-full overflow-hidden rounded-md">
            <img
                src={thumbnail}
                alt={title}
                className="w-full h-auto aspect-video object-cover"
                loading="lazy"
            />
        </div>

        {/* Tiêu đề co giãn, cỡ chữ nhỏ hơn trên mobile */}
        <p className="mt-2 text-sm sm:text-base text-black line-clamp-2 break-words">
            {title}
        </p>
    </button>
);

export default ResultItem;
