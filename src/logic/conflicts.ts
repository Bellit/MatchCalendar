import type { AppData, CalendarEvent, Group } from '../model/types';

export interface Conflict {
  a: CalendarEvent;
  b: CalendarEvent;
  /** Minutos que se pisan los bloques: lo que faltaría de margen. */
  overlapMinutes: number;
}

export interface DateRange {
  from?: string; // YYYY-MM-DD inclusive
  to?: string; // YYYY-MM-DD inclusive
}

/** Minutos desde época de la fecha-hora local (sin zona horaria: solo se comparan entre sí). */
export function startMinutes(ev: CalendarEvent): number | null {
  if (!ev.time) return null;
  const [y, mo, d] = ev.date.split('-').map(Number);
  const [h, mi] = ev.time.split(':').map(Number);
  return Date.UTC(y, mo - 1, d, h, mi) / 60000;
}

export function blockMinutesFor(ev: CalendarEvent, data: Pick<AppData, 'teams' | 'activityTypes'>): number {
  if (ev.blockMinutesOverride) return ev.blockMinutesOverride;
  const team = data.teams.find((t) => t.id === ev.teamId);
  if (team?.blockMinutesOverride) return team.blockMinutesOverride;
  const type = data.activityTypes.find((a) => a.id === team?.activityTypeId);
  return type?.blockMinutes ?? 120;
}

export function inRange(date: string, range?: DateRange): boolean {
  if (!range) return true;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

export function findConflicts(group: Group, data: AppData, range?: DateRange): Conflict[] {
  const teamIds = new Set(group.teamIds);
  const items = data.events
    .filter((ev) => teamIds.has(ev.teamId) && inRange(ev.date, range))
    .map((ev) => {
      const start = startMinutes(ev);
      return start === null ? null : { ev, start, end: start + blockMinutesFor(ev, data) };
    })
    .filter((x): x is { ev: CalendarEvent; start: number; end: number } => x !== null)
    .sort((x, y) => x.start - y.start);

  const conflicts: Conflict[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length && items[j].start < items[i].end; j++) {
      const x = items[i];
      const y = items[j];
      if (x.ev.teamId === y.ev.teamId) continue;
      conflicts.push({
        a: x.ev,
        b: y.ev,
        overlapMinutes: Math.min(x.end, y.end) - y.start,
      });
    }
  }
  return conflicts;
}
