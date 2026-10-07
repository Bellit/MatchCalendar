import { describe, expect, it } from 'vitest';
import { parseFcbqText } from './fcbqParser';
// Calendario real copiado de basquetcatala.cat (Canovelles BC 3, temporada 2026-27).
import fcbq from './__fixtures__/fcbq-canovelles-bc3.txt?raw';

describe('parseFcbqText — formato FCBQ real', () => {
  const m = parseFcbqText(fcbq);

  it('detecta todos los partidos con fecha y hora', () => {
    expect(m).toHaveLength(24);
    expect(m.every((x) => x.time)).toBe(true);
    expect(m.at(-1)).toMatchObject({ date: '2027-05-16', time: '18:00' });
  });

  it('separa equipos, categoría, pista y dirección', () => {
    expect(m[0]).toEqual({
      date: '2026-09-27',
      time: '19:20',
      title: 'UE SANT ANDREU B - CANOVELLES BC 3',
      venue: 'POLIESPORTIU CAMP DEL FERRO (C( PARE MANYANET 40)',
      notes: '3A. TERRITORIAL SÈNIOR MASCULÍ',
    });
    // Fila con "Informació Canvis" y nombre de equipo con guion.
    expect(m[4]).toMatchObject({
      date: '2026-10-25',
      time: '16:45',
      title: 'CANOVELLES BC 3 - LIMA-HORTA BÀSQUET',
      venue: 'PAVELLO MUNICIPAL TAGAMANENT (DIAGONAL, S/N)',
    });
    // Dirección con números que parecen un resultado ("7-11").
    expect(m[8].venue).toBe('INSTAL. ESPORT. ESCOLA THAU (EDUARD TOLDRA, 7-11)');
  });

  it('funciona si los tabuladores llegan convertidos en espacios', () => {
    const spaced = parseFcbqText(fcbq.replace(/\t/g, '    '));
    expect(spaced).toEqual(m);
  });
});

describe('parseFcbqText — modo genérico', () => {
  it('lee bloques multilínea y fechas sin hora', () => {
    const text = `Jornada 3
dissabte 18-10-26
CB A
CB B
Jornada 4
25-10-2026 10.15
CB C
CB D
Pista Escola Z`;
    const m = parseFcbqText(text);
    expect(m).toHaveLength(2);
    expect(m[0]).toMatchObject({ date: '2026-10-18', time: undefined, title: 'CB A - CB B' });
    expect(m[1]).toMatchObject({ date: '2026-10-25', time: '10:15', venue: 'Pista Escola Z' });
  });
});

describe('fechas imposibles', () => {
  it('ignora una fecha como 31/02 en lugar de guardarla desplazada', () => {
    const r = parseFcbqText('31/02/2026\n10:00\nPartido malo\n07/03/2026\n11:00\nPartido bueno');
    expect(r.map((m) => m.date)).toEqual(['2026-03-07']);
  });
});
