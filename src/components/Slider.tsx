import type { ComponentProps } from "react";

export default function Slider({
  value,
  onValueChange,
  format,
  ...props
}: {
  value: number;
  onValueChange: (value: number) => void;
  format?: (value: number) => string;
} & ComponentProps<"input">) {
  return (
    <div className="flex items-center">
      <input
        type="range"
        value={value}
        onChange={(e) => onValueChange(Number(e.currentTarget.value))}
        className="grow appearance-none"
        {...props}
      />
      <div className="w-12 text-right">
        {format != null ? format(value) : value}
      </div>
    </div>
  );
}
