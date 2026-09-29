# SCRUM-1290 · Los 4 guards de navegador que #1943 dejó sin población, reapuntados al modo `factura`

**Medido contra:** `origin/main` = `9977c40f2d36df05579f810866348d17719dd302` · 2026-09-29T16:50:05Z

Carril S3 (instrumentos). Viene de #1943 (SCRUM-825 D1, firma del fundador en el comentario 17446). Decisión del
orquestador: **reapuntar, no retirar**. Retirar perdía la cobertura, y `factura` es el único modo que se emite.

## Qué les pasaba

#1943 hizo que `app.js` convierta en `'no'` todo lo que no sea `'factura'`, y que la ruta `#invoices-new` falle
cerrado (con `'no'` pinta Facturas). Los cuatro guards servían al panel `documentoSuelto: 'justificante'` (915d,
915g, 965) o `'no'` (915i, caso D: hasta #1943 esa ruta pintaba el documento suelto en cualquier modo). Por eso el
editor del documento suelto **ya no se pintaba**. Medido sobre `main` `e75b94ca` antes de tocar nada:

| Guard | Salida | Qué decía |
|---|---|---|
| `guard:pasos-del-editor` (915d) | exit 2 | «justificante 1280px → el editor no se pintó» |
| `guard:ajustes-del-justificante` (915g) | exit 2 | 6/6 casos «el editor del documento suelto no se pintó» |
| `guard:cabecera-del-editor` (915i) | exit 2 | caso D «#invoices-new no se pintó» |
| `guard:un-solo-presupuesto` (965) | exit 2 | caso B «el editor no se pintó» |

## 🔴 El hallazgo que vale más que el arreglo: un exit 2 que nadie mira

**No estaban ciegos en verde, y aun así el defecto sobrevivió, porque nadie iba a leer ese ciego.** No basta con que
un instrumento caiga hacia «no supe mirar» si su salida no la lee nadie. **Un exit 2 que nadie mira es tan inútil
como un verde falso.**

Y el «ciego» sí llegaba a donde alguien podía verlo. El job `guards de navegador (fuera de la tanda)` escribe su
veredicto en el resumen del CI (`scripts/guards-visuales.mjs`, `GITHUB_STEP_SUMMARY`). En el run de `main`
36596028069 (`d2451dbe`) se lee literal:

> DEFECTOS (salida 1) · 1 guard(s) midieron y encontraron algo — Han medido y hay hallazgos: guard:foto-del-gasto.
> ⚠️ Y ADEMÁS 4 guard(s) NO llegaron a medir (guard:pasos-del-editor: CIEGO, guard:un-solo-presupuesto: CIEGO,
> guard:cabecera-del-editor: CIEGO, guard:ajustes-del-justificante: CIEGO)

Así que **añadir el ciego al resumen no arregla nada: ya estaba**. Lo que falla es que ese job **sale rojo SIEMPRE**
en `main`: de los últimos 11 runs de `ci.yml` en `main` que terminaron (29-sep, 09:54Z–16:12Z), **11 de 11** lo
tienen en `failure`. Y como no es obligatorio, un rojo más o menos no cambia nada que alguien mire. Un job
permanentemente rojo no avisa de nada.

**Un job SIEMPRE rojo y no obligatorio no avisa de nada.** Para que un ciego llegue a alguien, ese job tiene que
poder estar en **VERDE**. Esto vale para todos los informativos, no solo para este.

**Re-medido tras #1979** (el arreglo de la foto del gasto, en `main` desde `e75b94ca`). Esos 11 runs mezclaban el antes
y el después del arreglo:

| Dónde | `guard:foto-del-gasto` | Veredicto del job |
|---|---|---|
| run 36596028069 · `d2451dbe` (antes de #1979) | hallazgo | DEFECTOS (salida 1) + los 4 ciegos |
| run 36597577377 · `e75b94ca` (con #1979), job 109512062054 | **ya no sale** | «NO MEDIDO (salida 2) · CIEGO en 4 guard(s)»: **solo estos cuatro** |
| local, `f09dfe44` | ✔ 5/5 (exit 0) | — |

Así que, en `main` de hoy, **lo único que tiene en rojo el job de guards de navegador son los cuatro ciegos de este
ticket**. Con este PR dentro, ese job debería quedar **verde**. Cuando entre, se comprueba en el primer run de `main`.

## Qué cambia

- Los casos del documento suelto piden `documentoSuelto: 'factura'`. El 965 pulsa «Emitir factura», que es el rótulo de
  `rotulosDelDocumento.accionPrimaria()`.
- **Control nuevo en los cuatro:** en cuanto se pinta el editor leen `window.appDocumentoSuelto`. Si no es `'factura'`,
  el caso sale **CIEGO (exit 2)**. Ninguno puede quedarse en verde midiendo otro modo o sin medir nada.
- Se cambian solo los textos y etiquetas que nombraban el justificante, con el motivo y la referencia a #1943 escritos
  en cada fichero. **No se ha quitado ninguna aserción:** ninguna dependía del modo retirado. Lo que miden (pasos, fila
  «Ajustes del documento», menú «⋯», no duplicar) es del editor del documento suelto.
- Los nombres de fichero y de script npm se quedan como estaban, porque los leen los censos de SCRUM-548 y SCRUM-522 y
  `tests/_guards-de-navegador-declarados.mjs`.

## Medido después

| Guard | Salida | Población que midió |
|---|---|---|
| `pasos-del-editor` | exit 0 | 3 casos; factura suelta 1280 px con inventario 7/7 |
| `ajustes-del-justificante` | exit 0 | 6/6: «IVA por defecto 21 %», «Cambiar»/«Listo» a 44 px, el 10 viaja al resumen |
| `cabecera-del-editor` | exit 0 | 4 casos; D con título «Nueva factura» y menú «⋯» con las 2 acciones |
| `un-solo-presupuesto` | exit 0 | 3 casos; B: 1 `POST /admin/invoices`, navega a `invoice-detail/201`, el 2.º clic no encuentra botón |

Red (en local, con `dist` compilado): los 80 tests que leen `scripts/`, el modo o los guards declarados dan **821/821**.

## Lo que NO se ha tocado

`public/`, `app.js`, `rotulosDelDocumento.js`, `src/`, `ci.yml`. Solo los 4 `scripts/guard-*` y este registro. Un
primer commit dejó el registro como apéndice de `docs/master/SCRUM-825.md` (de J); se ha devuelto tal cual está en
`main` y el registro vive aquí.
