# SCRUM-1556 · Los instrumentos sin dueño que pasan al equipo de Javier: la fila J3 en §3

**Medido contra:** `origin/main` = `00179a513a5fb11ca12d61fe25b1b2dec26b51ca` · 2026-10-23T09:26:53Z

A9: aviso → cicatriz J3 «Corrí la mini-tanda de la tabla en un árbol anidado sin `dist/`, con la trampa escrita en el prompt y en la memoria: 7 rojos de «Cannot find module ../dist» antes de construir.» — no se pudo comprobar: qué tiene construido el árbol antes de una tanda es cómo trabaja la sesión y ningún test del árbol lo ve

23-oct-2026 · **J3** (sesión `jv-j3am`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-62`).
[Escrito por J3. El ticket se leyó entero en Jira: descripción y su único comentario, c.19641 de la S0 de Luis.]

**Carril a mano** (SCRUM-1506). El hook de arranque dijo «SIN IDENTIDAD». Etiquetas leídas en el ticket:
`area-j3`, `carriles`, `equipo-javier`, `instrumentos`. `docs/equipo/dos-equipos.md` es de la S0; la fila se
escribe aquí porque la S0 lo dejó dicho en c.19641 («No escribo vuestras filas: son vuestras») y la decisión
del fundador, «Ok nos lo quedamos nosotros» (14-oct-2026), está en la descripción del ticket. No se toca
ninguna otra fila de §3.

## PASO 0

- `git log origin/main --grep=1556`: un solo commit, el merge del PR #1556 (otra cosa: SCRUM-973b). Ninguno
  de este ticket. `git ls-remote` de `scrum-1556*`: vacío. PR con «1556»: #1556 y #2470, ninguno con rama
  `scrum-1556`. No había `docs/master/SCRUM-1556.md`.
- Por contenido: `grep` de `guards-entrada` y `_censo-por-posicion` en `docs/equipo/dos-equipos.md`: 0 líneas
  (control positivo del mismo grep: la fila de `_censo-bytes-control.mjs` sí sale).

## Las rutas, re-medidas (la descripción lo pide)

| fichero del ticket | en `main` | qué decía la tabla ANTES |
|---|---|---|
| `scripts/guards-entrada.mjs` | existe | `SIN CERRADURA` · fila general de `scripts/` (`dos-equipos.md:172`) |
| `tests/_censo-por-posicion.mjs` | existe | `sin fila en §3: nadie lo reclama` |
| `scripts/cotejo.cjs` | **NO existe** (lo había medido ya la S0 en c.19641) | — |

## Cuál de los cotejos es el instrumento

Hay cuatro ficheros llamados cotejo en el repositorio, todos en `docs/master/evidencias/`:

| fichero | lo importa | corre en la tanda |
|---|---|---|
| `scrum1500/cotejo.cjs` | `tests/scrum1500-el-cotejo-contra-el-master.test.mjs` y `tests/scrum1537-los-dos-cotejos.test.mjs` | **sí** (desde SCRUM-1500b) |
| `scrum1500c/cotejo-once.cjs` | sólo `tests/scrum1537-los-dos-cotejos.test.mjs` | no (lo dice la cabecera de ese test) |
| `scrum1511f/cotejo.mjs` | nadie | no: lee un JSON de Jira de un día |
| `SCRUM-1542/g-cotejo.mjs` | nadie | no: lee dos JSON ya comiteados |

**El instrumento es `docs/master/evidencias/scrum1500/cotejo.cjs`.** Motivo: es el único de los cuatro que
corre en el check obligatorio, se llama exactamente como el ticket lo nombra (`cotejo.cjs`), y los otros
tres son, o un complemento que sólo corre dentro del test de 1537, o guiones de evidencia de una sola
medición. **No le escribo fila**: el criterio de §3.3 («el área del ticket que lo crea») da **J5**, porque lo
creó SCRUM-1500, con `area-j5`, y el encargo era escribir sólo las filas J3. Queda para el orquestador
de Javier, y lo dice la nota de la fila nueva. Hoy contesta `sin fila en §3: nadie lo reclama`.

## Lo que entra

- `docs/equipo/dos-equipos.md` §3.3: UNA fila, `**J3**` a secas (lo que lee `RE_DUENO`, c.19641 §3), con
  las dos rutas, el porqué y la nota del cotejo. Va justo después de la fila de S5 de scripts por área.
- `node scripts/carriles.mjs generar`: `.claude/carriles.json` (sha de la tabla `4c0b7462be07` →
  `5c2f394822a6`, dos reglas nuevas y las líneas de abajo corridas en una) y `.claude/rules/carril-j3.md`
  (las dos rutas). `carriles.mjs comprobar`: `IGUAL a la tabla`.
- `scripts/_sin-fila-declarados.json`: `suelo.quedan` 224 → **223**. `guards-entrada.mjs` estaba en la
  foto del 9-oct (`sin-fila-9oct.txt:183`); al darle fila, el trinquete exige bajarlo en el mismo PR.

## Antes y después

Población: los 317 ficheros de `scripts/` que lista `carriles.mjs sin-fila`, y las dos rutas por `de`.

| control | antes | después |
|---|---|---|
| `de scripts/guards-entrada.mjs` | `SIN CERRADURA` · `dos-equipos.md:172` | **`J3 (puesto)`** · `dos-equipos.md:188` |
| `de tests/_censo-por-posicion.mjs` | `sin fila en §3` | **`J3 (puesto)`** · `dos-equipos.md:188` |
| `sin-fila` (scripts sólo con la fila general) | 229 de 317 · `guards-entrada.mjs` en la lista | 228 de 317 · fuera de la lista |
| control positivo de `sin-fila`: `scripts/wa-prueba.mjs` | en la lista | sigue en la lista (1) |
| `de docs/master/evidencias/scrum1500/cotejo.cjs` | `sin fila` | `sin fila` (a propósito: ver arriba) |

`tests/_censo-por-posicion.mjs` no lo lista ningún censo de huecos: `sin-fila` sólo mira `scripts/` y
`huecos` sólo `src/` y `public/`. Para él el único control es `de`.

## Mutaciones (rojo primero, con el código quieto)

- **M1** · `suelo.quedan` se deja en 224: `tests/scrum1480f-un-script-nuevo-no-entra-sin-fila.test.mjs`
  sale rc=1 con «siguen sin fila 223, y scripts/_sin-fila-declarados.json dice 224». Restaurado.
- **M2** · la celda del dueño pasa a `**J3** o **J6**`: los dos `de` vuelven a `SIN CERRADURA`, y
  `carriles.mjs comprobar` dice `DISTINTO de la tabla`. Es lo que la S0 avisó en c.19641 §3. Restaurado.

## Tests

Los 14 ficheros de `tests/` que nombran `dos-equipos`, `carriles` o `_sin-fila-declarados`: **140 casos,
140 pasan** — en dos pasadas, y lo digo: la primera dio 133 + 7 rojos porque el árbol anidado no tenía
`dist/` (los 7, de `scrum686`, `scrum699` y `scrum786`, eran `Cannot find module '../dist/…'`); con
`tsc --noCheck` esos tres ficheros dan 17 de 17. La tanda completa no se ha corrido en local.

## Lo que no se ha hecho

- Ninguno de los tres instrumentos cambia lo que comprueba. No se ha tocado `carril.mjs`,
  `.claude/settings.json`, `src/`, ninguna base ni ningún workflow.
- La fila del cotejo (J5 por el criterio) la decide el orquestador de Javier.
- En el navegador no hay nada que ver: es una tabla de carriles.

## SCRUM-1556b · La fila J5 del cotejo

**Medido contra:** `origin/main` = `7fa745dc20865ec9a66f08a04c52ee2b2958fd74` · 2026-10-23T10:45:19Z (hora de GitHub, cabecera `Date:`)

A9: aviso → cicatriz J5 «Puse en la primera celda de una fila de §3 una carpeta entre comillas invertidas como explicación, y el lector la convirtió en regla: `docs/master/evidencias/**` → J5, las evidencias de los dos equipos; `carriles.mjs comprobar` dio IGUAL y sólo lo vio leer el diff de `.claude/carriles.json`» — no se pudo comprobar: que una ruta de la primera celda sea la que se quiere reclamar es intención de quien escribe, y ningún guard sabe qué fila quería

23-oct-2026 · **J5** (sesión `jv-j5aa`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-62`).
[Escrito por J5. El ticket se leyó entero en Jira: descripción y sus cuatro comentarios, hasta c.20467.]

**Carril a mano** (SCRUM-1506). El hook de arranque dijo «SIN IDENTIDAD». La decisión es la del orquestador:
el cotejo es **J5** porque lo creó SCRUM-1500, y en Jira SCRUM-1500 lleva `area-j5` (leído hoy). El visto de la
S0 para escribir nuestras filas es el mismo de la fila J3 (c.19641). No se toca ninguna otra fila de §3.

### PASO 0

- `git log origin/main --grep=1556`: los tres commits de #2705 (la fila J3) y el PR #1556, ajeno. Nada del cotejo.
- PR con head `scrum-1556*`: sólo #2705, MERGED. `ls-remote` anclado a `refs/heads/scrum-0*1556[a-z]?-`: vacío.
- Por contenido: `dos-equipos.md` sólo nombra el cotejo en la NOTA de la fila J3 («su fila la decide el
  orquestador de Javier»), que el lector no lee como ruta.

### Antes y después (`node scripts/carriles.mjs de …`)

| ruta | antes (`7fa745dc`) | después |
|---|---|---|
| `docs/master/evidencias/scrum1500/cotejo.cjs` | `sin fila en §3: nadie lo reclama` | `J5 (puesto) · dos-equipos.md:189` |
| `scripts/guards-entrada.mjs`, `tests/_censo-por-posicion.mjs` | `J3 (puesto) · :188` | igual (control positivo: la fila J3 no se mueve) |
| `docs/master/evidencias/scrum1500c/cotejo-once.cjs`, `docs/master/evidencias/SCRUM-1542/g-cotejo.mjs` | `sin fila` | `sin fila` (control negativo: la fila reclama un fichero, no la carpeta) |

Población (medida en un árbol limpio de `7fa745dc` y en el mío): las filas de §3 pasan de 72 a **73**, sobre
7.101 ficheros; las reglas pasan de 191 a **192** y las que tienen
dueño, de 171 a **172**: entra exactamente una. `comprobar` = `IGUAL a la tabla`. `.claude/rules/carril-j5.md`
gana una sola línea, la del fichero. `scripts/_sin-fila-declarados.json` no cambia: su censo mira `scripts/`.

### Mi error, cazado antes del commit

La primera versión de la fila llevaba en su primera celda «de los cotejos de `docs/master/evidencias/`», como
explicación. El lector (`rutasDeCelda` en `scripts/_carriles.mjs`) toma toda ruta entre comillas invertidas
de esa celda, y una que acaba en `/` es una carpeta: salió una segunda regla, `docs/master/evidencias/**` → J5,
que le habría dado a J5 las evidencias de los dos equipos (`cotejo-once.cjs` contestaba ya J5).
**`comprobar` dio IGUAL**, porque comprueba que lo generado casa con la tabla, no que la tabla diga lo que se
quería. Lo vi leyendo el diff de `.claude/carriles.json`. Arreglado sin comillas; cicatriz J5 en este PR.

### Mutaciones (con el código quieto)

Sobre el commit `420166ab`, y restauradas con `git checkout` (después, `comprobar` = IGUAL y el cotejo, J5):

- **M1:** el dueño pasa a «**J5** (cotejo)» → `de` del cotejo da `SIN CERRADURA` y `comprobar` da `DISTINTO de la
  tabla: .claude/carriles.json, .claude/rules/carril-j5.md`.
- **M2:** vuelve la carpeta entre comillas a la primera celda y se regenera → `cotejo-once.cjs` contesta
  `J5 · patrón docs/master/evidencias/**` y `comprobar` sigue en **IGUAL**: es el error de arriba, reproducido.
  Lo caza el control negativo (`de` de un hermano), no el guard.
