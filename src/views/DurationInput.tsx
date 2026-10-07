import { useEffect, useState } from 'react';

/** Entrada de duración en horas y minutos. Con `optional`, vacío = undefined (usar valor heredado).
 *  Sin `optional`, una duración vacía o de 0 no se guarda: el campo se marca y, al salir, vuelve al último valor válido.
 *  `label` da contexto a los lectores de pantalla ("Bloque del equipo: horas"). */
export function DurationInput({
  minutes,
  onChange,
  optional,
  label,
}: {
  minutes?: number;
  onChange: (m: number | undefined) => void;
  optional?: boolean;
  label?: string;
}) {
  const fromProps = (): [string, string] => (minutes === undefined ? ['', ''] : [String(Math.floor(minutes / 60)), String(minutes % 60)]);
  const [[h, m], setDraft] = useState(fromProps);
  useEffect(() => setDraft(fromProps()), [minutes]);

  const total = (Number(h) || 0) * 60 + (Number(m) || 0);
  const invalid = !optional && total <= 0;

  const update = (hh: string, mm: string) => {
    setDraft([hh, mm]);
    if (optional && hh === '' && mm === '') return onChange(undefined);
    const t = (Number(hh) || 0) * 60 + (Number(mm) || 0);
    if (t > 0) onChange(t);
    else if (optional) onChange(undefined);
  };
  const prefix = label ? `${label}: ` : '';
  return (
    <span
      className="duration"
      onBlur={(e) => {
        // Pasar de horas a minutos no cuenta como salir del campo.
        if (invalid && !e.currentTarget.contains(e.relatedTarget as Node | null)) setDraft(fromProps());
      }}
    >
      <input
        type="number"
        min={0}
        max={24}
        value={h}
        placeholder="h"
        aria-label={`${prefix}horas`}
        aria-invalid={invalid || undefined}
        onChange={(e) => update(e.target.value, m)}
      />
      h
      <input
        type="number"
        min={0}
        max={59}
        step={5}
        value={m}
        placeholder="min"
        aria-label={`${prefix}minutos`}
        aria-invalid={invalid || undefined}
        onChange={(e) => update(h, e.target.value)}
      />
      min
    </span>
  );
}
