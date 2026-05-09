import type { ComponentProps } from "react";

export default function Select({
  children,
  className,
  ...props
}: { label: string } & ComponentProps<"select">) {
  return (
    <select
      className={
        "appearance-none bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-transparent focus:ring-2 ring-indigo-400 transition " +
        (className ?? "")
      }
      {...props}
    >
      {children}
    </select>
  );
}
