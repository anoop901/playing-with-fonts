import type { ComponentProps } from "react";
import { lerp_inverse } from "../util/lerp";

export default function Slider({
  value,
  onValueChange,
  format,
  min = 0,
  max = 100,
  ...props
}: {
  value: number;
  onValueChange: (value: number) => void;
  format?: (value: number) => string;
} & ComponentProps<"input">) {
  const pct = lerp_inverse(Number(min), Number(max), value) * 100;
  return (
    <div className="flex items-center">
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onValueChange(Number(e.currentTarget.value))}
        className="grow appearance-none h-1 rounded-full"
        style={{
          background: `linear-gradient(to right, var(--color-primary) ${pct}%, var(--color-primary-weak) ${pct}%)`,
        }}
        {...props}
      />
      <div className="w-12 text-right">
        {format != null ? format(value) : value}
      </div>
    </div>
  );
}
