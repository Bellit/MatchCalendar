import { useRef, useState } from 'react';
import { isAppData, useStore } from '../model/store';
import { DEFAULT_DATA } from '../model/types';

export default function Data() {
  const { data, dispatch } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `matchcalendar-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!isAppData(parsed)) throw new Error('formato no válido');
      if (window.confirm('Esto sustituirá todos los datos actuales. ¿Seguir?')) {
        dispatch({ type: 'replaceAll', data: parsed });
        setMsg('Datos importados correctamente.');
      }
    } catch (e) {
      setMsg(`No se pudo importar: ${(e as Error).message}`);
    }
  };

  return (
    <section>
      <h2>Datos</h2>
      <p className="hint">
        Los datos se guardan solo en este navegador. Exporta una copia para no perderlos o para pasarlos a otro dispositivo o
        persona.
      </p>
      <p className="muted">
        {data.activityTypes.length} actividades · {data.teams.length} equipos · {data.events.length} partidos · {data.groups.length}{' '}
        grupos
      </p>
      <div className="toolbar">
        <button className="primary" onClick={exportJson}>
          Exportar copia (JSON)
        </button>
        <button onClick={() => fileRef.current?.click()}>Importar copia…</button>
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
        <button
          className="danger"
          onClick={() => {
            if (window.confirm('¿Borrar TODOS los datos? Esta acción no se puede deshacer.')) {
              dispatch({ type: 'replaceAll', data: DEFAULT_DATA });
              setMsg('Datos borrados.');
            }
          }}
        >
          Borrar todo
        </button>
      </div>
      {msg && <p>{msg}</p>}
    </section>
  );
}
