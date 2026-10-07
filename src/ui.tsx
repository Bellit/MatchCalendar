import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useStore, type Collection } from './model/store';

export type TabId = 'home' | 'conflicts' | 'teams' | 'groups' | 'activities' | 'data';

interface NavState {
  tab: TabId;
  /** Equipo a abrir al ir a la pestaña de equipos. */
  teamId?: string;
}

interface UiContext {
  nav: NavState;
  go: (tab: TabId, opts?: { teamId?: string }) => void;
  toast: (msg: string, action?: ToastAction) => void;
}

export interface ToastAction {
  label: string;
  run: () => void;
}

const Ctx = createContext<UiContext | null>(null);

export function UiProvider({ initialTab, children }: { initialTab: TabId; children: ReactNode }) {
  const [nav, setNav] = useState<NavState>({ tab: initialTab });
  const [toasts, setToasts] = useState<{ id: number; msg: string; action?: ToastAction }[]>([]);
  const nextId = useRef(0);

  const go = useCallback((tab: TabId, opts?: { teamId?: string }) => {
    setNav({ tab, teamId: opts?.teamId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (msg: string, action?: ToastAction) => {
      const id = nextId.current++;
      setToasts((t) => [...t, { id, msg, action }]);
      // Con acción (p. ej. Deshacer) se deja más tiempo para reaccionar.
      setTimeout(() => dismiss(id), action ? 8000 : 3500);
    },
    [dismiss],
  );

  return (
    <Ctx.Provider value={{ nav, go, toast }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span>{t.msg}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  dismiss(t.id);
                  t.action!.run();
                }}
              >
                {t.action.label}
              </button>
            )}
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

/**
 * Descarga un texto como archivo. El enlace se añade al documento y la URL se libera más tarde:
 * si se libera justo después de click(), Firefox y Safari pueden cancelar la descarga.
 */
export function downloadFile(content: string, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Borra un elemento (con sus dependencias en cascada) y ofrece deshacerlo desde el aviso.
 * Así los borrados de un clic no necesitan confirmación y nunca son irreversibles.
 */
export function useRemoveWithUndo() {
  const { data, dispatch } = useStore();
  const { toast } = useUi();
  return (collection: Collection, id: string, message: string) => {
    const before = data;
    dispatch({ type: 'remove', collection, id });
    toast(message, {
      label: 'Deshacer',
      run: () => {
        dispatch({ type: 'restore', before });
        toast('Borrado deshecho');
      },
    });
  };
}

/** "1 partido" / "3 partidos". */
export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
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
