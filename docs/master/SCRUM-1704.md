# SCRUM-1704 · PILOTO-1 · «Agendar» propone el siguiente día laborable a las 9:00

**Medido contra:** `origin/main` = `81f5795355200112e4d79feb4ec472b252ea243b` · 2026-11-11T16:52:14Z (cabecera `Date:` de `gh api -i zen`) · **Rama:** `scrum-1704-agendar-propone-laborable` · **Carril:** S2.

**Skill UI:** cargada (`yaqu-premium-ui`; AB6: sin componente, clase, token, CSS ni texto nuevos. Sólo se rellena el `value` del `datetime-local` que ya existía)

A9: comprobación → `tests/scrum1704-agendar-propone-laborable.test.mjs`

## Origen y decisión

Cierre de SCRUM-1681 (c.21500): «Agendar» abría con «Fecha y hora» vacía y el piloto elegía día, mes, año y
hora desde cero en el selector nativo. **Decisión del orquestador** (SCRUM-1704 c.21502, bajo la delegación):
se propone el **siguiente día laborable a las 9:00**, en la hora local del navegador. Se puede cambiar; no crea
estado ni texto. Al reagendar manda la fecha guardada. Mientras no se pulse «Agendar», no se escribe nada.

## Qué cambia

`public/dashboard/js/jobAgendar.js`: función pura `propuestaDeAgenda(ahora)` (publicada en `window`) y, en
`abrirAgendarTrabajo`, si el trabajo NO tiene `scheduledAt`, el campo arranca con ella.

- **Laborable** = de lunes a viernes. Los festivos no se conocen en el navegador y no se adivinan (un lunes
  festivo se propone igual; se cambia a mano). **Siguiente** = a partir de mañana: viernes, sábado y domingo
  proponen el lunes.
- **Hora local:** el valor se arma con los campos LOCALES de la fecha (`new Date(año, mes, día + 1, 9)`), sin
  pasar por UTC, así que cae en la misma hora local que pinta el reagendar (que llega al mismo sitio por
  `getTimezoneOffset`). A las 9:00 no hay cambio de hora de verano que la salte.
- **Reagendar:** la rama de `scheduledAt` no se toca.
- **Proponer no es guardar:** abrir y «Cancelar» no llaman al `patch`; sólo «Agendar» lo hace, con el valor
  del campo, igual que antes.

## Comprobación

- **Test** (banco de vistas, `jobAgendar.js` real): la propuesta de lunes a domingo, con cambio de mes y año
  (31-dic-2027 → 3-ene-2028) y bisiesto (28-feb-2028 → 29-feb) · «Agendar» sin fecha abre con la propuesta ·
  «Reagendar» abre con la guardada · abrir y cancelar no escribe · «Agendar» manda la propuesta como
  `scheduledAt`. 12/12 ✔; con SCRUM-1415 (nombres de `test()` escritos, sin `for`): 18/18 ✔.
- **Rojo por mutación:** sin propuesta (2 ✖) · fines de semana admitidos (3 ✖) · hoy en vez de mañana (6 ✖) ·
  la propuesta pisa la fecha guardada (1 ✖). Cuatro de cuatro, restaurado.
- **Tanda** de los 289 ficheros que leen `jobAgendar.js`, el banco de vistas o los censos de `public/`:
  2323 ✔ · 2 ✖ · 5 saltados. Los dos ✖ son SCRUM-1199, los mismos dos que el registro de SCRUM-1701 declara
  de entorno en este equipo (no tocan nada de este ticket).
- **En yaqu.app:** pendiente del merge (390 y 1280, cuenta QA, un trabajo `pendiente_agendar` y uno
  `agendado`, sonda sólo GET: abrir y cancelar).
