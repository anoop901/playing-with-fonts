import type { ComponentProps } from "react";

export default function Button({
  className,
  children,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      className={
        "bg-indigo-700 text-white text-sm px-4 py-2 rounded-full cursor-pointer active:bg-indigo-900 transition font-semibold " +
        (className ?? "")
      }
      {...props}
    >
      {children}
    </button>
  );
}
