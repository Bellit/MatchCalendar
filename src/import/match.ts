import type { CalendarEvent } from '../model/types';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Empareja cada partido importado con el partido ya guardado que actualiza (o null si es nuevo).
 * Cada partido guardado se usa como mucho una vez, para que dos partidos del mismo día
 * (p. ej. un torneo) no se sobrescriban entre sí.
 *  1. Misma fecha y mismo título (sin tildes ni mayúsculas).
 *  2. Si en una fecha queda exactamente un partido guardado y uno importado sin emparejar, se
 *     consideran el mismo aunque cambie la hora o el texto (el caso típico de un cambio de horario).
 */
export function matchExisting(rows: { date: string; title: string }[], existing: CalendarEvent[]): (CalendarEvent | null)[] {
  const result: (CalendarEvent | null)[] = rows.map(() => null);
  const used = new Set<string>();

  rows.forEach((r, i) => {
    const prev = existing.find((e) => !used.has(e.id) && e.date === r.date && norm(e.title) === norm(r.title));
    if (prev) {
      used.add(prev.id);
      result[i] = prev;
    }
  });

  const dates = new Set(rows.filter((_, i) => !result[i]).map((r) => r.date));
  for (const date of dates) {
    const freeRows = rows.map((r, i) => (r.date === date && !result[i] ? i : -1)).filter((i) => i !== -1);
    const freeExisting = existing.filter((e) => e.date === date && !used.has(e.id));
    if (freeRows.length === 1 && freeExisting.length === 1) {
      used.add(freeExisting[0].id);
      result[freeRows[0]] = freeExisting[0];
    }
  }
  return result;
}
