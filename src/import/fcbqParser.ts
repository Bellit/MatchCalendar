/**
 * Parser para texto copiado del calendario de un equipo en basquetcatala.cat.
 *
 * Formato FCBQ (cada partido):
 *   27/09/2026
 *   19:20
 *   LOCAL <tab> VISITANT <tab> CATEGORIA <tab> CAMP DE JOC
 *   ADREÇA <tab> Informació [Canvis]
 *
 * Si las líneas no siguen ese formato se usa un modo genérico tolerante: cada fecha empieza
 * un partido y el resto de textos se reparten entre título y lugar.
 */
import { isValidDate } from '../model/validate';

export interface ParsedMatch {
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  title: string;
  venue?: string;
  notes?: string;
}

const DATE_RE = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/;
const TIME_RE = /\b([01]?\d|2[0-3])[:.h]([0-5]\d)\b/;
const VENUE_RE = /(pavell[oó]|pabell[oó]n|poliesportiu|polideportivo|pista|camp\b|campo|complex|instal·laci|instalaci|\binstal\.|\bpav\.|\bpol\.|\bcem\b|escola|col·legi)/i;
const NOISE_RE = /^((jornada|j\.?)\s*\d*|data|fecha|hora|local|visitant|visitante|resultat|resultado|camp|pista|acta|veure|ver|informació|informacio|información|canvis|cambios|\[\+\]|-|vs\.?|\d{1,3}\s*-\s*\d{1,3})$/i;
const WEEKDAY_RE = /^(dl|dt|dc|dj|dv|ds|dg|dilluns|dimarts|dimecres|dijous|divendres|dissabte|diumenge|lunes|martes|miércoles|jueves|viernes|sábado|domingo)\.?,?\s*/i;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parseDate(line: string): { date: string; raw: string } | null {
  const m = line.match(DATE_RE);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const year = m[3].length <= 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const date = `${year}-${pad(month)}-${pad(day)}`;
  // Descarta fechas imposibles (31/02): se guardarían mal y la validación las eliminaría al recargar.
  if (!isValidDate(date)) return null;
  return { date, raw: m[0] };
}

/** Divide una línea en celdas (tabuladores o 2+ espacios) y quita las celdas de ruido. */
function cells(line: string): string[] {
  return line
    .split(/\t|\s{2,}/)
    .map((c) => c.replace(/\s+/g, ' ').trim())
    .filter((c) => c && !NOISE_RE.test(c));
}

export function parseFcbqText(text: string): ParsedMatch[] {
  // 1) Agrupar las líneas en registros: cada línea con fecha empieza uno nuevo.
  const records: { date: string; lines: string[] }[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const d = parseDate(rawLine);
    if (d) {
      records.push({ date: d.date, lines: [rawLine.replace(d.raw, ' ')] });
    } else if (records.length) {
      records[records.length - 1].lines.push(rawLine);
    }
  }

  // 2) Interpretar cada registro.
  return records.map(({ date, lines }) => {
    let time: string | undefined;
    const rows: string[][] = [];
    for (let line of lines) {
      if (!time) {
        const tm = line.match(TIME_RE);
        if (tm) {
          time = `${pad(Number(tm[1]))}:${tm[2]}`;
          line = line.replace(tm[0], ' ');
        }
      }
      const cs = cells(line.replace(WEEKDAY_RE, ''));
      if (cs.length) rows.push(cs);
    }
    return { date, time, ...(interpretFcbq(rows) ?? interpretGeneric(rows)) };
  });
}

/** Formato FCBQ: una fila con local, visitante, categoría y pista, seguida de la dirección. */
function interpretFcbq(rows: string[][]): Omit<ParsedMatch, 'date' | 'time'> | null {
  const i = rows.findIndex((r) => r.length >= 4);
  if (i === -1) return null;
  const [local, visitor, category, field] = rows[i];
  const address = rows[i + 1]?.[0];
  return {
    title: `${local} - ${visitor}`,
    venue: address ? `${field} (${address})` : field,
    notes: category,
  };
}

function interpretGeneric(rows: string[][]): Omit<ParsedMatch, 'date' | 'time'> {
  const parts: string[] = [];
  let venue: string | undefined;
  for (const c of rows.flat()) {
    if (!venue && VENUE_RE.test(c)) venue = c;
    else parts.push(c);
  }
  return { title: parts.join(' - ') || 'Partido', venue };
}
