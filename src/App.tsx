import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { findConflicts } from './logic/conflicts';
import { useStore } from './model/store';
import { Icon, localToday, UiProvider, useUi, type IconName, type TabId } from './ui';
import Activities from './views/Activities';
import Conflicts from './views/Conflicts';
import Data from './views/Data';
import Groups from './views/Groups';
import Home from './views/Home';
import Teams from './views/Teams';

// En el móvil las cuatro principales van en la barra inferior; las de ajustes, dentro de "Más".
const TABS: { id: TabId; label: string; view: ComponentType; icon?: IconName }[] = [
  { id: 'home', label: 'Inicio', view: Home, icon: 'home' },
  { id: 'conflicts', label: 'Coincidencias', view: Conflicts, icon: 'clash' },
  { id: 'teams', label: 'Equipos', view: Teams, icon: 'team' },
  { id: 'groups', label: 'Grupos', view: Groups, icon: 'link' },
  { id: 'activities', label: 'Actividades', view: Activities },
  { id: 'data', label: 'Datos', view: Data },
];

export default function App() {
  const { data } = useStore();
  // Primera visita (sin grupos) → Inicio; si ya hay datos → Coincidencias.
  return (
    <UiProvider initialTab={data.groups.length ? 'conflicts' : 'home'}>
      <Shell />
    </UiProvider>
  );
}

function Shell() {
  const { data, storageProblem } = useStore();
  const { nav, go } = useUi();
  const current = TABS.find((t) => t.id === nav.tab)!;
  const View = current.view;
  const mainRef = useRef<HTMLElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const inMore = !current.icon;

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', close);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', close);
    };
  }, [moreOpen]);
  const firstRender = useRef(true);

  // Al cambiar de sección: título de la pestaña del navegador y foco en el contenido, para que el lector de pantalla lo anuncie.
  useEffect(() => {
    document.title = nav.tab === 'home' ? 'MatchCalendar' : `${current.label} · MatchCalendar`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [nav.tab, nav.teamId]);

  const upcoming = useMemo(() => {
    const seen = new Set<string>();
    for (const g of data.groups)
      for (const c of findConflicts(g, data, { from: localToday() })) seen.add([c.a.id, c.b.id].sort().join('|'));
    return seen.size;
  }, [data]);

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => go('home')} aria-label="MatchCalendar: ir a inicio">
          {/* La barra es siempre azul marino: se usa la versión del logo para fondo oscuro */}
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}matchcalendar-logo-dark.svg`} alt="" width={176} height={40} />
        </button>
        <nav className="tabs" aria-label="Secciones">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={'tab' + (t.id === nav.tab ? ' active' : '') + (t.icon ? '' : ' tab-secondary')}
              aria-current={t.id === nav.tab ? 'page' : undefined}
              onClick={() => go(t.id)}
            >
              {t.icon && (
                <span className="tab-icon">
                  <Icon name={t.icon} size={22} />
                </span>
              )}
              <span className="tab-label">{t.label}</span>
              {t.id === 'conflicts' && upcoming > 0 && <span className="badge">{upcoming}</span>}
            </button>
          ))}
          <div className="tab-more-wrap" ref={moreRef}>
            <button
              className={'tab tab-more' + (inMore ? ' active' : '')}
              aria-expanded={moreOpen}
              aria-haspopup="true"
              onClick={() => setMoreOpen((o) => !o)}
            >
              <span className="tab-icon">
                <Icon name="more" size={22} />
              </span>
              <span className="tab-label">Más</span>
            </button>
            {moreOpen && (
              <div className="more-menu">
                {TABS.filter((t) => !t.icon).map((t) => (
                  <button
                    key={t.id}
                    className={t.id === nav.tab ? 'active' : ''}
                    aria-current={t.id === nav.tab ? 'page' : undefined}
                    onClick={() => {
                      setMoreOpen(false);
                      go(t.id);
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
      </header>
      <main key={nav.tab + (nav.teamId ?? '')} ref={mainRef} tabIndex={-1} aria-label={current.label}>
        {/* Inicio y Coincidencias tienen su propio título visible; el resto empieza en tarjetas con h2. */}
        {nav.tab !== 'home' && nav.tab !== 'conflicts' && <h1 className="sr-only">{current.label}</h1>}
        {storageProblem === 'newer' && (
          <p className="notice bad save-failed" role="alert">
            Tus datos se guardaron con una versión más nueva de MatchCalendar. Esta pestaña tiene una versión antigua y no los puede
            mostrar ni guardar cambios.{' '}
            <button className="link" onClick={() => window.location.reload()}>
              Recargar para actualizar
            </button>
          </p>
        )}
        {storageProblem === 'quota' && (
          <p className="notice bad save-failed" role="alert">
            Los últimos cambios no se han podido guardar en este navegador (almacenamiento lleno o bloqueado). Si cierras la página se
            perderán.{' '}
            {nav.tab !== 'data' && (
              <button className="link" onClick={() => go('data')}>
                Descargar una copia
              </button>
            )}
          </p>
        )}
        <View />
      </main>
    </div>
  );
}

