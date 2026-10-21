# SCRUM-1260b · `emitInvoice` ya no escribe `type: 'JUST'`

**Medido contra:** `origin/main` = `fe65a8b7fca8b1e42448c8134e26d880d96b9ba7` · 2026-10-21T12:22:02Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `tests/scrum1260b-el-emisor-ya-no-escribe-just.test.mjs`

J1 (sesión `jv-j1m`, equipo de Javier), por encargo del orquestador `cobroflash-backend-5f`. Carril:
`src/modules/invoicing/**` es J1 (`dos-equipos.md:117`). No existía `SCRUM-1260.md`: esta es su primera
sección, y lleva la letra `b` porque así se nombró la rama. El encargo pedía el fichero
`SCRUM-1260b.md`, y `tests/scrum273-registro-por-fichero.test.mjs` lo tumba (un fichero por número de
ticket): va como sección de `SCRUM-1260.md`. La 1260c, si llega, se anexa debajo.

## La firma

- **c.19616** (14-oct-2026, registrada por el orquestador `cobroflash-backend-2e`): el fundador, literal,
  «si lo de JUST es por los justificantes tumbalo ya. No hay justificantes» → salida (A), se retira.
- **c.20143** (21-oct-2026, registrada por `cobroflash-backend-5f`): GO de la regla 40, literal del
  fundador «ok confirmo explicitamente». Alcance escrito allí: «retirar el escritor inalcanzable de
  `type: 'JUST'` en `emitInvoice` […] Nada más del camino de emisión».
- ⚠️ c.20143 cita la frase del 14-oct como «túmbalo ya, no hay justificantes» (con tilde y en minúscula);
  c.19616 la tiene como «tumbalo ya. No hay justificantes». No cambia el alcance; se dice para que nadie
  copie la segunda como literal.

## Qué se ha hecho

En `src/modules/invoicing/domain/invoicing.service.ts`, dentro de `emitInvoice`:

    - type: isReceiptNumber(number) ? 'JUST' : (input.type ?? 'F1'),
    + type: input.type ?? 'F1',

Nada más del camino: ni firma, ni helper, ni movimiento. Lo que va con ello, autorizado por el
orquestador como consecuencia mecánica (mensaje del 21-oct, «Las tres consecuencias mecánicas VALEN»):

1. **El import de `isReceiptNumber`** en ese fichero se queda sin uso y se quita. La función sigue
   exportada en `invoiceNumber.service.ts` (regla 29: lee lo ya emitido).
2. **Tres comentarios que pasaban a mentir** se corrigen sin mover líneas: la cabecera de
   `invoicing.service.ts` (`:7-8`), el del campo `type` de `EmitInvoiceInput` (`:41`) y
   `facturaSuelta.ts:44`. *(Al orquestador le dije «dos comentarios»; la cabecera es el tercero, lo vi
   al quitar el import.)*
3. **`tests/scrum1027-atajo-flag-off-sin-documento.test.mjs`**: su suelo NEGATIVO **exigía** que el
   escritor siguiera (`assert.match … 'JUST'`). Se le da la vuelta en este PR citando c.19616/c.20143, igual
   que ese mismo test ya hizo con el generador `J-` para D1 de SCRUM-825; y se le añade un positivo (el
   `type: input.type ?? 'F1'`), para que el negativo no pase sobre un fichero vacío. Siguen exigiéndose
   `isReceiptNumber` y `RECEIPT_NUMBER_PREFIX`.

No se tocan: `isReceiptNumber`, `RECEIPT_NUMBER_PREFIX`, el tipo `'JUST'` en `TipoDocumento` (las filas
ya emitidas lo llevan), ninguna fila de ninguna base, `INVOICING_ES_ENABLED`, y el tipo de
`EmitInvoiceInput.type` (sigue admitiendo `'JUST'` por la unión: quitarlo es cambiar una firma, STOP).

## Por qué era inalcanzable — medido hoy, no copiado

El enunciado y c.19616 se apoyan en «330 combinaciones» de `SCRUM-1257.md` (28-sep). No se han re-usado:
se ha medido de nuevo, y entrando por `emitInvoice` compilado (lo pide c.19616, punto 3), no por
`formatInvoiceNumber` suelto.

- **Leído:** en `emitInvoice` el número es un `const` que sale de `allocateInvoiceNumber`, sin reasignar.
  `allocateInvoiceNumber` (`invoiceNumber.service.ts:335-493`) tiene tres salidas: `throw
  merchant_not_found` (`:398`), `throw invoicing_es_disabled` en modo `receipt` (`:449`) y
  `return formatInvoiceNumber(…)` (`:492`). `formatInvoiceNumber` devuelve `F<AA><NNNN>`
  (`formatoNumero.ts:77`, serie `'F'`, `:51`) o `` `${year}-${p}…` ``: empieza por `F` o por un dígito.
- **Ejecutado** (caso ① del test): 4 comercios (ES con flag ON, fuera de España, demo, ES con flag OFF;
  el modo de cada uno se COMPRUEBA con `getEmissionMode`) × 5 prefijos de serie (`CF`, `FG`, `J-`,
  ` J-`, `j-`) × los 4 orígenes de `ORIGENES_C7` × tipo `F1` o sin tipo = **160 llamadas**: **120
  emiten**, **40 rechazan** con `invoicing_es_disabled` (todas las del modo `receipt`, sin crear fila).
  **0 de 120 filas** son justificante por tipo o por número; las 120 salen `F1`.
- **Con la rama y sin ella el ① da lo mismo** (corrido en las dos): eso es lo que demuestra que
  retirarla no le quita nada a nadie. Y por eso mismo el ① **no** caza que alguien la devuelva; eso lo
  caza el ② (texto del cuerpo ejecutable).

## Rojo primero, verde después, y quitar cada pieza

| pasada | ① alcance | ② texto | `scrum1027` NEGATIVO |
|---|---|---|---|
| antes del cambio | verde | **rojo** («vuelve a escribir 'JUST'») | verde |
| después | verde | verde | verde |
| rama devuelta a mano en `src/` (mutación) | verde | **rojo** | **rojo** |
| detector del test vaciado (`[].filter`) | — | — | el caso del detector sembrado sale **rojo** («estaría ciego») |
| la `tx` falsa deja de capturar filas | **rojo** («el ① estaría ciego») | — | — |

*Error propio:* la primera versión del ② ponía antes el positivo de forma (`input.type ?? 'F1'`), y el
rojo de antes del cambio salía por ahí y no por `'JUST'`. Se reordenó para que el rojo nombre el defecto.

## Lo que se ha corrido

Los 52 ficheros de `tests/` que nombran `emitInvoice`, `invoicing.service`, `isReceiptNumber`, `'JUST'` o
`facturaSuelta` (lista por `grep -lE`, no elegida a mano), sobre `dist/` compilado con `tsc --noCheck`:

| | tests | pass | fail | skip |
|---|---|---|---|---|
| antes | 456 | 448 | 0 | 8 |
| después (+ el nuevo) | 459 | 451 | 0 | 8 |

Los 456 nombres de antes están todos después (comparados como conjunto, `diff` de la lista ordenada);
los 3 de más son los del fichero nuevo. Los 8 saltos declaran su motivo: 6 por `QA_DB_TEST`, 2 por
`LIBRO_PG_URL`. **No es la tanda completa**; el juez es el check obligatorio del CI.

Y `npm run tanda:dirigida` (lista calculada por `scripts/tests-que-cubren.mjs`, no a mano): **381 de 1.426
ficheros · 3.673 tests · 3.665 pass · 3 fail**. Los 3 son del ÁRBOL, no del cambio: dos de
`scrum1298b-latido-arbol-de-arranque` (miden el árbol principal frente a este, que es un worktree anidado)
y uno de `scrum476-reconciliar-censos` («CERO directorios `node_modules`»: este árbol no tiene el suyo).
Ninguno de los dos ficheros nombra los tocados (`grep`: 0 en `scrum1298b`; en `scrum476`, una mención a
`docs/master` en un comentario). **No medido:** que caigan igual sin mi diff; se espera al CI. La primera
pasada de la dirigida salió CIEGA (`dist/` más viejo que el fuente, porque deshacer la mutación con `cp`
le cambió la fecha); se recompiló y se repitió.

`tsc --noEmit`: 17 errores, **ninguno** en los ficheros tocados; los 17 son de `archivedAt`,
`activityKind` y uno derivado (`charge`), porque el cliente de Prisma compartido va por detrás del
esquema (`node scripts/_prisma-client-guard.mjs` en rojo: faltan `Merchant.activityKind` y
`Quote.archivedAt`). Rojo **ajeno**: no se regenera desde un árbol que cuelga del compartido (A1).

## Los otros cinco escritores — NO tocados aquí

Medidos con `git grep -n "'JUST'" origin/main -- src` sobre `fe65a8b7`. Tienen la misma condición
(`isReceiptNumber(<número>) ? 'JUST' : 'F1'`) y el GO de c.20143 no los cubría:

| fichero:línea | |
|---|---|
| `src/lib/invoicing.ts:432` | |
| `src/modules/jobs/app/routes/jobs.routes.ts:1554` | |
| `src/modules/quotes/app/routes/quotes.routes.ts:663` | |
| `src/modules/system/app/routes/quotesAdmin.routes.ts:368` | |
| `src/modules/system/app/routes/quotesAdmin.routes.ts:661` | |

`SCRUM-1257.md` §1 ya los listaba (con otras líneas, de su `main`), y `SCRUM-1523.md` §3.2 también.
⚠️ **`SCRUM-1496.md` (fila 11) y `evidencias/SCRUM-1496d` apuntaban 1260 a `src/lib/invoicing.ts:432`,
no a `emitInvoice`**: el ticket y el GO nombran `emitInvoice`. El orquestador los ha llevado al fundador
y van en otra rama (SCRUM-1260c), con su propio GO. **No leído aquí, sitio por sitio:** que en esos cinco
el número venga de `allocateInvoiceNumber`; lo afirma `SCRUM-1257.md` §1 (eslabón 3) sobre su `main`.
También fuera: las dos semillas de `scripts/seed-demo.mjs:384` y `:441`.

## Lo que NO se ha hecho

- Ninguna base de datos medida (ni cuántas filas `JUST` hay): fuera del encargo.
- No verificado en yaqu.app: el cambio no tiene superficie visible (la rama no se tomaba).
- La tanda completa no se ha corrido en local; se mira el obligatorio del PR.

## Cómo se repite

    node ../../../node_modules/typescript/bin/tsc --noCheck   # desde el worktree anidado
    node --test tests/scrum1260b-el-emisor-ya-no-escribe-just.test.mjs tests/scrum1027-atajo-flag-off-sin-documento.test.mjs
