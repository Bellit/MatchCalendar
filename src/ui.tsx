import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type TabId = 'home' | 'conflicts' | 'teams' | 'groups' | 'activities' | 'data';

interface NavState {
  tab: TabId;
  /** Equipo a abrir al ir a la pestaña de equipos. */
  teamId?: string;
}

interface UiContext {
  nav: NavState;
  go: (tab: TabId, opts?: { teamId?: string }) => void;
  toast: (msg: string) => void;
}

const Ctx = createContext<UiContext | null>(null);

export function UiProvider({ initialTab, children }: { initialTab: TabId; children: ReactNode }) {
  const [nav, setNav] = useState<NavState>({ tab: initialTab });
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const nextId = useRef(0);

  const go = useCallback((tab: TabId, opts?: { teamId?: string }) => {
    setNav({ tab, teamId: opts?.teamId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const toast = useCallback((msg: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <Ctx.Provider value={{ nav, go, toast }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useUi() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUi fuera de UiProvider');
  return ctx;
}

/** Fecha local de hoy en formato YYYY-MM-DD. */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateLong(date: string): string {
  return parseLocalDate(date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateShort(date: string): string {
  return parseLocalDate(date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatMonth(date: string): string {
  return parseLocalDate(date).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>
        {icon}
      </div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
