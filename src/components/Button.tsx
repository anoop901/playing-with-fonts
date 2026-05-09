import type { ComponentProps } from "react";

export default function Button({
  className,
  children,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      className={
        "cursor-pointer rounded px-2 py-1 bg-indigo-600 text-white hover:bg-indigo-400 active:bg-indigo-800 " +
        (className ?? "")
      }
      {...props}
    >
      {children}
    </button>
  );
}
