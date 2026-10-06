import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import { DEFAULT_DATA, type ActivityType, type AppData, type CalendarEvent, type Group, type Team } from './types';

const STORAGE_KEY = 'matchcalendar:v1';

type Collection = 'activityTypes' | 'teams' | 'events' | 'groups';
type Item = ActivityType | Team | CalendarEvent | Group;

export type Action =
  | { type: 'upsert'; collection: Collection; item: Item }
  | { type: 'remove'; collection: Collection; id: string }
  | { type: 'upsertEvents'; events: CalendarEvent[] }
  | { type: 'replaceAll'; data: AppData };

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'upsert':
      return { ...state, [action.collection]: upsert(state[action.collection] as Item[], action.item) };
    case 'remove': {
      const next = { ...state, [action.collection]: (state[action.collection] as Item[]).filter((x) => x.id !== action.id) };
      // Borrados en cascada.
      if (action.collection === 'teams') {
        next.events = next.events.filter((e) => e.teamId !== action.id);
        next.groups = next.groups.map((g) => ({ ...g, teamIds: g.teamIds.filter((t) => t !== action.id) }));
      }
      if (action.collection === 'activityTypes') {
        const removedTeams = new Set(next.teams.filter((t) => t.activityTypeId === action.id).map((t) => t.id));
        next.teams = next.teams.filter((t) => !removedTeams.has(t.id));
        next.events = next.events.filter((e) => !removedTeams.has(e.teamId));
        next.groups = next.groups.map((g) => ({ ...g, teamIds: g.teamIds.filter((t) => !removedTeams.has(t)) }));
      }
      return next;
    }
    case 'upsertEvents':
      return { ...state, events: action.events.reduce(upsert, state.events) };
    case 'replaceAll':
      return action.data;
  }
}

export function isAppData(x: unknown): x is AppData {
  const d = x as AppData;
  return !!d && Array.isArray(d.activityTypes) && Array.isArray(d.teams) && Array.isArray(d.events) && Array.isArray(d.groups);
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isAppData(parsed)) return parsed;
    }
  } catch {
    /* datos corruptos o storage bloqueado: empezar de cero */
  }
  return DEFAULT_DATA;
}

const StoreContext = createContext<{ data: AppData; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignorar */
    }
  }, [data]);
  return <StoreContext.Provider value={{ data, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore fuera de StoreProvider');
  return ctx;
}
