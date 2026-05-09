import type { ComponentProps } from "react";

export default function Button({
  className,
  children,
  ...props
}: ComponentProps<"button">) {
  return (
    <button className={"cursor-pointer " + (className ?? "")} {...props}>
      {children}
    </button>
  );
}
