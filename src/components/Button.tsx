import type { ComponentProps } from "react";

export default function Button({
  className,
  children,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      className={
        "bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded cursor-pointer border-gray-400 border-2 active:translate-y-1 transition font-semibold " +
        (className ?? "")
      }
      {...props}
    >
      {children}
    </button>
  );
}
