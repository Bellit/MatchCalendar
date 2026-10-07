import { createContext, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_DATA, type ActivityType, type AppData, type CalendarEvent, type Group, type Team } from './types';
import { parseAppData, serializeAppData, type ParseResult } from './validate';

export const STORAGE_KEY = 'matchcalendar:v1';

export type Collection = 'activityTypes' | 'teams' | 'events' | 'groups';
type Item = ActivityType | Team | CalendarEvent | Group;

export type Action =
  | { type: 'upsert'; collection: Collection; item: Item }
  | { type: 'remove'; collection: Collection; id: string }
  | { type: 'upsertEvents'; events: CalendarEvent[] }
  | { type: 'replaceAll'; data: AppData }
  /** Deshace un borrado: recupera lo que había en `before` y ya no está, sin tocar lo cambiado después. */
  | { type: 'restore'; before: AppData };

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

/** Une `before` y `current` en el orden original: lo que sigue existiendo conserva su versión actual. */
function mergeBack<T extends { id: string }>(before: T[], current: T[]): T[] {
  const byId = new Map(current.map((x) => [x.id, x]));
  const merged = before.map((b) => byId.get(b.id) ?? b);
  const known = new Set(before.map((b) => b.id));
  return [...merged, ...current.filter((c) => !known.has(c.id))];
}

function restore(state: AppData, before: AppData): AppData {
  const activityTypes = mergeBack(before.activityTypes, state.activityTypes);
  const typeIds = new Set(activityTypes.map((a) => a.id));
  const teams = mergeBack(before.teams, state.teams).filter((t) => typeIds.has(t.activityTypeId));
  const teamIds = new Set(teams.map((t) => t.id));
  const events = mergeBack(before.events, state.events).filter((e) => teamIds.has(e.teamId));
  const beforeGroups = new Map(before.groups.map((g) => [g.id, g]));
  const groups = mergeBack(before.groups, state.groups).map((g) => ({
    ...g,
    // Primero el orden original, luego lo añadido después.
    teamIds: [...new Set([...(beforeGroups.get(g.id)?.teamIds ?? []), ...g.teamIds])].filter((id) => teamIds.has(id)),
  }));
  return { activityTypes, teams, events, groups };
}

export function reducer(state: AppData, action: Action): AppData {
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
    case 'restore':
      return restore(state, action.before);
  }
}

/**
 * Problema con el guardado en el navegador:
 *  - 'quota': el último guardado ha fallado (almacenamiento lleno o bloqueado).
 *  - 'newer': los datos guardados son de una versión más nueva de la app; esta no los toca para no estropearlos.
 */
export type StorageProblem = 'quota' | 'newer' | null;

/** Interpreta el JSON guardado; datos corruptos o manipulados se limpian en lugar de romper la app. */
function parseStored(raw: string | null): ParseResult | null {
  if (!raw) return null;
  try {
    return parseAppData(JSON.parse(raw));
  } catch {
    return null;
  }
}

function load(): { data: AppData; problem: StorageProblem } {
  let parsed: ParseResult | null = null;
  try {
    parsed = parseStored(localStorage.getItem(STORAGE_KEY));
  } catch {
    /* storage bloqueado: empezar de cero */
  }
  if (parsed?.ok) return { data: parsed.data, problem: null };
  return { data: DEFAULT_DATA, problem: parsed?.reason === 'newer' ? 'newer' : null };
}

interface StoreContextValue {
  data: AppData;
  dispatch: (a: Action) => void;
  storageProblem: StorageProblem;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(load);
  const [data, dispatch] = useReducer(reducer, initial.data);
  const [storageProblem, setStorageProblem] = useState<StorageProblem>(initial.problem);
  // Con datos de una versión más nueva no se guarda nada: se perderían sus campos nuevos.
  const blocked = useRef(initial.problem === 'newer');
  // Último JSON escrito o recibido de otra pestaña: evita reescribir lo que ya está guardado.
  const lastSaved = useRef<string | null>(null);

  useEffect(() => {
    if (blocked.current) return;
    const json = serializeAppData(data);
    if (json === lastSaved.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, json);
      lastSaved.current = json;
      setStorageProblem(null);
    } catch {
      setStorageProblem('quota');
    }
  }, [data]);

  // Con la app abierta en varias pestañas, cada una adopta los cambios de las demás
  // en vez de pisarlos con su copia antigua en el siguiente guardado.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.newValue === null || e.newValue === lastSaved.current) return;
      const next = parseStored(e.newValue);
      if (!next) return;
      if (!next.ok) {
        if (next.reason === 'newer') {
          blocked.current = true;
          setStorageProblem('newer');
        }
        return;
      }
      lastSaved.current = e.newValue;
      dispatch({ type: 'replaceAll', data: next.data });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return <StoreContext.Provider value={{ data, dispatch, storageProblem }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore fuera de StoreProvider');
  return ctx;
}
