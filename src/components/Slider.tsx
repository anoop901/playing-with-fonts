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
        className="grow h-1.5 appearance-none bg-indigo-300 rounded-full"
        {...props}
      />
      <div className="w-12 text-sm text-right text-indigo-700 font-mono font-semibold">
        {format != null ? format(value) : value}
      </div>
    </div>
  );
}
