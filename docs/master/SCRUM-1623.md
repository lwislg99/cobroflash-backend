# SCRUM-1623 · «Plan Equipo» no salía en la barra lateral (T2 de SCRUM-1402)

**Medido contra:** `origin/main` = `1608087e64aaa4b08c2877ee3119cc2fad97e02e` · 2026-10-27T16:44:15Z (hora del commit de `main`; cabecera `Date:` de GitHub al escribir esto: 2026-10-27T17:02:19Z)

**Skill UI:** cargada (yaqu-premium-ui) antes de tocar `public/`. Sin tokens, estilos ni componentes nuevos: una entrada más en un mapa de rótulos que ya existía.

A9: sin fallo que generalice — el defecto se reprodujo por ejecución antes de tocar nada, y la firma se leyó en su comentario de Jira, no en el resumen del registro de 1402.

Puesto S2, rama `scrum-1623-plan-equipo-barra-lateral`, worktree `s2-27oct-1623`. Carril: `node scripts/carriles.mjs de public/dashboard/js/app.js` → S2 (contenedor), `dos-equipos.md:150`.

## El defecto, por ejecución

`public/dashboard/js/app.js:184`: `planLabels` traía `trial`, `basic`, `pro` y `empresa`, sin `equipo`. El subtítulo de la tarjeta de usuario (`:187-189`) cae a `me.plan` en crudo, así que el dueño de una cuenta Equipo veía «equipo» bajo su nombre.

Rojo antes del arreglo (`tests/scrum1623-plan-equipo-en-la-barra.test.mjs`, 3 casos): cae ① con `actual: 'equipo'`, `expected: 'Plan Equipo'`; pasan los dos controles.

## La firma, en su fuente

SCRUM-1402 c.20845 (24-oct-2026, transcrita por el orquestador del equipo J): «**T2 FIRMADO (regla 39):** «Plan Equipo», en la barra lateral (`app.js:184/:188`, **S2**, Luis).» Cubre exactamente el texto puesto, sin una letra de más. El literal propuesto estaba en c.20838 (fila T2) y el cierre de 1402 (c.21077) lo deja como NO HECHO → SCRUM-1623.

## El arreglo

`app.js:184`: `equipo: 'Plan Equipo'` en `planLabels`, con la cita de c.20845 en la misma línea. En la misma línea a propósito: hay tests anclados a números de línea de `app.js`, y una línea nueva los movería sin motivo.

## El test

Saca por AST el tramo de `initApp` que pinta `#sidebar-user` (de `const initials` al `if (sidebarUser) {…}`), lo ejecuta en una caja de arena con un `me` y un `document` mínimos y lee el `innerHTML`. No copia ninguna línea de `app.js`.

- ① dueño con `plan: 'equipo'` → «Plan Equipo».
- ② control positivo: `pro` → «Plan Pro», `trial` → «Trial gratuito», sin cambios.
- ③ control: un operario de una cuenta Equipo sigue viendo «Operario · <negocio>».

Mutación: quitar la entrada `equipo` tumba ① (es el rojo de antes del arreglo).

## Dinero

`app.js` usa el plan SÓLO para este rótulo. `grep` de `.plan` en `public/dashboard/js/`: `app.js:188` (éste), `plansView.js` (J3, ya conoce `equipo` desde 1402k), `reportsView.js:944` (el embudo de plataforma, que pinta el plan en crudo para el fundador; sin cobro) y `quotesDetailView.js:1612-1631` (`m.plan` es el plan de MANTENIMIENTO, otra cosa). Nada de cobro cambia. La condición 0 de RUNBOOKS R27 (el portal de Stripe) es del fundador y no se toca aquí.

## Lo que se ve de paso y NO se arregla

- `founding` tampoco está en `planLabels`: el dueño de una cuenta del plan fundador ve «founding» en crudo. Es el mismo defecto, pero su literal no está firmado: se pasa al orquestador, sin texto propuesto aquí.
- `basic` y `empresa` no existen como planes (`src/core/entitlements.ts:25-29`). Quitarlos no lo pide nadie y no cambia lo que se ve; se dejan.

## Lo corrido

- `tests/scrum1623-plan-equipo-en-la-barra.test.mjs`: 3 de 3 tras el arreglo; 2 de 3 antes.
- Los que leen `app.js` más las familias 1402, 745, 237, 976, 811c (39 ficheros, concurrencia 2): 429 de 431 antes de escribir este registro; los 2 rojos eran 1340 y 976 ④, que exigen la línea `**Skill UI:**` de este fichero.
- Sin tanda entera: memoria libre 1.848 MB, por debajo del umbral de 2.200. El obligatorio lo dice el CI.
