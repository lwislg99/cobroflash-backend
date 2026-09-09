9-sep-2026 · medido sobre `origin/main = 0269e8cd24b6a393e23d05db6ac13307b4ac1c1d` · worktree `wt-verif5`

> Este documento nació con dos datos caducados en menos de una hora. Por eso lleva fecha y
> SHA en la primera línea, y por eso existe la norma A14.

# TRASPASO DEL ORQUESTADOR — estado al 9-sep-2026

Este documento es el ESTADO. `docs/equipo/orquestador.md` es el MÉTODO.
Y `docs/equipo/limites-del-fundador.md` son los LÍMITES: lo que el fundador decidió de viva
voz y no está escrito en ningún otro sitio. Se lee antes de mandar nada.
El método no caduca; esto sí. Si algo de aquí contradice a una medición de hoy,
gana la medición.

Medido sobre `origin/main = da5ac06ac169fca5d3692a63b10b01a6aed7d3d6`.

## 1 · LA COLA

**9-sep-2026: 16 PR mergeados en la semana, main en VERDE, CERO PR abiertos.**
El tapón que los frenaba era SCRUM-804, cerrado por Javier. Queda SCRUM-833
(`scrum637:164`) a 4 ramas de caer, con la misma forma.

El auto-borrado al mergear se llevó **~390 ramas**.

Los cuatro verdes que en su día NO mergeaban lo hacían por dos motivos DISTINTOS:

- **auto-merge ARMADO** por `yaqu-bot[bot]`, estado `dirty` → conflicto con main.
  El auto-merge espera para siempre, y hace bien.
- **auto-merge NO armado**: el workflow solo arma al recibir un push, y esas ramas
  no habían recibido ninguno desde que el workflow existe.

`scrum-automerge-rojo-falso` no tiene PR: la rama se empujo antes de que existiera
`pr-automatico.yml`.

## 2 · LAS DECISIONES VIVAS

| ticket | sesion | que falta |
|---|---|---|
| SCRUM-830 | S0 | Decidido: re-anclar SIN escribir ningun numero. Falta la frase de que vigilaba «la rama viva» |
| SCRUM-829 | S3 | Bajado de rojo. La premisa era falsa. Sigue vivo el parseo divergente de las dos reglas |
| SCRUM-831 | S4 | Albaranes. Decide ella la escalera; microcopy nueva la firma el fundador |
| SCRUM-832 | S2 | Las tres decisiones ya estan escritas en el ticket (URL, id inexistente, tenencia) |
| SCRUM-827 | sin asignar | Trinquete del IVA por NOMBRE+VALOR. Reemplaza a SCRUM-706 |
| SCRUM-828 | sin asignar | Mergeado el arreglo, ticket sin cerrar |

## 3 · LO QUE ESPERA A JAVIER

Regla de la casa: **① decision → ② ALTER aditivo en las TRES bases → ③ un solo PR.
NUNCA ③ sin ②.**

**SCRUM-729.** Los ALTER están **APLICADOS y verificados en producción y staging**.
Lo que falta es el **ESCRITOR**, que es camino de emisión y va aparte.

**SCRUM-815** — tabla `gateway_events` con `@@unique([provider, event_id])` y DOS
timestamps. **Lo aplica Javier el lunes.** El banco que reproduce las dos mitades del
fallo se puede construir hoy; el arreglo no.

## 4 · LOS TRECE ERRORES DEL ORQUESTADOR

> **El orquestador no mide: le cuentan.** Todo lo que escriba como HECHO sobre el
> codigo pasa por una medicion antes, o se escribe como PREGUNTA.

| lo que afirmo | lo que era |
|---|---|
| «171 llamadas a git» | 71 — conto texto, no AST |
| «cuatro sitios del atajo» | seis |
| «el NIF se imprime en la factura» | no se imprime |
| SCRUM-724, los 44 px | no existia; lo habia decidido SCRUM-352 |
| SCRUM-822, «main esta rojo» | main estaba verde |
| «la tabla ocupa 730 px» | 978 |
| «faltan los objetivos tactiles» | ya hechos en SCRUM-720d |
| «el auto-merge falla por el conflicto» | eran permisos |
| «Jira no funciona en Visual» | si funciona |
| mando mergear PR ya mergeados | leyo una captura como estado actual |
| «Presupuestos no usa el router y por eso falla el atras» | las CINCO listas fallan; la causa es `HASH_VIEWS` sin los `*-detail` |
| tomo por actual un informe ya usado | nada en el informe decia cuando se midio → norma A14 |
| «RTT a la base = 175 ms» | era la latencia de la MÁQUINA QUE MIDIÓ, desde España; las dos regiones están en US West. El control de los 880 ms arrastraba el mismo sesgo. Casi lleva a mover la base a Netherlands, poniendo 9.000 km entre la app y su base. **Lo paró Javier midiendo.** |

## 5 · QUIEN ES QUIEN, Y QUE FICHEROS TOCA

| sesion | carril | ticket hoy | ficheros suyos |
|---|---|---|---|
| S0 | auditoria / head | SCRUM-830 | `scripts/verificacion-s5/`, `_censo-alcanzabilidad.mjs`, `docs/equipo/` |
| S1 | backend / fiscal | SCRUM-729 | `src/modules/invoicing/`, `invoiceNumber.service.ts` |
| S2 | frontend | SCRUM-832 | `public/dashboard/js/`, `app.js`, `styles.css` |
| S3 | tests / instrumentacion | SCRUM-829 | `tests/`, `scripts/_suelo-contra-main.mjs` |
| S4 | producto / diseño | SCRUM-831 | `jobsView.js`, `jobNextAction.js`, vistas de lista |
| S5 | automatizacion | auto-update de ramas | `.github/workflows/` |

Codex: cerrada.

## 6 · LA REGLA DEL WORKTREE DEL JEFE

> El worktree del orquestador es de **SOLO LECTURA**. Lee, mide, corre guards, abre
> runs de CI, consulta Jira. **NUNCA hace commit de codigo de producto.** Lo unico
> que escribe es `docs/equipo/`. Si necesita un cambio en el producto, lo **ENCARGA**.

Motivo: un jefe que puede arreglar las cosas el mismo deja de ser jefe en tres dias.
Entonces hay siete programadores y ningun orquestador.

## 7 · LAS NORMAS QUE NO ESTABAN EN orquestador.md

- **A12** · Antes de cambiar una POBLACION (ramas, ficheros, tablas, filas), se censa
  que guards miden sobre ella. Un barrido correcto que rompe main sigue rompiendo main.
- **A13** · Nada mas coger un ticket: EN CURSO + ASIGNADO A LUIS en Jira. Antes de la
  primera linea de codigo.
- **A14** · Todo informe empieza con la FECHA Y HORA de la medicion y el SHA de
  `origin/main` sobre el que se midio.
