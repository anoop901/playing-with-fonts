import type { ComponentProps } from "react";

export default function Input({
  className,
  ...props
}: ComponentProps<"input">) {
  return (
    <input
      className={
        "focus:outline-none border-2 rounded px-2 py-1 border-gray-200 hover:border-gray-400 focus:border-indigo-600 " +
        (className ?? "")
      }
      {...props}
    ></input>
  );
}
