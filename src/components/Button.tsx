import type { ComponentProps } from "react";

export default function Button({
  className,
  children,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      className={
        "cursor-pointer rounded px-2 py-1 bg-primary text-primary-foreground font-semibold " +
        (className ?? "")
      }
      {...props}
    >
      {children}
    </button>
  );
}
