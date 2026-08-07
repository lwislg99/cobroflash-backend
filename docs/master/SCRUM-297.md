# SCRUM-297 (A7) · Exportar evidencias de cumplimiento

**Fecha:** 7-ago-2026 · **Carril:** A (núcleo fiscal)
**Medido contra:** `origin/main` = `12adc4a08fc65022ac705b898e259a1fcbc0f596` · 2026-08-07T10:45:56+02:00
(anclado con `git ls-remote`)
**Tanda:** 2101 tests · 2028 pass · **0 fail** · 73 skipped · `npm test` **`$? = 0`**
Los tests con base (297, 389, 295, 296) contra el banco local: **`$? = 0`**

## Qué pregunta contesta, y por qué no es ninguna de las dos que ya existían

* `portabilidadCompleta.ts` → «dame **todo lo mío**» (RGPD).
* `exportData.ts` → «dame mi **actividad**».
* **A7 → «demuestra que lo que declaraste PASÓ.»**

No construye mecanismo nuevo: **junta** cinco piezas que ya estaban en main — el Libro (A6), el
modelo 303 (A5), el verificador del sello (SCRUM-369), su barrido (SCRUM-371) y el
`quoteLineIndex` que ata cada línea entregada a su línea del presupuesto (SCRUM-367). Es **lectura
pura** (regla 38): el módulo no importa `prisma`, no compone números y no sella — no es una
promesa, es que no tiene con qué, y un guard lo comprueba sobre el AST.

## El paquete

`GET /admin/evidencias.zip?year=&quarter=` (admin-only), armado con `archiver`, que ya estaba en
el proyecto — **ninguna dependencia nueva** (regla 36).

| pieza | qué demuestra |
|---|---|
| `indice.csv` | el estado de un vistazo, un asiento por fila |
| `libro-registro.csv` | lo declarado, con su trazabilidad |
| `modelo-303.csv` | las casillas, **más lo que no está en ninguna** |
| `albaranes-verificacion.csv` | el sello recalculado, con su motivo si no cuadra |
| `entregas-por-linea.csv` | lo entregado atado a la línea del presupuesto (SCRUM-367) |
| `manifiesto.json` | SHA-256 de cada fichero: nadie lo ha tocado desde que se generó |

## El estado va en el ÍNDICE, y es el valor del verificador

Quien abre un ZIP mira el índice, no las 400 filas: **un estado enterrado en la fila 287 está
declarado y no está dicho**. La columna `estado_sello` lleva **exactamente** lo que devuelve el
verificador —`cuadra`, o su motivo (`hash_no_coincide`, `sin_evidencia`, `version_no_soportada`…)—
más `sin_albaranes`, que es un hecho, no una interpretación.

**Cero prosa.** Nada de «pendiente de», nada de calendarios, nada de la AEAT (regla 26). Un guard
sin base comprueba que el índice **no inventa estados** fuera del conjunto que el verificador
produce: traducirlos a prosa nuestra sería escribir un claim fiscal sin aprobar.

## 🔴 El paquete no recalcula ni arregla nada

Si el verificador dice que un sobre no cuadra, el ZIP **lo declara**: no lo corrige, no lo oculta
y no lo deja fuera. **Un paquete de cumplimiento que esconde lo que no cuadra es peor que no
tenerlo, porque quien lo entrega cree que entrega todo.**

Lo comprueban dos tests —uno contra Postgres con un sello roto de verdad, otro sin base— y el
guard de AST prohíbe en este módulo `create/update/delete`, `$executeRaw`, `allocateInvoiceNumber`
y **`computeAlbaranContentHash`**: recalcular el hash aquí sería una **segunda receta**, la que
acusa de manipulados a documentos intactos.

## Los controles

* **SUELO — el test de este ticket.** Si el exportador no encuentra ninguna factura habiendo
  alguna, **falla**: un ZIP vacío se entrega a un asesor o a una inspección y nadie pregunta por
  qué está vacío. Y el suelo del verificador viaja al paquete: `no_se_pudo_mirar` **no** es
  `todo_cuadra`.
* **Control negativo**, dos merchants contra Postgres, sin apoyarse en el guard de SCRUM-243
  (agujero conocido, SCRUM-348): ni una factura ni un albarán del otro, **en las dos direcciones**.
* **Control positivo ①** — el asiento con presupuesto **firmado** + albarán + cobro los lleva los
  tres, con `estado_sello = cuadra` y **cero huecos**. El sello del albarán se siembra con
  `computeAlbaranContentHash`, la función del sellador: ponerlo a mano habría medido mi error.
* **Control positivo ②** — la **factura suelta** (A0.5) sale igual, con sus huecos declarados uno
  a uno (`sin_presupuesto sin_albaran sin_cobro`) y `sin_albaranes` en el estado. Es el caso que
  se olvida, y dejarlo fuera convierte el ZIP en una prueba incompleta entregada como completa.
* **Un importe ilegible sale VACÍO, nunca `0,00`** — por eso el paquete no usa el `csvNum` de
  `exportData` (hace `Number(n ?? 0)`): un cero impreso afirma que esa factura no cobró nada.

## Verificado en rojo — tres, por `$?`, comiteado antes de cada inyección

| inyección | lo que dijo |
|---|---|
| **se quita una pieza** (el CSV de entregas) | sin base: *«le faltan piezas: entregas (entregas-por-linea.csv)»* · con base: *«el paquete no lleva «entregas-por-linea.csv»»* |
| **el paquete oculta lo que no cuadra** | *«el índice dice «cuadra» de un sobre que no cuadra»* |
| **el lector deja de filtrar por merchant** | *«se ha colado un ALBARÁN del otro merchant»* |

## Dos guards ajenos me corrigieron por el camino

* **SCRUM-237** — mi negación `!todo.includes('2026-XX-')` **no tenía hermano positivo**: si yo
  hubiera escrito mal el prefijo al sembrar, habría dado verde para siempre. Ahora se comprueba
  primero que el token **es alcanzable** (el paquete del OTRO sí lo lleva) y solo después que no
  está en el mío — y de paso el control negativo quedó medido en las dos direcciones.
* **Mi propio guard se cazó a sí mismo**: la lista de métodos prohibidos marcaba
  `crypto.createHash(...).update(...)` como escritura. Arreglado mirando la **raíz** de la cadena,
  no el nombre del método — quitar `update` de la lista habría sido «arreglarlo» dejando de
  vigilar lo que vino a vigilar.

## Lo que NO cubre — declarado

* **No hay pantalla ni entrada de menú.** Solo la ruta; dónde se ofrece y con qué copy es decisión
  de producto (regla 30). El índice va **sin frase que lo enmarque**: si hace falta una, es
  microcopy y la apruebas tú.
* **El ZIP no lleva los PDF ni el XML VeriFactu.** Son las piezas que el competidor sí mete. Aquí
  entran los datos y sus checksums, no los documentos renderizados; añadirlos es otro ticket (y
  toca `ensureInvoicePdf`, que está en el camino de emisión).
* **`lugarEntrega` no se selecciona** porque **no existe todavía** en el esquema (llega con
  SCRUM-300 / C5). El barrido tampoco lo lee, y `entradaDesdeFilas` lo resuelve a `null`, que es
  lo que se selló en los sobres v:1. **Cuando C5 entre hay que añadirlo aquí y en el barrido a la
  vez**, o los sobres v:2 se declararán manipulados.
* **Solo se verifican albaranes FIRMADOS del periodo.** Un albarán en borrador no tiene sello que
  comprobar; no aparece.
* **No hay AB6** — no hay superficie visual.
* **Sin caso de sobres v:2** (no existen aún) ni de facturas rectificativas en el paquete.

## Hallazgo de otro carril, ya reportado (regla 9)

`src/modules/jobs/app/routes/jobs.routes.ts:34` importa `calcVatBreakdown` y no lo llama. Sigue
sin tocarse: es zona roja y de otro carril.

## Ficheros

* `src/modules/fiscal/evidencias/paquete.ts` (nuevo) — el constructor puro.
* `src/modules/fiscal/evidencias/paquete.repo.ts` (nuevo) — junta las cinco piezas leyendo.
* `src/modules/fiscal/evidencias/evidencias.routes.ts` (nuevo) — `GET /admin/evidencias.zip`.
* `src/app.ts` · `src/core/http/adminOnlyRoutes.ts` — montaje admin-only y su 403 ejercido.
* `tests/scrum297-evidencias-postgres.test.mjs` (2, gateado por `LIBRO_PG_URL`) ·
  `tests/scrum297-paquete-piezas.test.mjs` (8, sin gate).
