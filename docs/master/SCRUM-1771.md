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

## SCRUM-1771c · La pieza entera: el literal firmado en el PDF, el último marcador fuera de `papel` y el guard de los papeles con positivo sembrado

**Medido contra:** `origin/main` = `89bb8593b603c84b3413f4c3f90b1c4e4e715329` · 2026-11-19T18:06:33Z (cabecera `Date:` de `gh api -i zen`)
A9: aviso → cicatriz J1 «Abrí el PDF de la F1 (lo fabriqué y lo leí) antes de cargar la skill `yaqu-verifactu-sif`, que el encargo pedía cargar ANTES de abrirlo por las menciones fiscales; la cargué después, al ir a citar el RD 1619/2012» — no se pudo comprobar: el orden de las herramientas de una sesión no pasa por ningún guard del repositorio (se repitió: en el PASO 0 de 1771c hice un `grep` de dos líneas de `pdf.service.ts` antes de cargar la skill)
Mutaciones: catálogo → tests/scrum1771c-pdf-sin-marcador.test.mjs
Mutaciones: catálogo → tests/scrum1293-cargador-de-marcadores.test.mjs
Mutaciones: catálogo → tests/scrum903-marcador-no-se-imprime.test.mjs

**Firma:** SCRUM-1771 c.22164 (fundador, «A»: `Base imponible por tipo`). **Decisión:** c.22171 (P1 ✅ · P2 ✅ · P3 un PR). Parte de la medición de jv-j1fr (c.22169, 1771b parado sin commits).

### Lo que cambia

* `src/modules/invoicing/infra/pdf/pdf.service.ts:54` — la constante `MARCADOR_MICROCOPY_DESGLOSE` lleva el literal firmado byte a byte. Es la única línea tocada en `src/`. El nombre de la constante y el comentario de `:777` («no me toca escribirlo… va como marcador») quedan viejos: renombrar o reescribir era tocar más camino de emisión que el firmado.
* `scripts/_marcadores-pendientes-declarados.json` — `papel.constantes` queda `{}` con `papel._vacia_desde: "SCRUM-1771 c.22164"`; la entrada de `pdf.service.ts` en `servidor.ficheros` llegaba a 0 y se BORRA.
* `tests/_marcadores-declarados.mjs` (P1) — un vacío en `papel` se lee SÓLO con `_vacia_desde` en forma `SCRUM-<n> c.<comentario>`; vacío sin la clave sigue lanzando; la clave con entradas, o mal escrita, también lanza; en `panel`/`servidor` no existe.
* `tests/scrum1293-cargador-de-marcadores.test.mjs` — caso 7 partido: «`papel` VACÍA SIN declarar» (rojo) y «`papel` VACÍA y DECLARADA» (se lee); dos casos rojos nuevos (firma mal escrita; declaración con entradas). El control positivo del fichero real admite `papel` vacía sólo si la declara.
* `tests/scrum903-marcador-no-se-imprime.test.mjs:236` (P2) — de «está declarado» a «NO está declarado Y `pdf.service.ts` lleva `'Base imponible por tipo'` Y no lleva el marcador». El nombre del caso de `:74` («la factura SIGUE imprimiendo su marcador») queda viejo: su aserción sólo pide que el PDF se genere, sigue verde, y no estaba autorizado a tocarlo.
* `tests/scrum1771c-pdf-sin-marcador.test.mjs` — nuevo: nueve papeles del `dist/` (F1/R1/JUST de dos tipos, F1 un tipo, F1 sin líneas, presupuesto de dos tipos, albarán sin valorar, valorado y firmado). Ninguno trae `[PENDIENTE`; los tres de dos tipos traen el literal una vez y los demás cero. Positivo sembrado (pdfkit con el marcador y con el literal): si el detector no los ve, cada caso de papel sale ROJO con «CIEGO».
* `docs/microcopy/2026-11-19-SCRUM-1771-rotulo-desglose-por-tipo.md` — la microcopy anotada como aplicada (el registro congelado no admite entradas).
### Medido

* **Rojo primero** con el `dist/` de main: 11 casos · 8 pass · 3 fail (F1, R1 y JUST de dos tipos: imprimen `[PENDIENTE`).
* **Verde** con el cambio: los 8 ficheros que leen el JSON (402, 591, 650d, 667, 751, 755, 903, 1293; el encargo nombraba 7: `scrum751` también lo lee) + el nuevo: 96 casos · 96 pass · 0 fail · 0 skip.
* **Mutaciones** con `aplicarUna` de la casa (pasada limpia + mutación + restauración por bytes; `git diff` con el mismo sha1 antes y después): 8 declaradas · 8 tumban. Las cuatro de c.22171: el marcador de vuelta en `:779` tumba F1, R1 y JUST; quitar `_vacia_desde` del JSON tumba el control positivo de `scrum1293`; aceptar vacío sin clave tumba «`papel` VACÍA SIN declarar»; volver la entrada al JSON tumba `scrum903`. Y dos más: el cargador que deja de leer la clave tumba la mitad que se lee, y un detector ciego tumba el positivo sembrado y los nueve papeles.
* **Hallazgo de paso, no arreglado (no autorizado: `scrum667` no se toca):** el «albarán firmado» de `scrum667` (`pdfDeAlbaran` con `firmadoPorCalidad` y sin `signatureData`) NO pinta el bloque del firmante — `albaranPdf.service.ts` sólo lo pinta con `signatureData` —, así que ese papel no recorre la rama de «En calidad de» que dice medir. Lo medí volcando el texto: sin `signatureData` no sale «Ana Pérez». El test nuevo sí la pasa.

### NO medido

* No existe ningún `tests/scrum624y*`: de la lista del encargo no lo corrí porque no hay fichero.
* La suite entera: no la corrí (el orquestador lo confirmó: no la pide el encargo).
* El PDF de staging y la F1 nueva en staging: tras el despliegue.
* Si `scrum667` queda MUDO con la lista vacía: ver la línea de `censo:mudez` en la entrega.

### Relevo jv-j1fu · (a) y (b) de la decisión P4 (c.22180)

A9: aviso → cicatriz J1 «Lancé `meta-guard-mutaciones.mjs --help` para ver sus opciones: no tiene `--help`, arrancó el censo entero (323 guards), lo maté a mitad y dejó `invoiceAdmin.ts` mutado (`if (false)`); lo restauré a mano contra `HEAD` y recompilé `dist/`» — no se pudo comprobar: ningún guard sabe qué opción no existe en un instrumento que muta
Mutaciones: una vez → docs/master/evidencias/SCRUM-624/mutaciones-624y.mjs

Medido el 2026-11-19 hacia las 18:30Z (`gh api -i zen` 18:32:42Z) sobre `origin/main` `4081668b2f2aa6a3685324eef234bdd92690d0e6`, con el trabajo de jv-j1fs (`cb3efbf22ee52e29dac9ccee85685b4025ec89c3`) mergeado. jv-j1fs paró en c.22179 (P4) y el orquestador decidió en c.22180: ✅ (a) y ✅ (b), en el mismo PR.

* **(a)** `tests/_cambios-autorizados-de-la-factura.mjs`: una entrada nueva con firma `SCRUM-1771 c.22164` y solo el par `ambito` (el `cuerpo` de `generateInvoicePdf` no cambia: la constante de `:54` está fuera de él). El par que midió jv-j1fs (`508c2018…` → `76f53559…`) **caducó antes de empujar**: mientras tanto entró en `main` el #3250 (SCRUM-624y), que cambia `pdf.service.ts` y añade su propia entrada. Resolví el conflicto conservando las dos entradas y **regeneré** el par con `docs/master/evidencias/SCRUM-1446d/huellas.mjs` sobre la base nueva: `775ce32827dad87ee48cfa9c3c98593570866587ade6e267ea62bf5539f41a2d` → `deb02178fdb8d0346d7127db2f89c6e663a41c9725f7ec1b063c3060f51343a8` (`cuerpo` `7cbda25f…` igual en base y disco). Esta vez el clasificador de permisos no denegó la edición.
* **(b)** `tests/scrum624e-a-solo-en-f1.test.mjs`: el bloque de la F1 de dos tipos fija `'Base imponible por tipo'` en lugar del marcador. La segunda línea (`:116`, la R1) desapareció con el #3250, que retiró ese caso por c.22137; el conflicto se resolvió con el lado de `main`. El catálogo de 624e no cambia (su mutación es la del justificante), y no hizo falta añadir ninguna.
* **Diff de `src/` contra `main`**: una línea, `pdf.service.ts:54`.
* **Verde**: 32 ficheros (723, 624e, 624y, 624c, 1763, 1051g, los 8 lectores del JSON, 1771c, 836, 700, 710b, 719, 1294, 267, 273, 525d, 854, 523d y los cinco de árbol entero de `guards:entrada`: 195, 414, 694, 710b, 737): 314 casos · 314 pass · 0 fail · 0 skip. `npm run guards:entrada`: 15 guards, 170 tests, salida 0. `tsc -p .` con tipos: salida 0.
* **Mutaciones**: `mutaciones-624y.mjs` (624y + 624e, `aplicarUna` de la casa): 2 declaradas · 2 vivas; `git status` limpio después.
* **`censo:mudez`**: 136 de 136 · VIVO 124 · MUDO 0 · CIEGO 0 · NO APLICA 11 · YA ROJO 1. Ningún fichero de esta pieza llama al filtro (`_guard-texto`), así que la ficha no cambia y no se escribió. `scrum667` no entra en esa población: con la lista vacía su mudez no la mide este censo, y no se toca (c.22171).
* **El rojo de (a) y (b) sin el cambio** no lo volví a ver: `guard-dangerous` bloqueó sobrescribir los ficheros con su versión de `HEAD`, y no lo rodeé. Vale el que midió jv-j1fs en c.22179.

**NO medido:** la suite entera; el meta-guard completo (no tiene filtro por fichero, y la pasada entera son 1.321 mutaciones); qué fichero es el YA ROJO de `censo:mudez` (la salida no lo nombra); staging.

| aceptación (literal) | dónde se ve |
| --- | --- |
| Clave identificada con fichero:línea y lista de documentos afectados (comentario de J1). | c.22159 · tramo 1771a de este registro |
| Literal firmado por el fundador en este ticket. | c.22164 · `docs/microcopy/2026-11-19-SCRUM-1771-rotulo-desglose-por-tipo.md` |
| Guard en la tanda: ningún PDF emitido por `pdf.service.ts` contiene `[PENDIENTE` (con control positivo sembrado). | `tests/scrum1771c-pdf-sin-marcador.test.mjs` |
| Verificado en staging con la cuenta QA: F1 nueva sin el marcador. | NO HECHO → tras desplegar (CIERRES en staging, J1) |
