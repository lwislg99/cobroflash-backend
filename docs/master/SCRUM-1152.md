# SCRUM-1152 · Generador del ancla de medición (SCRUM-267)

**Fecha:** 26-sep-2026 12:19Z (GitHub) · **Carril:** S5 · automatización y eficiencia
**Medido contra:** `origin/main` = `305666c5c6a87d1bd9ed374099cadc3f99796305` · 2026-09-26T12:19:57Z
**Rama:** `scrum-1152-generador-ancla`

> Esta misma línea de arriba salió de `node scripts/equipo/ancla.mjs` — el control positivo más
> directo que existe: si el generador no funcionara, este registro no llevaría un ancla válida.

## 0 · El encargo, en una línea

El ancla de SCRUM-267 (`**Medido contra:** \`origin/main\` = \`<sha40>\` · <ISO-8601>`) tumbó
**cinco veces en dos días** (#1793, #1795, S2, y dos veces esta misma sesión en el mismo turno),
siempre por el mismo motivo: es un dato de dos partes que se teclea a mano, y es fácil escribir
una sin la otra. Encargo directo del orquestador `cobroflash-backend-06`.

## 1 · Qué se construyó

`scripts/equipo/ancla.mjs` (nuevo). `node scripts/equipo/ancla.mjs` imprime la línea completa:

- El **sha**: `git rev-parse origin/main`, local — no fetchea por ti (fetchear es una decisión de
  red de quien lo llama, no de un generador de texto).
- El **instante**: la cabecera `Date:` de `gh api -i zen` (A14) — nunca el reloj de la máquina.
  Prueba `gh` del PATH y, si no existe (ENOENT), la ruta fija de esta máquina
  (`C:\Program Files\GitHub CLI\gh.exe`, SCRUM-360). Un `gh` que existe pero responde mal (status
  ≠ 0) **no** prueba otro binario ni rellena con el reloj local: falla cerrado.
- Si cualquiera de los dos datos no se puede leer, sale `NO PUDE MIRAR` con código 2 — nunca
  imprime un ancla a medias.

También se enlaza el generador desde los dos sitios donde alguien se topa con el problema:

- El mensaje de la aserción de `tests/scrum267-ancla-de-medicion.test.mjs` (la que hoy dice «HAY
  ENTRADAS SIN ANCLA») ahora dice también `node scripts/equipo/ancla.mjs`.
- `docs/master/README.md`, en la sección "El ancla de medición" y en la plantilla de apéndice.

## 2 · Lo que NO se tocó

El `RE_ANCLA` y el resto del guard de SCRUM-267: sin cambios. Esto es un generador que apunta al
mismo contrato que ya existía, no un guard nuevo ni uno relajado.

## 3 · Verificación

- `tests/scrum1152-generador-ancla.test.mjs` (8 casos): camino feliz con el `RE_ANCLA` REAL
  importado del propio guard (no una copia del patrón); fallback entre binarios de `gh` cuando el
  primero da ENOENT; fail-closed cuando ninguno responde, cuando uno responde pero falla de
  verdad, cuando el sha no tiene 40 hex, cuando `git rev-parse` falla, y cuando la cabecera `Date:`
  no se puede parsear. Un caso final ejecuta el script real (sin dobles) contra este repo.
- Suite completa del registro (`scrum267`, `scrum649`, `scrum811c`, `scrum859`, más el nuevo):
  **91/91 pass**, incluyendo el test que comprueba que el README declara el formato del ancla (no
  rompí ese guard al añadir la mención del generador).
- Control positivo real: la línea `**Medido contra:**` de la cabecera de este mismo fichero salió
  de `node scripts/equipo/ancla.mjs`, sin tocarla a mano.

---

# SCRUM-1152 · APÉNDICE · 17-oct-2026 · SCRUM-1152b · la mitad que `guards:entrada` no miraba: la línea A9

**Medido contra:** `origin/main` = `e244ff61b1b81dd57d3747298ca207502a5a1c59` · 2026-10-17T19:59:48Z

A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

## El encargo y lo que se midió antes de construir

El orquestador pidió «un comando que escriba el ancla» tras dos rojos del 16-oct (S4 y S3). Ese comando
**ya existía** (`scripts/equipo/ancla.mjs`, este ticket, 26-sep) y su existencia la nombra el propio rojo
de scrum267. El encargo se reformuló a «que se use solo». Lo medido, con S0 (que reprodujo los dos casos):

- **Ninguna de las dos líneas salió de `ancla.mjs`**: las dos se teclearon. S4 escribió `= producción =`
  delante del sha (corregido en `44d967e74`); en los cinco arreglos de ancla del 15 y 16-oct
  (`44d967e74`, `7061e487b`, `23c3aeaa6`, `417c128c8`, `7349b8928`) el defecto es siempre de tecleo: sha
  corto, fecha a la española, espacio en vez de `T`, texto de más.
- **El rojo de S3 en #2528 NO era el ancla**: era la línea `A9:` (SCRUM-1294). En el run 38905690014
  scrum267 sale verde. Son dos requisitos con dos guards, y `ancla.mjs` sólo genera uno.
- **`guards:entrada` no llevaba scrum1294**: con el ancla buena y sin `A9:` decía «la entrada puede
  empujarse» (medido por S0) y el CI la tumbaba. El comando de antes del push aprobaba lo que el
  obligatorio rechaza.
- **La plantilla del registro (`docs/master/README.md`) no trae la línea `A9:`**: lo que se copia al
  escribir una entrada lleva la mitad de lo que se exige.

## Lo que se hizo

- `scripts/guards-entrada.mjs`: scrum1294 entra en `GUARDS` (el decimoquinto, ~1,4 s, sin `dist` ni base)
  y `MINIMO` pasa de 14 a 15.
- `docs/master/README.md`: la plantilla lleva la línea `A9:` debajo del ancla (el formato más común; los
  cuatro, sólo en `docs/equipo/00-normas-siempre.md`), y 1294 entra en la tabla de lo que exige
  `guards:entrada`.

## Comprobado

| corrida | resultado |
|---|---|
| entrada temporal con el ancla de `ancla.mjs` y SIN `A9:`, comando NUEVO | salida 1 · `✖ SCRUM-1294` · 15 guards |
| control: sin la entrada, comando NUEVO | salida 0 · «15 guards de entrada en verde (170 tests, 85,0 s de 90)» |
| la misma entrada con el comando de `main` | **CIEGO** (salida 2, cortado a 90 s por la carga de seis sesiones): no lo pude ver en verde yo; el verde falso de `main` es medida de S0 |
| mutación: quitar scrum1294 de `GUARDS` (restaurado y comparado byte a byte) | salida 1 · «la lista tiene 14 guards y el mínimo son 15. No se ejecuta nada.» |
| los 11 tests que vigilan `guards-entrada.mjs` (976, 928, 928b, 1349, 1327, 1289, 1178b, 711, 775, 812, 1153) | 102 de 102, `skipped 0` |

La entrada temporal se borró en un `finally` y `git status` quedó con sólo `scripts/guards-entrada.mjs`.

## Lo que NO hace, y la pregunta que queda abierta

- **Sigue habiendo que acordarse de correr `guards:entrada`**. Esto hace que, si se corre, diga la
  verdad entera; no hace que se corra.
- **El único sitio por el que pasan las seis sesiones antes de empujar es `git push`**, y en esta
  máquina no hay ningún gancho de git instalado (`core.hooksPath` vacío, `.git/hooks` sólo con
  `.sample`). Un `pre-push` en el `.git` común cubriría todos los árboles de trabajo a la vez. **No se
  ha instalado**: cambia el push de todas las sesiones y es decisión del orquestador. La propuesta va en
  mano al orquestador.
- `ancla.mjs` no escribe en el fichero: imprime. Escribir la línea en la entrada no habría evitado
  ninguno de los dos rojos del 16-oct (uno no era del ancla, y el otro quería decir algo —el sha de
  producción— que el formato no admite delante del sha, sí en un paréntesis detrás del instante).