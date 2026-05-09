import type { ComponentProps } from "react";

export default function Input({
  className,
  ...props
}: ComponentProps<"input">) {
  return (
    <input
      className={
        "focus:outline-none border-2 rounded px-2 py-1 border-border-weak bg-background-input hover:border-border focus:border-primary transition " +
        (className ?? "")
      }
      {...props}
    ></input>
  );
}
