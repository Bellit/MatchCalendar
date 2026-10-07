import { createContext, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_DATA, type ActivityType, type AppData, type CalendarEvent, type Group, type Team } from './types';
import { sanitizeAppData } from './validate';

export const STORAGE_KEY = 'matchcalendar:v1';

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

/** Interpreta el JSON guardado; datos corruptos o manipulados se limpian en lugar de romper la app. */
function parseStored(raw: string | null): AppData | null {
  if (!raw) return null;
  try {
    return sanitizeAppData(JSON.parse(raw))?.data ?? null;
  } catch {
    return null;
  }
}

function load(): AppData {
  try {
    return parseStored(localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_DATA;
  } catch {
    /* storage bloqueado: empezar de cero */
    return DEFAULT_DATA;
  }
}

interface StoreContextValue {
  data: AppData;
  dispatch: (a: Action) => void;
  /** true si el último guardado en el navegador ha fallado (almacenamiento lleno o bloqueado). */
  saveFailed: boolean;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, load);
  const [saveFailed, setSaveFailed] = useState(false);
  // Último JSON escrito o recibido de otra pestaña: evita reescribir lo que ya está guardado.
  const lastSaved = useRef<string | null>(null);

  useEffect(() => {
    const json = JSON.stringify(data);
    if (json === lastSaved.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, json);
      lastSaved.current = json;
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, [data]);

  // Con la app abierta en varias pestañas, cada una adopta los cambios de las demás
  // en vez de pisarlos con su copia antigua en el siguiente guardado.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.newValue === null || e.newValue === lastSaved.current) return;
      const next = parseStored(e.newValue);
      if (!next) return;
      lastSaved.current = e.newValue;
      dispatch({ type: 'replaceAll', data: next });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return <StoreContext.Provider value={{ data, dispatch, saveFailed }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore fuera de StoreProvider');
  return ctx;
}
