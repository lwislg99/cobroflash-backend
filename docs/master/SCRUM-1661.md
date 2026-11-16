# SCRUM-1661 · La ficha de un albarán VALORADO enseña sus líneas y su total

**Medido contra:** `origin/main` = `22b1c4510e4034c1a70bd98e2a796bff9cecbf11` · 2026-11-11T20:29:44+01:00 (hora del commit que registra la medición; la rama nace de ese main)

A9: comprobación → `scripts/guards-entrada.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, por la S4 de relevo el 12-nov, para repasar el diff ya hecho; AB6 abajo)

**Puesto:** S4 · **Rama:** `scrum-1661-albaran-valorado-lineas` · 11-nov-2026

## Qué pasaba (medido)
En yaqu.app, con la cuenta QA, la ficha del AB260006 (#51, VALORADO, 4 líneas, 242,36 €) se ve así en prod (build de main 22b1c4510): **0 filas de línea y 0 textos con «€»**, a 390 y a 1280. Causa leída en el código: `albaranDetailView.js` solo leía `alb.lineas` para pasárselas al pad de firma.

## Decisión (SCRUM-1661, comentario del 11-nov-2026: opción A, confirmada por el orquestador)
La ficha enseña **lo mismo que el papel**. Con `ocultarPreciosEnDocumento` encendido salen las líneas sin precio, importe ni total, porque «si pantalla y papel no coinciden, el interruptor deja de hacer su trabajo». **No hay texto nuevo** (regla 39): las cabeceras Concepto/Cant./Unidad/PRECIO UD./IMPORTE, «Base:», «Total:», la leyenda de importes orientativos y «Sin líneas.» se copian letra por letra de `albaranPublicVista.ts` (`renderLineasAlbaran`).

## Qué se hizo
- `public/dashboard/js/albaranDetailView.js`: `pintarLineasDelAlbaran(alb, esc)` pinta la tabla entre la barra de acciones y el rail. Va fuera del rail, como pide la regla del 302. Para enseñar importes hacen falta tres cosas: el decisor de `documentoEnsenaPrecios`, que esté en VALORADO y que el servidor mande `totales`. Si el servidor no manda importes (el operario, 1707), la ficha no los calcula. Al pad de obra sigue sin llegarle ni un importe (466/468).
- `public/dashboard/css/styles.css`: bloque S4 `.albaran-lineas*`. La tabla es `.preview-lines-table`, que ya está en el inventario. El total sigue la Regla del Importe (DESIGN.md:150).
- `tests/scrum1661-ficha-albaran-con-lineas.test.mjs`: 5 casos (VALORADO, interruptor, SIN_VALORAR, sin `totales`, vacío). **ROJO con la ficha de main** (0 filas, 5/5 fallan) → **5/5 en verde** con el arreglo.

## Tests (no se ha corrido la tanda completa, por la memoria de la máquina)
- 130 ficheros que nombran `albaranDetailView`/`styles.css`: 1101 tests, 0 fallos y 1 salto.
- 88 guards que barren `public/dashboard/js`: 716 tests, 0 fallos.

## Medido en yaqu.app con la rama servida por encima (route de playwright, solo lectura, #51)
| ancho | filas | total | estilo del total | desbordes |
|---|---|---|---|---|
| 390 | 4 | Total: 242,36 € | rgb(15,28,23) · 800 · tabular-nums | ninguno (tabla 364 = scroll 364) |
| 1280 | 4 | Total: 242,36 € | ídem | ninguno |

Queda pendiente verificarlo en yaqu.app una vez mergeado.

## AB6 sobre el diff (repaso del 12-nov, S4 de relevo)
- **Tokens:** `var(--ink, #0f1c17)` y `var(--muted)`, sin colores nuevos. **Sin estilos en línea.** La tabla es `.preview-lines-table`, del inventario AB3. El bloque CSS va marcado «S4 · SCRUM-1661» dentro del contenedor de S2.
- **Contraste:** Tinta sobre fondo claro cumple AA. **Targets:** no hay controles nuevos (la tabla es solo lectura), así que no aplica el mínimo de 44 px.
- **Textos largos:** el concepto parte palabras largas con `overflow-wrap: anywhere` y las cifras van `nowrap`. Se midió en prod con el #51 a 390 sin desbordes. **No se ha medido** un importe de 9.999,99 €; queda para la verificación tras el merge.
- **Estados:** sin líneas sale «Sin líneas.», copiado de `albaranPublicVista.ts`. No hay carga propia, porque las líneas vienen con la ficha.

## A9 · el fallo de este registro (12-nov)
El 11-nov se empujó sin el ancla de SCRUM-267. El 12-nov, al ponérsela, se comprobó SOLO `scrum267` antes de empujar, y el CI cazó dos guards más de la misma entrada: la línea A9 (SCRUM-1294) y la declaración de la skill de UI (SCRUM-1340). Los tres viven en `npm run guards:entrada` (SCRUM-414), que existe para esto. Es la comprobación de la línea A9 de arriba.
