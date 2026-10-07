import { useState } from 'react';
import { parseFcbqText, type ParsedMatch } from '../import/fcbqParser';
import { matchExisting } from '../import/match';
import { useStore } from '../model/store';
import { newId, type CalendarEvent, type Team } from '../model/types';
import { formatDateShort, useUi } from '../ui';

type Row = ParsedMatch & { include: boolean };

export default function FcbqImport({ team, onDone }: { team: Team; onDone: () => void }) {
  const { data, dispatch } = useStore();
  const { toast } = useUi();
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);

  const existing = data.events.filter((e) => e.teamId === team.id);

  const analyze = (t: string) => setRows(t.trim() ? parseFcbqText(t).map((m) => ({ ...m, include: true })) : null);
  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const selected = rows?.filter((r) => r.include) ?? [];
  // Solo se emparejan las filas marcadas: una fila desmarcada no debe "reservar" un partido guardado.
  const matches = matchExisting(selected, existing);
  const prevOf = new Map(selected.map((r, i) => [r, matches[i]]));
  const nUpdates = matches.filter(Boolean).length;

  const doImport = () => {
    const events: CalendarEvent[] = selected.map((r, i) => {
      const prev = matches[i];
      return { ...prev, id: prev?.id ?? newId(), teamId: team.id, date: r.date, time: r.time, title: r.title, venue: r.venue, notes: r.notes ?? prev?.notes };
    });
    dispatch({ type: 'upsertEvents', events });
    toast(
      `${events.length - nUpdates} partido(s) nuevos` + (nUpdates ? ` y ${nUpdates} actualizado(s)` : '') + ` en ${team.name}`,
    );
    onDone();
  };

  return (
    <div className="import">
      <ol className="howto">
        <li>
          Abre el calendario del equipo en{' '}
          <a href="https://www.basquetcatala.cat" target="_blank" rel="noreferrer">
            basquetcatala.cat
          </a>
          .
        </li>
        <li>Selecciona con el ratón toda la tabla de partidos y cópiala (Ctrl+C).</li>
        <li>Pégala aquí debajo (Ctrl+V). Revisa la lista y pulsa Importar.</li>
      </ol>
      <textarea
        rows={rows ? 3 : 7}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          analyze(e.target.value);
        }}
        placeholder="Pega aquí el calendario…"
        aria-label="Texto del calendario"
      />

      {rows && rows.length === 0 && (
        <p className="notice warn">No se ha encontrado ninguna fecha (dd/mm/aaaa) en el texto. ¿Has copiado la tabla de partidos?</p>
      )}

      {rows && rows.length > 0 && (
        <>
          <p className="notice ok">
            ✅ {rows.length} partido(s) detectados. Desmarca los que no quieras y corrige lo que haga falta.
          </p>
          <div className="table-wrap">
            <table className="events">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos"
                      checked={rows.every((r) => r.include)}
                      onChange={(e) => setRows(rows.map((r) => ({ ...r, include: e.target.checked })))}
                    />
                  </th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Partido</th>
                  <th>Lugar</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.include ? (r.time ? '' : 'pending') : 'excluded'}>
                    <td>
                      <input type="checkbox" aria-label={`Importar ${formatDateShort(r.date)}`} checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} />
                    </td>
                    <td>
                      <input type="date" value={r.date} onChange={(e) => e.target.value && update(i, { date: e.target.value })} />
                    </td>
                    <td>
                      <input type="time" value={r.time ?? ''} onChange={(e) => update(i, { time: e.target.value || undefined })} />
                    </td>
                    <td>
                      <input className="wide" value={r.title} onChange={(e) => update(i, { title: e.target.value })} />
                    </td>
                    <td>
                      <input className="wide" value={r.venue ?? ''} onChange={(e) => update(i, { venue: e.target.value || undefined })} />
                    </td>
                    <td>{!r.include ? null : prevOf.get(r) ? <span className="pill">actualiza</span> : <span className="pill new">nuevo</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="toolbar">
            <button className="primary" onClick={doImport} disabled={selected.length === 0}>
              Importar {selected.length} partido(s)
            </button>
            <button
              className="ghost"
              onClick={() => {
                setText('');
                setRows(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
