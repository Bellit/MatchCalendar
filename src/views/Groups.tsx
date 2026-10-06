import { useStore } from '../model/store';
import { newId, type Group } from '../model/types';

export default function Groups() {
  const { data, dispatch } = useStore();
  const save = (g: Group) => dispatch({ type: 'upsert', collection: 'groups', item: g });

  return (
    <section>
      <h2>Grupos</h2>
      <p className="hint">
        Un grupo reúne los equipos cuyos calendarios no pueden pisarse: p. ej. "Jugadores Junior que suben al Sénior" o "Familia
        García" (fútbol de la hija + baloncesto del hijo + equipo que entrena el padre).
      </p>
      {data.groups.map((g) => (
        <div className="panel" key={g.id}>
          <div className="form-row">
            <input className="grow" value={g.name} onChange={(e) => save({ ...g, name: e.target.value })} />
            <button className="danger" onClick={() => dispatch({ type: 'remove', collection: 'groups', id: g.id })}>
              Borrar grupo
            </button>
          </div>
          <div className="checks">
            {data.teams.map((t) => {
              const type = data.activityTypes.find((a) => a.id === t.activityTypeId);
              return (
                <label key={t.id} className="check">
                  <input
                    type="checkbox"
                    checked={g.teamIds.includes(t.id)}
                    onChange={(e) =>
                      save({ ...g, teamIds: e.target.checked ? [...g.teamIds, t.id] : g.teamIds.filter((id) => id !== t.id) })
                    }
                  />
                  <span className="dot" style={{ background: type?.color }} />
                  {t.name}
                </label>
              );
            })}
            {data.teams.length === 0 && <span className="muted">Primero crea equipos.</span>}
          </div>
        </div>
      ))}
      <button onClick={() => save({ id: newId(), name: 'Nuevo grupo', teamIds: [] })}>+ Añadir grupo</button>
    </section>
  );
}
