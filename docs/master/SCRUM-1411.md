# SCRUM-1411 · `dos-equipos.md` §3.1 y §3.2 las lee un guard del otro equipo: la dependencia, escrita

**Medido contra:** `origin/main` = `5d7aaebc41d71d24102a4852c1de04059d9ac559` · 2026-10-02T11:22:35Z

A9: aviso → A10 «Una prohibición sin mecanismo es una frase.» — no se pudo comprobar: el mecanismo que avisa al que cambie el formato ya existe y es el propio `scrum514` (su caso «SUELO: las tablas de propiedad…»); lo que faltaba era que quien edita el documento lo supiera ANTES de empujar, y eso es una frase junto a las tablas, no una comprobación nueva.

Carril S0 (`docs/equipo/dos-equipos.md`). Solo `docs/`.

## Qué había

`tests/scrum514-aprobado-y-aplicado.test.mjs` (equipo de Javier, SCRUM-1334) lee las tablas §3.1 y §3.2 con
`filasDePropiedad` para saber de qué puesto es cada fichero. El guard nombra al documento; el documento no
nombraba al guard. Nos avisó su equipo.

## Qué entra

Una nota justo encima de §3.1 que dice quién las lee, qué partes del formato lee y que no se cambian sin
avisar por Jira. La nota va FUERA del tramo que el guard recorta y no escribe los títulos de sección con
sus almohadillas, para no ser ella la que mueva el corte.

## La aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| `docs/equipo/dos-equipos.md` dice, junto a las tablas §3.1 y §3.2, que un guard del otro equipo las parsea, cuál es, qué partes del formato lee, y que el formato no se cambia sin avisar por Jira (§5). | `docs/equipo/dos-equipos.md` (la cita marcada con 🔴 encima de §3.1) |
| No se cambia ninguna fila ni el formato de las tablas: `tests/scrum514-aprobado-y-aplicado.test.mjs` sigue leyendo las mismas filas antes y después (recuento escrito en el registro). | aquí abajo: 29 filas y la misma huella antes y después |
| No se toca el guard `scrum514` (es del equipo de Javier). | el diff del PR: dos ficheros, los dos en `docs/` |

## Medido

Con una copia literal de `filasDePropiedad` sobre el documento, antes y después del cambio:

| | filas con dueño | huella de las filas (sha256, 16 primeros) |
|---|---|---|
| antes (`origin/main`) | 29 | `7c5f3a5d82bf6ecd` |
| después | 29 | `7c5f3a5d82bf6ecd` |

**Una discrepancia que no es mía y dejo dicha:** el mensaje del guard dice «el 2-oct-2026 eran 33». Con su
misma función yo cuento 29. El suelo es 25, así que la holgura real es de 4 filas y no de 8. No sé de dónde
sale el 33; no he tocado el guard. Se lo paso al orquestador para el equipo de Javier.

## Mis errores

Ninguno propio que haya visto en este cambio. Lo que no he mirado: si hay OTROS guards del equipo de Javier
que lean otros ficheros de la S0 sin que el fichero lo diga. `git grep` de `dos-equipos.md` en `tests/` y
`scripts/` da cuatro ficheros; solo he leído cómo lo usa `scrum514`.

## Añadido tras el merge (2-oct, rama `scrum-1372c-a10-y-notas-de-registro`)

#2138 entró en `main` a las 11:39Z con el obligatorio en verde. **El `meta-guard` salió ROJO en este PR,
que solo toca `docs/`**, en el paso «Cada guard cae con la mutación que declara». No lo he diagnosticado.
Lo que sí medí: de los seis últimos PR mergeados con veredicto de ese check, tres lo traen rojo (#2132,
#2135, #2138) y tres verde (#2137, #2139, #2140). Es informativo y no bloquea, pero un guard que se pone
rojo con un cambio de documentación entrena a ignorarlo.