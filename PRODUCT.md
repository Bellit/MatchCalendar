# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

No hay un tipo de usuario privilegiado. Cualquiera que necesite saber si los partidos de varios equipos o actividades se pisan: coordinadores de club, familias con varios hijos compitiendo, jugadores que juegan en dos equipos o entrenadores. Cada persona añade solo los equipos que le interesan; la herramienta no distingue roles ni perfiles.

## Product Purpose

MatchCalendar compara los calendarios de varios equipos o actividades y avisa cuando alguien tendría que estar en dos sitios a la vez. El éxito es detectar una coincidencia antes de que ocurra y saber cuánto habría que mover un partido para evitarla.

Es una herramienta pública y gratuita, abierta a cualquiera.

## Positioning

No compara solo horas de inicio: cada actividad bloquea un tiempo (duración más margen para desplazarse), y una coincidencia es el solapamiento de esos bloques entre equipos del mismo grupo. A esto suma la importación directa del calendario copiado de la web de la FCBQ (basquetcatala.cat). Todo funciona sin cuentas ni servidor.

## Operating Context

- El usuario configura tipos de actividad (por defecto Baloncesto 3 h, Fútbol 3 h 30, Danza 5 h), crea equipos, añade partidos a mano o pegando la tabla de la FCBQ, y agrupa los equipos que no pueden coincidir.
- Las reimportaciones desde la FCBQ actualizan partidos existentes (p. ej. cambios de hora) en lugar de duplicarlos.
- Los partidos sin hora se guardan marcados como pendientes y no cuentan para las coincidencias.
- Se puede fijar un bloque de tiempo propio por equipo o por partido; si no, se usa el de la actividad.
- Cambiar la hora de un partido no depende del usuario: hay que solicitarlo antes a la federación. La app detecta y documenta las coincidencias, pero no mueve partidos. El resultado útil es un listado de coincidencias que se pueda imprimir o descargar (PDF) para redactar el correo de solicitud a la federación.
- Para usar los datos en otro dispositivo o compartirlos, se exporta/importa una copia desde la sección Datos.

## Capabilities and Constraints

- **Solo en el navegador (compromiso firme):** sin servidor, sin cuentas; los datos se guardan en el almacenamiento local del navegador y nunca se envían a ningún sitio. El trabajo futuro debe respetarlo.
- Aplicación web instalable (PWA) desplegada en GitHub Pages; React + Vite + TypeScript.
- Secciones actuales: Inicio, Actividades, Equipos (con importación FCBQ), Grupos, Coincidencias y Datos.
- Sincronización entre pestañas, validación y versionado de datos, deshacer borrados.
- Interfaz en castellano. Otros idiomas: sin decidir.
- Terminología del producto: *actividad*, *bloque de tiempo*, *equipo*, *grupo*, *coincidencia*, *partido pendiente de horario*.

## Brand Commitments

- Nombre: MatchCalendar.
- Logo e icono existentes en `public/` (`matchcalendar-logo.svg`, `matchcalendar-logo-dark.svg`, `matchcalendar-icon.svg` y PNG derivados).
- Voz: castellano cercano y directo, tuteando, con ejemplos concretos del mundo del deporte de base.

## Evidence on Hand

- Datos de ejemplo integrados (4 equipos, 2 grupos): `src/model/demo.ts`.
- Calendario real de la FCBQ usado como fixture de pruebas: `src/import/__fixtures__/fcbq-canovelles-bc3.txt`.
- No hay testimonios, cifras de uso, clubes usuarios ni prensa; no deben inventarse.

## Product Principles

1. **Privacidad por diseño:** los datos son del usuario y se quedan en su navegador.
2. **Sin barreras de entrada:** gratis, sin registro, útil desde el primer minuto (datos de ejemplo, pasos guiados).
3. **Reglas explicables:** el usuario debe entender por qué algo es una coincidencia y qué cambio la evitaría.
4. **Neutral respecto al rol:** sirve igual a un club, una familia o un jugador; nada en el flujo asume quién lo usa.
5. **Menos tecleo:** importar el calendario de la federación antes que pedir introducir partidos a mano.
