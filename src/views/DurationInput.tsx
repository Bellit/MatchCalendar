/** Entrada de duración en horas y minutos. Con `optional`, vacío = undefined (usar valor heredado). */
export function DurationInput({
  minutes,
  onChange,
  optional,
}: {
  minutes?: number;
  onChange: (m: number | undefined) => void;
  optional?: boolean;
}) {
  const h = minutes === undefined ? '' : Math.floor(minutes / 60);
  const m = minutes === undefined ? '' : minutes % 60;
  const update = (hh: string, mm: string) => {
    if (optional && hh === '' && mm === '') return onChange(undefined);
    const total = (Number(hh) || 0) * 60 + (Number(mm) || 0);
    onChange(total > 0 ? total : optional ? undefined : 15);
  };
  return (
    <span className="duration">
      <input type="number" min={0} max={24} value={h} placeholder="h" onChange={(e) => update(e.target.value, String(m))} />
      h
      <input
        type="number"
        min={0}
        max={59}
        step={5}
        value={m}
        placeholder="min"
        onChange={(e) => update(String(h), e.target.value)}
      />
      min
    </span>
  );
}
