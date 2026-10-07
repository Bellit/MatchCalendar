import { useMemo, type ComponentType } from 'react';
import { findConflicts } from './logic/conflicts';
import { useStore } from './model/store';
import { localToday, UiProvider, useUi, type TabId } from './ui';
import Activities from './views/Activities';
import Conflicts from './views/Conflicts';
import Data from './views/Data';
import Groups from './views/Groups';
import Home from './views/Home';
import Teams from './views/Teams';

const TABS: { id: TabId; label: string; view: ComponentType }[] = [
  { id: 'home', label: 'Inicio', view: Home },
  { id: 'conflicts', label: 'Coincidencias', view: Conflicts },
  { id: 'teams', label: 'Equipos', view: Teams },
  { id: 'groups', label: 'Grupos', view: Groups },
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
  const View = TABS.find((t) => t.id === nav.tab)!.view;

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
              className={'tab' + (t.id === nav.tab ? ' active' : '')}
              aria-current={t.id === nav.tab ? 'page' : undefined}
              onClick={() => go(t.id)}
            >
              <span className="tab-label">{t.label}</span>
              {t.id === 'conflicts' && upcoming > 0 && <span className="badge">{upcoming}</span>}
            </button>
          ))}
        </nav>
      </header>
      <main key={nav.tab + (nav.teamId ?? '')}>
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

