import { useState } from 'react';
import Activities from './views/Activities';
import Conflicts from './views/Conflicts';
import Data from './views/Data';
import Groups from './views/Groups';
import Teams from './views/Teams';

const TABS = [
  { id: 'conflicts', label: 'Coincidencias', view: Conflicts },
  { id: 'teams', label: 'Equipos y partidos', view: Teams },
  { id: 'groups', label: 'Grupos', view: Groups },
  { id: 'activities', label: 'Actividades', view: Activities },
  { id: 'data', label: 'Datos', view: Data },
] as const;

export default function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('conflicts');
  const View = TABS.find((t) => t.id === tab)!.view;
  return (
    <div className="app">
      <header>
        <h1>MatchCalendar</h1>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={t.id === tab ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        <View />
      </main>
    </div>
  );
}
