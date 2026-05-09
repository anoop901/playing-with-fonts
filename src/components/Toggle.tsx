export default function Toggle({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.currentTarget.checked)}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-indigo-200 rounded peer-checked:bg-indigo-600 transition-colors" />
        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded shadow transition-transform peer-checked:translate-x-4" />
      </div>
      <span className="select-none">{label}</span>
    </label>
  );
}
