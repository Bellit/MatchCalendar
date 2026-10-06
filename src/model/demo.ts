import { DEFAULT_DATA, type AppData, type CalendarEvent } from './types';

/** Datos de ejemplo con fechas a partir de la próxima semana, con algunas coincidencias a propósito. */
export function buildDemoData(): AppData {
  const base = new Date();
  // Próximo sábado.
  base.setDate(base.getDate() + ((6 - base.getDay() + 7) % 7 || 7));
  const day = (weeks: number, offset: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + weeks * 7 + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  let n = 0;
  const ev = (teamId: string, date: string, time: string, title: string, venue: string): CalendarEvent => ({
    id: `demo-${n++}`,
    teamId,
    date,
    time,
    title,
    venue,
  });

  return {
    activityTypes: DEFAULT_DATA.activityTypes,
    teams: [
      { id: 'demo-junior', name: 'Junior A (ejemplo)', activityTypeId: 'basket' },
      { id: 'demo-senior', name: 'Sénior 1ª (ejemplo)', activityTypeId: 'basket' },
      { id: 'demo-futbol', name: 'Fútbol infantil (ejemplo)', activityTypeId: 'futbol' },
      { id: 'demo-danza', name: 'Danza (ejemplo)', activityTypeId: 'danza' },
    ],
    groups: [
      { id: 'demo-g1', name: 'Junior que juegan en Sénior', teamIds: ['demo-junior', 'demo-senior'] },
      { id: 'demo-g2', name: 'Familia García', teamIds: ['demo-junior', 'demo-futbol', 'demo-danza'] },
    ],
    events: [
      // Semana 0: el Sénior empieza 1h30 después del Junior → coincidencia.
      ev('demo-junior', day(0, 0), '10:00', 'Junior A - CB Rival', 'Pavelló Municipal'),
      ev('demo-senior', day(0, 0), '11:30', 'CB Visitant - Sénior 1ª', 'Poliesportiu Nord'),
      ev('demo-futbol', day(0, 1), '09:30', 'Fútbol infantil - UD Barrio', 'Camp Municipal'),
      // Semana 1: justo 3h de diferencia → sin coincidencia.
      ev('demo-junior', day(1, 0), '16:00', 'CB Altres - Junior A', 'Pavelló Est'),
      ev('demo-senior', day(1, 0), '19:00', 'Sénior 1ª - CB Ciutat', 'Pavelló Municipal'),
      ev('demo-danza', day(1, 1), '09:00', 'Competición regional', 'Teatre Municipal'),
      // Semana 2: danza (5h) pisa el partido del Junior; fútbol también.
      ev('demo-danza', day(2, 0), '09:00', 'Campeonato provincial', 'Palau dels Esports'),
      ev('demo-junior', day(2, 0), '12:30', 'Junior A - CB Muntanya', 'Pavelló Municipal'),
      ev('demo-futbol', day(2, 0), '11:00', 'CF Riera - Fútbol infantil', 'Camp de la Riera'),
      ev('demo-senior', day(2, 1), '18:00', 'Sénior 1ª - CB Port', 'Pavelló Municipal'),
      // Semana 3: sin problemas.
      ev('demo-junior', day(3, 0), '10:00', 'Junior A - CB Vila', 'Pavelló Municipal'),
      ev('demo-senior', day(3, 1), '12:00', 'CB Costa - Sénior 1ª', 'Pavelló Costa'),
      ev('demo-futbol', day(3, 0), '17:00', 'Fútbol infantil - CE Mar', 'Camp Municipal'),
    ],
  };
}
