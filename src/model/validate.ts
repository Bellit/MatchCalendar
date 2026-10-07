import type { ActivityType, AppData, CalendarEvent, Group, Team } from './types';

/**
 * Validación estricta de datos que vienen de fuera (copias importadas o localStorage).
 * Un archivo compartido puede estar corrupto o manipulado. Nada inválido llega a la interfaz, donde podría
 * romper el renderizado o inyectar valores en estilos:
 *  - Se descarta el elemento si falla lo imprescindible (id, fecha, referencias).
 *  - Se corrige el campo si falla algo secundario (texto, color, duración, hora), para no perder datos.
 */

const MAX_ID = 64;
const MAX_NAME = 120;
const MAX_TEXT = 300;
const MAX_BLOCK = 48 * 60;
const DEFAULT_BLOCK = 180;
const MAX_ITEMS = 20000;

const COLOR_RE = /^#[0-9a-f]{6}$/i;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const FALLBACK_COLOR = '#7a8699';

type Obj = Record<string, unknown>;

const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);

function id(x: unknown): string | null {
  return typeof x === 'string' && x.length > 0 && x.length <= MAX_ID ? x : null;
}

function text(x: unknown, max: number): string {
  return typeof x === 'string' ? x.slice(0, max) : '';
}

function optText(x: unknown, max: number): string | undefined {
  return typeof x === 'string' && x.trim() ? x.slice(0, max) : undefined;
}

/** Duración en minutos, redondeada y limitada a [1, 48 h]; null si no es un número positivo. */
function minutes(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.min(MAX_BLOCK, Math.max(1, Math.round(x))) : null;
}

export function isValidDate(x: unknown): x is string {
  if (typeof x !== 'string') return false;
  const m = x.match(DATE_RE);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // Rechaza fechas imposibles como 2026-02-31 (Date las desplazaría en silencio).
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isValidColor(x: unknown): x is string {
  return typeof x === 'string' && COLOR_RE.test(x);
}

function activityType(x: unknown): ActivityType | null {
  if (!isObj(x)) return null;
  const i = id(x.id);
  if (!i) return null;
  return {
    id: i,
    name: text(x.name, MAX_NAME),
    blockMinutes: minutes(x.blockMinutes) ?? DEFAULT_BLOCK,
    color: isValidColor(x.color) ? x.color : FALLBACK_COLOR,
  };
}

function team(x: unknown): Team | null {
  if (!isObj(x)) return null;
  const i = id(x.id);
  const typeId = id(x.activityTypeId);
  if (!i || !typeId) return null;
  const t: Team = { id: i, name: text(x.name, MAX_NAME), activityTypeId: typeId };
  const o = minutes(x.blockMinutesOverride);
  if (o !== null) t.blockMinutesOverride = o;
  return t;
}

function event(x: unknown): CalendarEvent | null {
  if (!isObj(x)) return null;
  const i = id(x.id);
  const teamId = id(x.teamId);
  if (!i || !teamId || !isValidDate(x.date)) return null;
  const ev: CalendarEvent = { id: i, teamId, date: x.date, title: text(x.title, MAX_TEXT) };
  // Una hora inválida se trata como "pendiente de horario" en vez de perder el partido.
  if (typeof x.time === 'string' && TIME_RE.test(x.time)) ev.time = x.time;
  const venue = optText(x.venue, MAX_TEXT);
  if (venue) ev.venue = venue;
  const notes = optText(x.notes, MAX_TEXT);
  if (notes) ev.notes = notes;
  const o = minutes(x.blockMinutesOverride);
  if (o !== null) ev.blockMinutesOverride = o;
  return ev;
}

function group(x: unknown): Group | null {
  if (!isObj(x) || !Array.isArray(x.teamIds)) return null;
  const i = id(x.id);
  if (!i) return null;
  return { id: i, name: text(x.name, MAX_NAME), teamIds: [...new Set(x.teamIds.map(id).filter((t): t is string => t !== null))] };
}

/** Aplica `parse` a cada elemento, descartando inválidos e ids repetidos. */
function list<T extends { id: string }>(xs: unknown[], parse: (x: unknown) => T | null): { items: T[]; dropped: number } {
  const seen = new Set<string>();
  const items: T[] = [];
  for (const x of xs.slice(0, MAX_ITEMS)) {
    const item = parse(x);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  }
  return { items, dropped: xs.length - items.length };
}

export interface SanitizeResult {
  data: AppData;
  /** Elementos descartados por inválidos, repetidos o huérfanos. */
  dropped: number;
}

/**
 * Versión del formato de datos guardado y exportado. Si algún día cambia la forma de los datos:
 * súbela y añade en `migrate` la conversión desde la versión anterior.
 */
export const SCHEMA_VERSION = 1;

/** Convierte datos de versiones anteriores al formato actual. Los datos sin versión son de la versión 1. */
function migrate(x: Obj, _from: number): Obj {
  return x;
}

export type ParseResult = ({ ok: true } & SanitizeResult) | { ok: false; reason: 'invalid' | 'newer' };

/**
 * Lee datos externos: comprueba la versión, migra si son antiguos y los limpia.
 * Datos de una versión más nueva se rechazan: interpretarlos con este código podría perder información.
 */
export function parseAppData(x: unknown): ParseResult {
  if (!isObj(x)) return { ok: false, reason: 'invalid' };
  const version = typeof x.version === 'number' && Number.isInteger(x.version) && x.version > 0 ? x.version : 1;
  if (version > SCHEMA_VERSION) return { ok: false, reason: 'newer' };
  const result = sanitizeAppData(migrate(x, version));
  return result ? { ok: true, ...result } : { ok: false, reason: 'invalid' };
}

/** JSON con la versión del formato, para guardar en el navegador o exportar. */
export function serializeAppData(data: AppData, pretty = false): string {
  return JSON.stringify({ version: SCHEMA_VERSION, ...data }, null, pretty ? 2 : undefined);
}

/** Devuelve datos seguros para usar, o null si ni siquiera tiene la forma de una copia de MatchCalendar. */
export function sanitizeAppData(x: unknown): SanitizeResult | null {
  if (!isObj(x)) return null;
  const { activityTypes, teams, events, groups } = x;
  if (![activityTypes, teams, events, groups].every(Array.isArray)) return null;

  const a = list(activityTypes as unknown[], activityType);
  const typeIds = new Set(a.items.map((t) => t.id));
  const t = list(teams as unknown[], team);
  // Un equipo sin actividad no se podría mostrar ni calcular: se descarta.
  const validTeams = t.items.filter((tm) => typeIds.has(tm.activityTypeId));
  const teamIds = new Set(validTeams.map((tm) => tm.id));
  const e = list(events as unknown[], event);
  const validEvents = e.items.filter((ev) => teamIds.has(ev.teamId));
  const g = list(groups as unknown[], group);
  const validGroups = g.items.map((gr) => ({ ...gr, teamIds: gr.teamIds.filter((tid) => teamIds.has(tid)) }));

  return {
    data: { activityTypes: a.items, teams: validTeams, events: validEvents, groups: validGroups },
    dropped:
      a.dropped + t.dropped + (t.items.length - validTeams.length) + e.dropped + (e.items.length - validEvents.length) + g.dropped,
  };
}
