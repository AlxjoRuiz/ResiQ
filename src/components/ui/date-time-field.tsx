"use client";

export function DateTimeField({ name, label, value, onChange }: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const display = value
    ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)} · ${value.slice(11, 16)}`
    : "Selecciona fecha y hora";

  return <label className="block min-w-0 text-sm font-medium">{label}
    <span className="relative mt-2 flex box-border h-11 min-w-0 w-full max-w-full items-center overflow-hidden rounded-lg border bg-white px-3 text-base font-normal text-foreground focus-within:ring-2 focus-within:ring-ring">
      <span aria-hidden="true" className="min-w-0 truncate">{display}</span>
      <input
        className="absolute inset-0 h-full w-full min-w-0 cursor-pointer opacity-0"
        name={name}
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => {
          try { event.currentTarget.showPicker?.(); }
          catch { /* Safari opens its native picker when the input is touched. */ }
        }}
        required
        aria-label={label}
      />
    </span>
  </label>;
}
