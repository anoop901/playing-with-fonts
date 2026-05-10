export default function Select({
  className,
  options,
  value,
  onChange,
}: {
  className?: string;
  options: { name: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const currentValue = value;
  return (
    <div
      className={
        "flex w-fit flex-wrap select-none gap-1 px-2 py-1 bg-background-input border-2 border-border-weak rounded " +
        (className ?? "")
      }
    >
      {options.map(({ name, value }) => (
        <div
          className={`px-2 py-1 rounded ${currentValue === value ? "bg-primary text-primary-foreground" : "hover:bg-background-2"} cursor-pointer transition`}
          onClick={() => onChange(value)}
        >
          {name}
        </div>
      ))}
    </div>
  );
}
