import type { InputHTMLAttributes } from 'react';

const Input = (props: InputHTMLAttributes<HTMLInputElement>) => (
    <input
        {...props}
        className={`px-4 py-2 border border-blue-500 rounded-full text-base outline-none w-14 ${props.className ?? ''}`}
    />
);

export default Input;
