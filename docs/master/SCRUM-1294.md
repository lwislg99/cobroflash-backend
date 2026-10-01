# SCRUM-1294 · La A9 cierra el círculo, y CLAUDE.md la importa (piezas 1 y 2)

**Medido contra:** `origin/main` = `9911a2dcd809780d80dd117cc6314093f4c6d90f` · 2026-09-29T17:34:20Z
**Sesión:** s0-29a (S0). Encargo del orquestador, autorizado expresamente por el fundador.
`CLAUDE.md` es de un jefe (dos-equipos §3.3). La S0 lo prepara con esa autorización.

## Medición ANTES de construir (laboratorio, `claude -p` 2.1.284, canarios)

| qué | resultado |
|---|---|
| CLAUDE.md de 60.946 B / 689 líneas, canarios a 0, 20, 30 y 45 KB y al final | los 5 cargan: **no hay tope de 25 KB en CLAUDE.md** |
| `@importado.md` de 55 KB, canario al principio y al final | los 2 cargan: el import entra entero |
| MEMORY.md de 300 líneas cortas | se corta en la línea **200**, con un `WARNING: MEMORY.md is 300 lines (limit: 200)…` dentro del contexto |
| MEMORY.md de 45 KB / 155 líneas | se corta a **24,4 KB** («limit: 24.4KB»), también con WARNING |
| control negativo: regla con `paths:` que no casaba | NO sale: el modelo no inventa canarios |
| MEMORY.md real de este proyecto | 17.629 B / 95 líneas (72 % del tope de bytes). **Es por máquina**: el equipo de Javier no lo ve |
| CLAUDE.md real con el import, en una sesión arrancada en el worktree | cita la línea de la A9 y la última frase de A10: el import llega |

**Premisa del encargo tumbada:** el «25 KB / 200 líneas que se ignora en silencio» es el tope del
índice de la MEMORIA, no el de CLAUDE.md, y además avisa. Importar `00-normas-comunes.md` entero
(51 KB) funcionaría. No lo hago por coste: son ~51 KB en cada sesión y en cada turno. Importo solo
lo que tiene que llegar siempre (A9 + A10, 6 KB). Cambiarlo es una línea de CLAUDE.md, y lo decide un jefe.

🔴 **Límite que condiciona TODO esto:** CLAUDE.md, `.claude/settings.json` (los hooks) y `.claude/rules`
se cargan desde la carpeta donde ARRANCA la sesión. Las 17 sesiones vivas arrancan en el checkout
compartido (`claude agents --json`, campo `cwd`). Ese checkout va **1.026 commits** por detrás de main,
en la rama `scrum-1082…` desde el 22-sep. Este import no llega a nadie hasta que las sesiones arranquen
desde una carpeta al día. Lo lleva S5 (`sesion.mjs`), por decisión del orquestador.

## Qué se ha hecho

- `docs/equipo/00-normas-siempre.md` (nuevo): texto CANÓNICO de A9 (ampliada) y A10. En
  `00-normas-comunes.md`, A9 y A10 quedan como puntero de 4 líneas. El título de A9 no cambia
  (`norma.mjs` lo exige para el arranque).
- A9 ampliada (ver el añadido del fundador, abajo): cada registro lleva su línea `A9:`.
- A10: las frases que ocupaban dos líneas pasan a una por línea (texto igual). Así una lección es una
  línea comparable.
- `CLAUDE.md`: dos líneas de aviso y `@docs/equipo/00-normas-siempre.md`.
- Mecanismo: `tests/scrum1294-a9-leccion-en-a10.test.mjs` (check obligatorio):
  - todo tramo bajo un ancla fechada desde el **2026-09-30** sin línea `A9:` → ROJO;
  - toda lección que no esté LITERAL en A10 → ROJO;
  - CLAUDE.md sin el import (fuera de bloque de código) → ROJO;
  - el fichero por encima de 16 KB → ROJO.
  - Declara población. Hoy: 863 registros, 1.361 anclas, 0 desde el corte, 34 frases. Suelos: ≥ 800 registros y ≥ 1.000 anclas.
  - Control positivo: sabe fallar por tramo sin A9, por lección fuera de A10 y por «sin lección» sin motivo.

## Error propio

Escribí la expresión del ancla mirando UNA muestra (la de `ancla.mjs`). Reconocía 619 anclas de
1.361: las escritas a mano llevan huso, van sin segundos o sin `Z`. Lo cazó el suelo de población
del propio guard, no yo. Sin ese suelo, «0 desde el corte» habría sido un verde sobre media población.

Ya está convertido en comprobación: el suelo de anclas del propio guard. Queda también como cicatriz de
S0 (`docs/equipo/cicatrices/S0.md`).

A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

## Añadido del fundador (29-sep, por el orquestador): comprobación, no nota; cicatrices por puesto

- Principio, literal en CLAUDE.md y en la A9: **«Un fallo no se convierte en una nota. Se convierte en
  una COMPROBACIÓN. Si no se puede convertir, se dice que no se puede y se queda como aviso — pero sin
  fingir que apuntarlo lo arregla.»** Objetivo nombrado: que el mismo fallo no pueda ocurrir dos veces.
- La línea `A9:` tiene cuatro formas, por orden de preferencia: `comprobación → \`ruta\`` (la ruta tiene
  que existir), `aviso → A10 «…»`, `aviso → cicatriz <puesto> «…»` (los dos con motivo de por qué no se
  pudo comprobar) y `sin fallo que generalice — <por qué>`.
- `docs/equipo/cicatrices/<puesto>.md` para los 12 puestos de los dos equipos. Es aprendizaje, separado
  del traspaso (que es estado): cada cicatriz lleva su comprobación, o dice que no la tiene y por qué.
  El guard lo exige.
- Pendiente, en SCRUM-1295 (pieza 5): que la siguiente sesión del puesto reciba sus cicatrices SOLA al
  arrancar, por el hook de inicio. Hasta entonces, se leen a mano.
