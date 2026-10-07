import { useState } from 'react';
import { parseFcbqText, type ParsedMatch } from '../import/fcbqParser';
import { matchExisting } from '../import/match';
import { useStore } from '../model/store';
import { newId, type CalendarEvent, type Team } from '../model/types';
import { formatDateShort, plural, useUi } from '../ui';

type Row = ParsedMatch & { include: boolean };

// En pantallas táctiles no hay ratón ni Ctrl+C: las instrucciones cambian.
const isTouch = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

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
  // Qué cambia en cada partido que ya estaba guardado: es lo que hay que poder comprobar antes de importar.
  const changeOf = (r: Row): string[] => {
    const prev = prevOf.get(r);
    if (!prev) return [];
    const out: string[] = [];
    if (prev.date !== r.date) out.push(`${formatDateShort(prev.date)} → ${formatDateShort(r.date)}`);
    if ((prev.time ?? '') !== (r.time ?? '')) out.push(`${prev.time ?? 'sin hora'} → ${r.time ?? 'sin hora'}`);
    return out;
  };
  const nChanged = selected.filter((r) => changeOf(r).length > 0).length;

  const doImport = () => {
    const events: CalendarEvent[] = selected.map((r, i) => {
      const prev = matches[i];
      return { ...prev, id: prev?.id ?? newId(), teamId: team.id, date: r.date, time: r.time, title: r.title, venue: r.venue, notes: r.notes ?? prev?.notes };
    });
    dispatch({ type: 'upsertEvents', events });
    toast(
      `${plural(events.length - nUpdates, 'partido nuevo', 'partidos nuevos')}` + (nUpdates ? ` y ${plural(nUpdates, 'actualizado')}` : '') + ` en ${team.name}`,
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
        {isTouch ? (
          <>
            <li>Mantén pulsado sobre la tabla de partidos, ajusta la selección para que cubra toda la tabla y elige «Copiar».</li>
            <li>Mantén pulsado en el recuadro de abajo y elige «Pegar». Revisa la lista y pulsa Importar.</li>
          </>
        ) : (
          <>
            <li>Selecciona con el ratón toda la tabla de partidos y cópiala (Ctrl+C).</li>
            <li>Pégala aquí debajo (Ctrl+V). Revisa la lista y pulsa Importar.</li>
          </>
        )}
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
            {plural(rows.length, 'partido detectado', 'partidos detectados')}. Desmarca los que no quieras y corrige lo que haga falta.
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
                    <td>
                      {!r.include ? null : !prevOf.get(r) ? (
                        <span className="pill new">nuevo</span>
                      ) : changeOf(r).length ? (
                        changeOf(r).map((c) => (
                          <span key={c} className="pill change">
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="pill">sin cambios</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nUpdates > 0 && (
            <p className={'notice ' + (nChanged ? 'warn' : 'ok')} role="status">
              {nChanged
                ? `${plural(nChanged, 'partido ya guardado cambia', 'partidos ya guardados cambian')} de fecha u hora. Revísalos en la última columna.`
                : nUpdates === 1
                  ? 'El partido ya guardado no cambia de fecha ni de hora.'
                  : `Los ${nUpdates} partidos ya guardados no cambian de fecha ni de hora.`}
            </p>
          )}
          <div className="toolbar">
            <button className="primary" onClick={doImport} disabled={selected.length === 0}>
              Importar {plural(selected.length, 'partido')}
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
