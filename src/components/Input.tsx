import type { ComponentProps } from "react";

export default function Input({
  className,
  ...props
}: ComponentProps<"input">) {
  return (
    <input
      className={"focus:outline-none" + (className ?? "")}
      {...props}
    ></input>
  );
}
