import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore, type Collection } from './model/store';
import type { AppData } from './model/types';
import { serializeAppData } from './model/validate';

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
  /** Confirmación con el estilo de la app (sustituye a window.confirm). */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** Ofrece descargar una copia de seguridad antes de seguir. */
  offerBackup?: boolean;
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
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
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

  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })), []);

  return (
    <Ctx.Provider value={{ nav, go, toast, confirm }}>
      {children}
      {pending && (
        <ConfirmDialog
          opts={pending}
          onClose={(ok) => {
            pending.resolve(ok);
            setPending(null);
          }}
        />
      )}
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

function ConfirmDialog({ opts, onClose }: { opts: ConfirmOptions; onClose: (ok: boolean) => void }) {
  const { data } = useStore();
  const ref = useRef<HTMLDialogElement>(null);
  const [backedUp, setBackedUp] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose(false);
      }}
    >
      <h2 id="confirm-title">{opts.title}</h2>
      {opts.body && <div className="confirm-body">{opts.body}</div>}
      {opts.offerBackup && (
        <p className="confirm-backup">
          <button
            className="link"
            onClick={() => {
              downloadBackup(data);
              setBackedUp(true);
            }}
          >
            {backedUp ? 'Copia descargada' : 'Descargar una copia antes'}
          </button>
        </p>
      )}
      <div className="toolbar">
        <button className={opts.danger ? 'danger solid' : 'primary'} onClick={() => onClose(true)}>
          {opts.confirmLabel}
        </button>
        <button autoFocus onClick={() => onClose(false)}>
          Cancelar
        </button>
      </div>
    </dialog>
  );
}

export function downloadBackup(data: AppData) {
  downloadFile(serializeAppData(data, true), `matchcalendar-${localToday()}.json`);
}

/** Sustituye todos los datos y ofrece deshacerlo desde el aviso. */
export function useReplaceAllWithUndo() {
  const { data, dispatch } = useStore();
  const { toast } = useUi();
  return (next: AppData, message: string) => {
    const before = data;
    dispatch({ type: 'replaceAll', data: next });
    toast(message, {
      label: 'Deshacer',
      run: () => {
        // Vuelta exacta al estado anterior (restore fusionaría y dejaría los datos nuevos).
        dispatch({ type: 'replaceAll', data: before });
        toast('Datos anteriores recuperados');
      },
    });
  };
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

/** Icono de papelera; toma el color del botón (el emoji 🗑 no se puede colorear y apenas se ve). */
export function TrashIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
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

/** Iconos de trazo (mismo grosor que la papelera) en lugar de emoji: toman el color del texto. */
const ICON_PATHS = {
  team: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.4A6.5 6.5 0 0 1 21.5 20',
  calendar: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5ZM4 10h16M8 3v4M16 3v4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  download: 'M12 4v11M7 10.5l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 9.5l5-5 5 5M5 20h14',
  home: 'M4 11 12 4l8 7M6 9.5V20h4.5v-5.5h3V20H18V9.5',
  clash: 'M3 8h9M3 16h9M12 8l4 8M12 16l4-8M16 8h5M16 16h5',
  more: 'M6.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM13.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM20.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z',
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
} as const;
export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>
        <Icon name={icon} size={28} />
      </div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/** Nombre editable que nunca se guarda vacío: al salir del campo sin nombre, vuelve al último válido. */
export function NameInput({
  value,
  onSave,
  className,
  label,
}: {
  value: string;
  onSave: (name: string) => void;
  className?: string;
  label?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const empty = !draft.trim();
  return (
    <input
      className={className}
      aria-label={label}
      aria-invalid={empty || undefined}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (e.target.value.trim()) onSave(e.target.value);
      }}
      onBlur={() => empty && setDraft(value)}
    />
  );
}

/** Color de texto legible (blanco o tinta oscura) sobre un color de fondo "#rrggbb" elegido por el usuario. */
export function inkOn(hex: string | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return (1.05 / (L + 0.05)) >= 4.5 ? '#ffffff' : '#0b1726';
}
