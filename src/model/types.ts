export interface ActivityType {
  id: string;
  name: string;
  /** Minutos que bloquea la actividad desde su hora de inicio (duración + margen). */
  blockMinutes: number;
  color: string;
}

export interface Team {
  id: string;
  name: string;
  activityTypeId: string;
  blockMinutesOverride?: number;
}

export interface CalendarEvent {
  id: string;
  teamId: string;
  /** Fecha local "YYYY-MM-DD". */
  date: string;
  /** Hora local "HH:MM"; undefined si está pendiente de horario. */
  time?: string;
  title: string;
  venue?: string;
  blockMinutesOverride?: number;
  notes?: string;
}

export interface Group {
  id: string;
  name: string;
  teamIds: string[];
}

export interface AppData {
  activityTypes: ActivityType[];
  teams: Team[];
  events: CalendarEvent[];
  groups: Group[];
}

export const DEFAULT_DATA: AppData = {
  activityTypes: [
    { id: 'basket', name: 'Baloncesto', blockMinutes: 180, color: '#e8711a' },
    { id: 'futbol', name: 'Fútbol', blockMinutes: 210, color: '#2e9d4f' },
    { id: 'danza', name: 'Danza', blockMinutes: 300, color: '#b0479c' },
  ],
  teams: [],
  events: [],
  groups: [],
};

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
