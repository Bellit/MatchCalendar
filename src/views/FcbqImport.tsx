import { useState } from 'react';
import { parseFcbqText, type ParsedMatch } from '../import/fcbqParser';
import { useStore } from '../model/store';
import { newId, type CalendarEvent, type Team } from '../model/types';

type Row = ParsedMatch & { include: boolean };

export default function FcbqImport({ team, onDone }: { team: Team; onDone: () => void }) {
  const { data, dispatch } = useStore();
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const doImport = () => {
    const existing = data.events.filter((e) => e.teamId === team.id);
    const events: CalendarEvent[] = rows!
      .filter((r) => r.include)
      .map((r) => {
        // Mismo equipo y misma fecha → se actualiza el partido existente (p. ej. cambio de hora).
        const prev = existing.find((e) => e.date === r.date);
        return { ...prev, id: prev?.id ?? newId(), teamId: team.id, date: r.date, time: r.time, title: r.title, venue: r.venue, notes: r.notes ?? prev?.notes };
      });
    dispatch({ type: 'upsertEvents', events });
    onDone();
  };

  return (
    <div className="panel">
      <p className="hint">
        Abre el calendario del equipo en <b>basquetcatala.cat</b>, selecciona la tabla de partidos, cópiala (Ctrl+C) y pégala aquí. Se
        importarán en <b>{team.name}</b>. Si un partido ya existe en esa fecha, se actualiza.
      </p>
      <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Pega aquí el calendario…" />
      <div className="toolbar">
        <button onClick={() => setRows(parseFcbqText(text).map((m) => ({ ...m, include: true })))} disabled={!text.trim()}>
          Analizar
        </button>
      </div>
      {rows && (
        <>
          <p>
            {rows.length} partido(s) detectado(s). Revisa y corrige antes de importar.
            {rows.length === 0 && ' No se encontró ninguna fecha (dd/mm/aaaa) en el texto.'}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Partido</th>
                  <th>Lugar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.include ? (r.time ? '' : 'pending') : 'excluded'}>
                    <td>
                      <input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} />
                    </td>
                    <td>
                      <input type="date" value={r.date} onChange={(e) => update(i, { date: e.target.value })} />
                    </td>
                    <td>
                      <input type="time" value={r.time ?? ''} onChange={(e) => update(i, { time: e.target.value || undefined })} />
                    </td>
                    <td>
                      <input value={r.title} onChange={(e) => update(i, { title: e.target.value })} />
                    </td>
                    <td>
                      <input value={r.venue ?? ''} onChange={(e) => update(i, { venue: e.target.value || undefined })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="primary" onClick={doImport} disabled={!rows.some((r) => r.include)}>
            Importar {rows.filter((r) => r.include).length} partido(s)
          </button>
        </>
      )}
    </div>
  );
}
