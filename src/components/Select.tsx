import type { ComponentProps } from "react";

export default function Select({
  children,
  className,
  ...props
}: { label: string } & ComponentProps<"select">) {
  return (
    <select
      className={
        "appearance-none focus:outline-none rounded px-2 py-1 border-2 border-gray-200 hover:border-gray-400 focus:border-indigo-600 " +
        (className ?? "")
      }
      {...props}
    >
      {children}
    </select>
  );
}
