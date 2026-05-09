export default function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
