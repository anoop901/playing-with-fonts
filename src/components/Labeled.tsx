export default function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-heading tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
