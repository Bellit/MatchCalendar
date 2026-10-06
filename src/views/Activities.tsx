import { useStore } from '../model/store';
import { formatMinutes, newId, type ActivityType } from '../model/types';
import { DurationInput } from './DurationInput';

export default function Activities() {
  const { data, dispatch } = useStore();
  const save = (item: ActivityType) => dispatch({ type: 'upsert', collection: 'activityTypes', item });

  return (
    <section>
      <h2>Tipos de actividad</h2>
      <p className="hint">
        El <b>bloque</b> es el tiempo que queda ocupado desde la hora de inicio: duración de la actividad + margen para
        desplazarse. Si dos bloques se pisan, es una coincidencia.
      </p>
      <table>
        <thead>
          <tr>
            <th>Color</th>
            <th>Nombre</th>
            <th>Bloque</th>
            <th>Equipos</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.activityTypes.map((a) => {
            const nTeams = data.teams.filter((t) => t.activityTypeId === a.id).length;
            return (
              <tr key={a.id}>
                <td>
                  <input type="color" value={a.color} onChange={(e) => save({ ...a, color: e.target.value })} />
                </td>
                <td>
                  <input value={a.name} onChange={(e) => save({ ...a, name: e.target.value })} />
                </td>
                <td>
                  <DurationInput minutes={a.blockMinutes} onChange={(m) => save({ ...a, blockMinutes: m ?? 60 })} />
                  <span className="muted"> {formatMinutes(a.blockMinutes)}</span>
                </td>
                <td>{nTeams}</td>
                <td>
                  <button
                    className="danger"
                    onClick={() => {
                      if (nTeams === 0 || window.confirm(`Se borrarán también ${nTeams} equipo(s) y sus partidos. ¿Seguir?`))
                        dispatch({ type: 'remove', collection: 'activityTypes', id: a.id });
                    }}
                  >
                    Borrar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button onClick={() => save({ id: newId(), name: 'Nueva actividad', blockMinutes: 180, color: '#3b6fd8' })}>
        + Añadir actividad
      </button>
    </section>
  );
}
