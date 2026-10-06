import { useRef } from 'react';
import { isAppData, useStore } from '../model/store';
import { DEFAULT_DATA } from '../model/types';
import { localToday, useUi } from '../ui';

export default function Data() {
  const { data, dispatch } = useStore();
  const { toast } = useUi();
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `matchcalendar-${localToday()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Copia descargada');
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!isAppData(parsed)) throw new Error('el archivo no es una copia de MatchCalendar');
      if (window.confirm('Esto sustituirá todos los datos actuales. ¿Seguir?')) {
        dispatch({ type: 'replaceAll', data: parsed });
        toast(`Copia importada: ${parsed.teams.length} equipos, ${parsed.events.length} partidos`);
      }
    } catch (e) {
      toast(`No se pudo importar: ${(e as Error).message}`);
    }
  };

  const stats = [
    [data.activityTypes.length, 'actividades'],
    [data.teams.length, 'equipos'],
    [data.events.length, 'partidos'],
    [data.groups.length, 'grupos'],
  ] as const;

  return (
    <>
      <section className="card">
        <h2>Tus datos</h2>
        <p className="muted">
          Todo se guarda <b>solo en este navegador</b>. Haz una copia de vez en cuando para no perderla, o para pasarla a otro ordenador
          o a otra persona (por ejemplo, al coordinador del club).
        </p>
        <div className="stats">
          {stats.map(([n, label]) => (
            <div key={label} className="stat">
              <span className="stat-value">{n}</span>
              <span className="stat-label">{label}</span>
            </div>
          ))}
        </div>
        <div className="toolbar">
          <button className="primary" onClick={exportJson}>
            ⬇ Descargar copia
          </button>
          <button onClick={() => fileRef.current?.click()}>⬆ Cargar copia…</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = '';
            }}
          />
        </div>
      </section>
      <section className="card danger-zone">
        <h2>Zona peligrosa</h2>
        <p className="muted">Borra todos los equipos, partidos y grupos de este navegador. Las actividades vuelven a los valores iniciales.</p>
        <button
          className="danger solid"
          onClick={() => {
            if (window.confirm('¿Borrar TODOS los datos? Esta acción no se puede deshacer.')) {
              dispatch({ type: 'replaceAll', data: DEFAULT_DATA });
              toast('Datos borrados');
            }
          }}
        >
          Borrar todo
        </button>
      </section>
    </>
  );
}
