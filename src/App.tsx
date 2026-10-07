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
  const { data } = useStore();
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
        <button className="brand" onClick={() => go('home')}>
          <BrandMark />
          MatchCalendar
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
        <View />
      </main>
    </div>
  );
}

/** Dos bloques de tiempo que se pisan: la idea de la app. */
function BrandMark() {
  return (
    <svg className="brand-logo" viewBox="0 0 30 20" aria-hidden>
      <defs>
        <pattern id="brand-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2" height="4" fill="#ff5a6b" />
        </pattern>
      </defs>
      <rect x="0" y="2" width="19" height="7" rx="1.5" fill="#f2a900" />
      <rect x="11" y="11" width="19" height="7" rx="1.5" fill="#ffffff" />
      <rect x="11" y="0" width="8" height="20" fill="url(#brand-hatch)" />
    </svg>
  );
}
