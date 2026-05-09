export default function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="uppercase text-gray-600 text-sm tracking-wide font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}
