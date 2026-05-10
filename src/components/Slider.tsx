import { useRef } from "react";
import { lerp_inverse } from "../util/lerp";
import clamp from "../util/clamp";

export default function Slider({
  value,
  onValueChange,
  format,
  min = 0,
  max = 100,
  step = 1,
}: {
  value: number;
  onValueChange: (value: number) => void;
  format?: (value: number) => string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const pct = lerp_inverse(Number(min), Number(max), value) * 100;
  const dragRef = useRef<{
    accumValue: number;
    sensitivity: number;
  } | null>(null);

  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      accumValue: value,
      // dragging the full width of the slider traverses the full range
      sensitivity: (Number(max) - Number(min)) / rect.width,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function updateDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current.accumValue = clamp(
      dragRef.current.accumValue + e.movementX * dragRef.current.sensitivity,
      Number(min),
      Number(max),
    );
    const stepped =
      Math.round(dragRef.current.accumValue / Number(step)) * Number(step);
    onValueChange(clamp(stepped, Number(min), Number(max)));
  }

  function stopDrag(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return (
    <div className="flex items-center">
      <div
        className="px-2 py-1 grow rounded border-2 border-border-weak hover:border-border transition cursor-ew-resize select-none"
        style={{
          background: `linear-gradient(to right, var(--color-primary-weak) ${pct}%, var(--color-background-input) ${pct}%)`,
        }}
        onPointerDown={startDrag}
        onPointerMove={updateDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        {format != null ? format(value) : value}
      </div>
    </div>
  );
}
