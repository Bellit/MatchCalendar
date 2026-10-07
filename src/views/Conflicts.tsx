import { useMemo, useState } from 'react';
import { blockMinutesFor, findConflicts, inRange, startMinutes, type Conflict, type DateRange } from '../logic/conflicts';
import { useStore } from '../model/store';
import { formatMinutes, type AppData, type CalendarEvent, type Group } from '../model/types';
import { EmptyState, Icon, inkOn, formatDateLong, formatDateShort, localToday, useUi } from '../ui';

type Preset = 'upcoming' | 'month' | 'all' | 'custom';

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Minutos desde medianoche → "HH:MM" (y "+1 día" si pasa de medianoche). */
function clock(min: number, baseDay: number): string {
  const day = Math.floor(min / 1440);
  const m = ((min % 1440) + 1440) % 1440;
  const s = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return day > baseDay ? `${s} (día siguiente)` : day < baseDay ? `${s} (día anterior)` : s;
}

const PRESETS: [Preset, string][] = [
  ['upcoming', 'Próximos'],
  ['month', 'Próximos 30 días'],
  ['all', 'Toda la temporada'],
  ['custom', 'Entre fechas…'],
];

/** Una misma pareja de partidos puede chocar en varios grupos: se cuenta una vez. */
function pairKey(c: Conflict): string {
  return [c.a.id, c.b.id].sort().join('|');
}

/** Qué hora tendría que tener cada partido para que los bloques no se pisen. */
function advice(c: Conflict, data: AppData) {
  const aStart = startMinutes(c.a)!;
  const bStart = startMinutes(c.b)!;
  const day = Math.floor(aStart / 1440);
  return {
    aTeam: data.teams.find((t) => t.id === c.a.teamId)?.name ?? '',
    bTeam: data.teams.find((t) => t.id === c.b.teamId)?.name ?? '',
    bFrom: clock(aStart + blockMinutesFor(c.a, data), day),
    aBy: clock(bStart - blockMinutesFor(c.a, data), day),
  };
}

export default function Conflicts() {
  const { data } = useStore();
  const { go, toast } = useUi();
  const [groupId, setGroupId] = useState<string>('all');
  const [preset, setPreset] = useState<Preset>('upcoming');
  const [from, setFrom] = useState(localToday());
  const [to, setTo] = useState('');
  const [view, setView] = useState<'list' | 'agenda'>('list');

  const range: DateRange = useMemo(() => {
    const today = localToday();
    if (preset === 'upcoming') return { from: today };
    if (preset === 'month') return { from: today, to: addDays(today, 30) };
    if (preset === 'all') return {};
    return { from: from || undefined, to: to || undefined };
  }, [preset, from, to]);

  const groups = groupId === 'all' ? data.groups : data.groups.filter((g) => g.id === groupId);
  const results = useMemo(() => groups.map((g) => ({ group: g, conflicts: findConflicts(g, data, range) })), [data, groupId, range]);
  const all = results.flatMap((r) => r.conflicts);
  const total = new Set(all.map(pairKey)).size;
  const affected = results.filter((r) => r.conflicts.length).length;
  const next = all.map((c) => c.a.date).sort()[0];

  if (data.groups.length === 0) {
    const ready = data.teams.length >= 2;
    return (
      <div className="card">
        <EmptyState icon="link" title="Aún no hay nada que comparar">
          <p>
            {ready
              ? 'Ya tienes equipos. Ahora crea un grupo con los equipos que no pueden coincidir.'
              : 'Primero crea al menos dos equipos con sus partidos y después agrúpalos.'}
          </p>
          <div className="toolbar center">
            <button className="primary" onClick={() => go(ready ? 'groups' : 'teams')}>
              {ready ? 'Crear un grupo' : 'Ir a equipos'}
            </button>
            <button onClick={() => go('home')}>Ver cómo funciona</button>
          </div>
        </EmptyState>
      </div>
    );
  }

  const periodText =
    preset === 'custom'
      ? from && to
        ? `del ${formatDateShort(from)} al ${formatDateShort(to)}`
        : from
          ? `desde el ${formatDateShort(from)}`
          : to
            ? `hasta el ${formatDateShort(to)}`
            : 'toda la temporada'
      : PRESETS.find(([id]) => id === preset)![1].toLowerCase();
  const scope = `${groupId === 'all' ? 'Todos los grupos' : groups[0]?.name} · ${periodText}`;

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(conflictsAsText(results, data, scope));
      toast('Listado copiado: pégalo en el correo a la federación');
    } catch {
      toast('No se ha podido copiar. Usa «Imprimir / PDF».');
    }
  };

  return (
    <>
      <div className="screen-only">
        <header className="page-head">
          <h1>Coincidencias</h1>
          <div className="page-actions">
            <button onClick={copyText} disabled={!total} title="Texto para pegar en un correo">
              Copiar texto
            </button>
            <button className="primary" onClick={() => window.print()} disabled={!total} title="Listado para imprimir o guardar como PDF">
              Imprimir / PDF
            </button>
          </div>
        </header>

        <div className={'stats scoreboard' + (total ? '' : ' clear')} aria-live="polite">
          <div className={'stat ' + (total ? 'bad' : 'ok')}>
            <span className="stat-value">{total}</span>
            <span className="stat-label">{total === 1 ? 'coincidencia' : total ? 'coincidencias' : 'coincidencias · todo cuadra'}</span>
          </div>
          <div className="stat">
            <span className="stat-value">
              {affected}/{groups.length}
            </span>
            <span className="stat-label">grupos afectados</span>
          </div>
          <div className="stat">
            <span className="stat-value small">{next ? formatDateShort(next) : '—'}</span>
            <span className="stat-label">próxima coincidencia</span>
          </div>
        </div>

        <div className="filterbar">
          <label className="field">
            <span>Grupo</span>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="all">Todos los grupos</option>
              {data.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Periodo</span>
            <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
              {PRESETS.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {preset === 'custom' && (
            <>
              <label className="field">
                <span>Desde</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="field">
                <span>Hasta</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
            </>
          )}
          <div className="field push">
            <span id="view-label">Vista</span>
            <div className="seg" role="group" aria-labelledby="view-label">
              <button className={view === 'list' ? 'active' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}>
                Lista
              </button>
              <button className={view === 'agenda' ? 'active' : ''} aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}>
                Agenda
              </button>
            </div>
          </div>
        </div>

        {results.map(({ group, conflicts }) => (
          <section key={group.id} className="card">
            <div className="card-head">
              <h2>{group.name}</h2>
              <span className={'pill ' + (conflicts.length ? 'bad' : 'ok')}>
                {conflicts.length ? `${conflicts.length} ${conflicts.length === 1 ? 'coincidencia' : 'coincidencias'}` : 'Sin coincidencias'}
              </span>
            </div>
            {group.teamIds.length < 2 ? (
              <p className="notice warn">
                Este grupo tiene menos de dos equipos.{' '}
                <button className="link" onClick={() => go('groups')}>
                  Añadir equipos al grupo
                </button>
              </p>
            ) : view === 'list' ? (
              <ConflictList conflicts={conflicts} data={data} />
            ) : (
              <Agenda group={group} conflicts={conflicts} data={data} range={range} />
            )}
          </section>
        ))}
      </div>

      {total > 0 && <PrintReport results={results} data={data} scope={scope} />}
    </>
  );
}

type Results = { group: Group; conflicts: Conflict[] }[];

function eventLine(ev: CalendarEvent, data: AppData): string {
  const team = data.teams.find((t) => t.id === ev.teamId)?.name ?? '';
  const extra = [ev.title, ev.venue].filter(Boolean).join(', ');
  return `${team} a las ${ev.time}${extra ? ` (${extra})` : ''}`;
}

/** Texto plano para pegar en el correo de solicitud a la federación. */
function conflictsAsText(results: Results, data: AppData, scope: string): string {
  const lines = [`Coincidencias de calendario (${scope})`, ''];
  for (const { group, conflicts } of results) {
    if (!conflicts.length) continue;
    lines.push(`${group.name}:`);
    for (const c of conflicts) {
      const ad = advice(c, data);
      lines.push(
        `- ${formatDateLong(c.a.date)}: ${eventLine(c.a, data)} y ${eventLine(c.b, data)}. Se pisan ${formatMinutes(c.overlapMinutes)}. ` +
          `Para evitarlo, ${ad.bTeam} debería empezar a las ${ad.bFrom} o más tarde, o ${ad.aTeam} a las ${ad.aBy} o antes.`,
      );
    }
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}

/** Listado solo para imprimir o guardar como PDF (oculto en pantalla). */
function PrintReport({ results, data, scope }: { results: Results; data: AppData; scope: string }) {
  return (
    <section className="print-report">
      <h1>Coincidencias de calendario</h1>
      <p className="print-meta">
        {scope} · Generado el {formatDateLong(localToday())} con MatchCalendar
      </p>
      {results
        .filter((r) => r.conflicts.length)
        .map(({ group, conflicts }) => (
          <section key={group.id} className="print-group">
            <h2>{group.name}</h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Partido</th>
                  <th>Coincide con</th>
                  <th>Se pisan</th>
                  <th>Para evitarlo</th>
                </tr>
              </thead>
              <tbody>
                {conflicts.map((c) => {
                  const ad = advice(c, data);
                  return (
                    <tr key={c.a.id + c.b.id}>
                      <td className="nowrap">{formatDateShort(c.a.date)}</td>
                      <td>
                        <PrintEvent ev={c.a} data={data} />
                      </td>
                      <td>
                        <PrintEvent ev={c.b} data={data} />
                      </td>
                      <td className="nowrap">{formatMinutes(c.overlapMinutes)}</td>
                      <td>
                        {ad.bTeam} a las {ad.bFrom} o más tarde, o {ad.aTeam} a las {ad.aBy} o antes
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
    </section>
  );
}

function PrintEvent({ ev, data }: { ev: CalendarEvent; data: AppData }) {
  const team = data.teams.find((t) => t.id === ev.teamId)?.name;
  return (
    <>
      <b>{team}</b> · {ev.time} <span className="print-muted">(bloque {formatMinutes(blockMinutesFor(ev, data))})</span>
      {ev.title && <div>{ev.title}</div>}
      {ev.venue && <div className="print-muted">{ev.venue}</div>}
    </>
  );
}

function TeamLink({ teamId, data }: { teamId: string; data: AppData }) {
  const { go } = useUi();
  const team = data.teams.find((t) => t.id === teamId);
  const type = data.activityTypes.find((a) => a.id === team?.activityTypeId);
  return (
    <button className="link team-link" onClick={() => go('teams', { teamId })} title="Ver los partidos de este equipo">
      <span className="dot" style={{ background: type?.color }} />
      {team?.name}
    </button>
  );
}

function EventCard({ ev, data }: { ev: CalendarEvent; data: AppData }) {
  const start = startMinutes(ev)!;
  const block = blockMinutesFor(ev, data);
  const baseDay = Math.floor(start / 1440);
  return (
    <div className="event-card">
      <TeamLink teamId={ev.teamId} data={data} />
      <div className="event-time">
        <b>{ev.time}</b> → {clock(start + block, baseDay)} <span className="muted">({formatMinutes(block)})</span>
      </div>
      {ev.title && <div>{ev.title}</div>}
      {ev.venue && (
        <div className="muted with-icon">
          <Icon name="pin" size={15} /> {ev.venue}
        </div>
      )}
    </div>
  );
}

function ConflictList({ conflicts, data }: { conflicts: Conflict[]; data: AppData }) {
  if (conflicts.length === 0) return <p className="all-clear">Ningún partido se pisa en este periodo.</p>;
  const byDate = new Map<string, Conflict[]>();
  for (const c of conflicts) byDate.set(c.a.date, [...(byDate.get(c.a.date) ?? []), c]);
  return (
    <>
      {[...byDate].map(([date, cs]) => (
        <div key={date} className="day">
          <h3 className="day-title">{formatDateLong(date)}</h3>
          {cs.map((c) => {
            const ad = advice(c, data);
            return (
              <article key={c.a.id + c.b.id} className="conflict">
                <div className="conflict-pair">
                  <EventCard ev={c.a} data={data} />
                  <div className="overlap">
                    <b>{formatMinutes(c.overlapMinutes)}</b>
                    <span>se pisan</span>
                  </div>
                  <EventCard ev={c.b} data={data} />
                </div>
                <p className="suggestion">
                  Para evitarlo: <b>{ad.bTeam}</b> debería empezar a las <b>{ad.bFrom}</b> o más tarde, o <b>{ad.aTeam}</b> a las{' '}
                  <b>{ad.aBy}</b> o antes.
                </p>
              </article>
            );
          })}
        </div>
      ))}
    </>
  );
}

const DAY_START = 8 * 60;
const DAY_END = 24 * 60;

function Agenda({ group, conflicts, data, range }: { group: Group; conflicts: Conflict[]; data: AppData; range: DateRange }) {
  const [onlyConflicts, setOnlyConflicts] = useState(conflicts.length > 0);
  const conflictIds = new Set(conflicts.flatMap((c) => [c.a.id, c.b.id]));
  const events = data.events.filter((e) => group.teamIds.includes(e.teamId) && e.time && inRange(e.date, range));
  const days = [...new Set(events.map((e) => e.date))]
    .sort()
    .filter((d) => !onlyConflicts || events.some((e) => e.date === d && conflictIds.has(e.id)));
  const hours = Array.from({ length: (DAY_END - DAY_START) / 120 + 1 }, (_, i) => DAY_START / 60 + i * 2);
  const pct = (min: number) => `${((Math.max(DAY_START, Math.min(DAY_END, min)) - DAY_START) / (DAY_END - DAY_START)) * 100}%`;

  return (
    <>
      <div className="agenda-tools">
        <label className="check">
          <input type="checkbox" checked={onlyConflicts} onChange={(e) => setOnlyConflicts(e.target.checked)} />
          Solo días con coincidencias
        </label>
        <div className="legend">
          {group.teamIds.map((id) => (
            <TeamLink key={id} teamId={id} data={data} />
          ))}
        </div>
      </div>
      <div className="table-wrap">
        <div className="agenda">
          <div className="agenda-row agenda-head">
            <div className="agenda-label" />
            <div className="agenda-track">
              {hours.map((h) => (
                <span key={h} className="tick" style={{ left: pct(h * 60) }}>
                  {h}h
                </span>
              ))}
            </div>
          </div>
          {days.map((d) => {
            const dayEvents = events.filter((e) => e.date === d).sort((a, b) => a.time!.localeCompare(b.time!));
            const hasConflict = dayEvents.some((e) => conflictIds.has(e.id));
            return (
              <div key={d} className={'agenda-row' + (hasConflict ? ' has-conflict' : '')}>
                <div className="agenda-label">{formatDateShort(d)}</div>
                {/* Las barras son visuales; los lectores de pantalla reciben la misma información como lista. */}
                <ul className="sr-only">
                  {dayEvents.map((ev) => {
                    const team = data.teams.find((t) => t.id === ev.teamId);
                    return (
                      <li key={ev.id}>
                        {ev.time}, {team?.name}
                        {ev.title ? `, ${ev.title}` : ''}, bloque de {formatMinutes(blockMinutesFor(ev, data))}
                        {conflictIds.has(ev.id) ? '. Coincide con otro partido.' : ''}
                      </li>
                    );
                  })}
                </ul>
                <div className="agenda-track" aria-hidden style={{ height: `${Math.max(1, dayEvents.length) * 28 + 8}px` }}>
                  {hours.map((h) => (
                    <span key={h} className="grid" style={{ left: pct(h * 60) }} />
                  ))}
                  {dayEvents.map((ev, i) => {
                    const team = data.teams.find((t) => t.id === ev.teamId);
                    const type = data.activityTypes.find((a) => a.id === team?.activityTypeId);
                    const [hh, mm] = ev.time!.split(':').map(Number);
                    const s = hh * 60 + mm;
                    const e = s + blockMinutesFor(ev, data);
                    return (
                      <div
                        key={ev.id}
                        className={'bar' + (conflictIds.has(ev.id) ? ' conflict-bar' : '')}
                        style={{ left: pct(s), width: `calc(${pct(e)} - ${pct(s)})`, top: i * 28 + 4, background: type?.color, color: inkOn(type?.color) }}
                        title={`${ev.time} · ${team?.name} · ${ev.title} (bloque ${formatMinutes(e - s)})`}
                      >
                        {ev.time} {team?.name}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {days.length === 0 && <p className="muted pad">No hay partidos con hora en este periodo.</p>}
        </div>
      </div>
    </>
  );
}
