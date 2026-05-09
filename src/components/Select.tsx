import type { ComponentProps } from "react";

export default function Select({
  children,
  className,
  ...props
}: { label: string } & ComponentProps<"select">) {
  return (
    <select
      className={"appearance-none focus:outline-none" + (className ?? "")}
      {...props}
    >
      {children}
    </select>
  );
}
