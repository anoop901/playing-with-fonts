import type { ComponentProps } from "react";

export default function Select({
  children,
  className,
  ...props
}: { label: string } & ComponentProps<"select">) {
  return (
    <select
      className={
        "appearance-none focus:outline-none rounded px-2 py-1 border-2 border-border-weak bg-background-input hover:border-border focus:border-primary " +
        (className ?? "")
      }
      {...props}
    >
      {children}
    </select>
  );
}
