# SCRUM-1771

## SCRUM-1771a · Qué clave imprime `[PENDIENTE microcopy oficial]` en el PDF de una F1, en qué papeles sale y qué literal se propone

**Puesto:** J1 (jv-j1fn) · **Rama:** `scrum-1771a-clave-del-marcador` · 19-nov-2026
**Medido contra:** `origin/main` = `74b3b64f17008449d086008358436f0cb884a8d8` · 2026-11-19T00:42:18Z (cabecera `Date:` de `gh api -i zen`)
A9: aviso → cicatriz J1 «Abrí el PDF de la F1 (lo fabriqué y lo leí) antes de cargar la skill `yaqu-verifactu-sif`, que el encargo pedía cargar ANTES de abrirlo por las menciones fiscales; la cargué después, al ir a citar el RD 1619/2012» — no se pudo comprobar: el orden de las herramientas de una sesión no pasa por ningún guard del repositorio

Solo docs. `src/` no se toca: el PDF es camino de emisión (regla 38, se lee) y el literal es de la
firma del fundador (regla 39). Nada contra staging ni producción: los papeles se fabricaron con el
`dist/` de main (`tsc -p . --noCheck`, salida 0) y el guion
`docs/master/evidencias/SCRUM-1771/medir-marcador-en-papel.mjs`, que lee el texto con el lector de la
casa (`tests/_texto-del-pdf.mjs`).

### ① La clave

- **Constante:** `MARCADOR_MICROCOPY_DESGLOSE` = `'[PENDIENTE microcopy oficial]'`, en
  `src/modules/invoicing/infra/pdf/pdf.service.ts:54`.
- **Quién la pinta:** `generateInvoicePdf` (`pdf.service.ts:366`), en `pdf.service.ts:779`, rama `else`
  de `if (tiposDeIva.length <= 1)` (`:767`): **sólo cuando el documento tiene líneas y MÁS DE UN tipo**.
- **Dónde sale en el papel:** bloque de totales, justo debajo de «Base imponible: … EUR» y encima de las
  filas por tipo. Es el **rótulo de la columna de bases** del desglose. Leído en una F1 fabricada con
  la forma de staging (21 % + 10 %):

      Base imponible:68,00 EUR
      [PENDIENTE microcopy oficial]
      21%50,00 EURIVA 21%:10,50 EUR
      10%18,00 EURIVA 10%:1,80 EUR
      TOTAL:80,30 EUR

- **Desde qué commit:** `7818e2bd79746c35efc7afa906fa94c11298a4bc` · 2026-09-02 04:19:18 +0100 ·
  «SCRUM-623: una fila por tipo de IVA, con su base y su cuota», mergeado en `164971db1`
  (PR #895, 2026-09-02 04:36:42 +0100). Es el único commit de `git log -S MARCADOR_MICROCOPY_DESGLOSE`
  sobre `src/modules/invoicing/infra/pdf`. **Se puso a propósito**: `docs/master/SCRUM-623.md:126-136`
  («la palabra no está escrita y no me toca escribirla… Se apaga escribiendo la palabra»).

### ② Papeles afectados — medido, no deducido

`node docs/master/evidencias/SCRUM-1771/medir-marcador-en-papel.mjs` · población: 9 papeles
(2 controles sembrados + 7 del `dist/`) · salida 0 · `VEREDICTO: MEDIDO`.

| papel | marcador |
|---|---|
| CONTROL + sembrado (pdfkit, con marcador) | 1 |
| CONTROL 0 sembrado (pdfkit, sin marcador) | 0 |
| F1 · un tipo (21 %) | 0 |
| **F1 · dos tipos (21 % + 10 %)** | **1** |
| **R1 · dos tipos** | **1** |
| **Justificante (`JUST`) · dos tipos** | **1** |
| F1 · sin líneas (total a secas) | 0 |
| Presupuesto (`generateQuotePdf`) · dos tipos | 0 |
| Albarán (`generateAlbaranPdf`) · sin valorar, sin firmar | 0 |

F1, R1 y justificante comparten `generateInvoicePdf`, así que los tres lo imprimen con ≥ 2 tipos. El
presupuesto tiene su propio pie por tipo y no usa la constante. **NO medido:** el albarán VALORADO con
dos tipos ni el albarán firmado (su único marcador posible, «En calidad de», ya lo bloquea
`textoParaDocumento` en `albaranPdf.service.ts:374`, SCRUM-903); un grep de la constante en
`src/` da un solo uso (`pdf.service.ts:779`), que es lo que sostiene el 0 del albarán valorado sin
haberlo fabricado. Tampoco se ha leído el PDF de staging (F260001): la forma se reprodujo, no se bajó.

### ③ Por qué no lo cazó ningún guard — porque SÍ lo ve uno, y lo tiene DECLARADO

La premisa del ticket («hoy el censo de microcopy mira el panel, no los PDF») **es falsa desde
SCRUM-667**. Lo que hay hoy en `main`:

- `scripts/censo-marcadores.mjs` barre `public/`, `public/dashboard/js` y `src/`
  (`tests/scrum667-marcador-visible.test.mjs:16`).
- `scripts/_marcadores-pendientes-declarados.json` → sección `papel.constantes` declara **exactamente
  esta constante**: «factura con MÁS DE UN tipo de IVA — el rótulo de la columna de bases».
- `tests/scrum667-marcador-visible.test.mjs` exige que el papel traiga **tantos como se declaran**, y
  `tests/scrum903-marcador-no-se-imprime.test.mjs:12-14` deja esta constante FUERA del filtro
  `textoParaDocumento` a propósito: «se apaga escribiendo el texto, no haciendo fallar el documento».

O sea: el guard funciona y el marcador es una **excepción declarada**, no un hueco. Lo que falló es
otra cosa: **la excepción no tenía ticket de firma**. `docs/CENSO_MICROCOPY_PENDIENTE.md` (6 líneas con
`PENDIENTE`) y `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` dan 0 coincidencias con `DESGLOSE`,
«columna de bases» o `SCRUM-623`: estaba en la lista que se vigila, y no en la que se lleva al fundador.
**Desde el 2-sep-2026, 78 días.** (Población del grep: esos dos ficheros y `docs/microcopy/`.)

### ④ Propuesta de literal — PARA FIRMAR (regla 39)

Contexto legal, copiado del extracto del BOE que ya está en el repositorio
(`docs/master/evidencias/SCRUM-1253/extractos.txt:123,126`, RD 1619/2012, art. 6.2.c): «Deberá
especificarse por separado la parte de base imponible correspondiente a cada una de las operaciones
que se documenten en una misma factura en los siguientes casos: … c) Cuando se comprendan operaciones
sujetas a diferentes tipos del Impuesto sobre el Valor Añadido.» **Lo obligatorio es la separación
(las filas, que ya salen), no el rótulo**: la norma no fija ninguna palabra. Es un rótulo.

Una restricción medida: el impuesto del papel no es siempre «IVA» (`pdf.service.ts:503`,
`params.taxName || 'IVA'`), así que el rótulo no debería nombrarlo.

- **Opción A (recomendada): «Base imponible por tipo»** — usa el término de la norma, no nombra el
  impuesto y casa con la línea de encima («Base imponible: …»).
- **Opción B (la más corta): «Desglose por tipo»**.

Ninguna está firmada. Se aplica en otro tramo, byte a byte desde el comentario de firma.

### ⑤ Propuesta del guard para el tramo siguiente (no escrito)

En el mismo PR que aplique el literal:

1. Se retira `MARCADOR_MICROCOPY_DESGLOSE` de `papel.constantes` del JSON: con la lista vacía,
   `scrum667` pasa a exigir **cero** marcadores en el papel (es su contrato actual, no uno nuevo).
2. Test nuevo, con la matriz de ② (F1/R1/JUST × un tipo/dos tipos/sin líneas, presupuesto con dos
   tipos, albarán valorado con dos tipos y albarán firmado) generada con el `dist/`: cada papel da
   `vecesEnPdf(texto, '[PENDIENTE') === 0`. Suelos: un **positivo sembrado** (pdfkit con el marcador →
   1, fabricado por el propio test, nunca prestado del árbol) y el suelo de lectura del lector de la
   casa; si el positivo no da 1, sale CIEGO, no verde.
3. Mutación al catálogo (`MUTACIONES_QUE_ME_TUMBAN`): volver a poner el marcador en `pdf.service.ts:779`
   → el test cae nombrando F1, R1 y JUST.

Aceptación de SCRUM-1771 → dónde se ve:

| aceptación (literal) | dónde se ve |
|---|---|
| Clave identificada con fichero:línea y lista de documentos afectados (comentario de J1). | este tramo ①② y el comentario de J1 en SCRUM-1771 |
| Literal firmado por el fundador en este ticket. | NO HECHO → fundador (opciones de ④) |
| Guard en la tanda: ningún PDF emitido por `pdf.service.ts` contiene `[PENDIENTE` (con control positivo sembrado). | NO HECHO → J1, tramo siguiente, tras la firma (⑤) |
| Verificado en staging con la cuenta QA: F1 nueva sin el marcador. | NO HECHO → tras el despliegue del arreglo |
