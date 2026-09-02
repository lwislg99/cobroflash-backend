# SCRUM-623 · La factura ya puede expresar más de un tipo de IVA

**Fecha:** 2-sep-2026 · **Carril:** documento fiscal (representación) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `73d73db7f7776b34c2d777206d2d766dcead049c` · 2026-09-02T04:00:57+01:00

**Tanda:** 4245 tests, 4166 pass, 0 fail, 79 skipped

---

## 🛑 LO PRIMERO: UN HALLAZGO QUE PARA, Y NO SE HA ARREGLADO AQUÍ

El encargo dice: «si al construir el desglose CAMBIA ALGUNA CIFRA, PARA INMEDIATAMENTE y dilo: eso
sería otro ticket y mucho más grave». **Apareció, y paré.**

### El camino natural cambiaba cifras

Existe `calcVatBreakdown` (`vat.service.ts`) que **ya devuelve `{rate, base, cuota}` por tipo** —
justo la forma que el fundador decidió— y que alimenta el libro registro, el modelo 303 y el XML de
VeriFactu. Lo natural era consumirla en el PDF y borrar el mapa que éste se había escrito aparte.

**No se ha hecho. Medido sobre 4.006 combinaciones: cambiaría alguna cifra impresa en 547 (13,7 %)**
— un céntimo en la cuota y en el total. La causa: la canónica redondea base y cuota **por separado**
(`round2` por tramo) y la del PDF no redondea hasta `fmt`.

```
líneas: [{qty:3,price:33.33,tax:0.21},{qty:7,price:1.11,tax:0.1}]
  inline (lo que imprime hoy) : base 107.76 · cuota 21.77 · total 129.53
  calcVatBreakdown (canónica) : base 107.76 · cuota 21.78 · total 129.54
```

### 🔴 Y lo grave no es eso: **el papel puede imprimir un total distinto del que se cobra y se sella**

`Invoice.total` sale de `grossOfLines` → `calcVatBreakdown` (`invoiceLines.service.ts:54`). El PDF
**no** imprime ese total: imprime su propia suma (`subtotal + totalVat`). Simulando 20.000 facturas:

| | facturas | el total IMPRESO difiere del SELLADO |
|---|---:|---:|
| con **un solo** tipo | 6.528 | **99 · 1,52 %** |
| con **varios** tipos | 13.472 | **2.619 · 19,44 %** |

**✅ Control positivo:** el comparador caza un céntimo inyectado; si no, sus ceros no valdrían.

Y **ocurre también con un solo tipo** — mi hipótesis previa era que no, y la desmintió medirlo.

Esto no es una molestia estética: `invoiceLines.service.ts` lo dice en su propia cabecera —«Un
céntimo mal PARA SIEMPRE, no un céntimo mal»— porque el total sellado va en la huella VeriFactu y en
el libro. **Un documento que enseña un total y un registro que guarda otro.**

> **NO SE TOCA AQUÍ.** Ni el cálculo, ni el sellador. Va a ticket propio. Este ticket es de
> REPRESENTACIÓN y su diff no mueve ni una cifra — lo fija un test.

---

## 🔴 Y el enunciado del encargo no era exacto

> «Una factura con DOS bases imprime el MISMO número de filas de IVA que una con una sola.»

**Eso sólo pasa cuando uno de los tipos tiene cuota cero.** Medido generando PDFs de verdad y
leyendo su TEXTO (instrumento de SCRUM-604):

| caso | tipos | filas de IVA **antes** | ¿se podía cuadrar desde el papel? |
|---|---:|---:|---|
| A · 21 % | 1 | 1 | **SÍ** — 100 × 21 % = 21,00 |
| B · 21 % + **0 %** | 2 | **1** | **NO** — 105 × 21 % = 22,05 ≠ 12,60 |
| C · 21 % + 10 % | 2 | 2 | **NO** — dos cuotas y **una sola base** |
| D · 21 % + 10 % + 4 % | 3 | 3 | **NO** — igual |

El caso B reprodujo **exactamente** las cifras que midió S2: `Base imponible:105,00 · IVA
21%:12,60 · TOTAL:117,60`.

Así que son **dos** defectos, y sólo el ① hace que las filas no se multipliquen:

* **①** `if (g.vat === 0) return` **saltaba** el tipo de cuota cero (0 %, exento, suplido).
* **②** aun con dos tipos con cuota, las **bases no se imprimían por tipo**.

**La propiedad que falla en TODOS los casos mixtos, y la que arregla este ticket, es la ②.**

---

## 🔢 EL CENSO — ¿qué combinaciones puede producir el sistema?

**Ninguna lista cerrada. El tipo es texto libre.**

* El campo de IVA de la línea es `document.createElement("input")` (`quotesView.js:2136`): el
  profesional escribe lo que quiera.
* Barrido de 249 ficheros y 52.298 líneas de `src/` + el editor: **5 sitios acotan el tipo**, y sólo
  uno lo acota de verdad — `facturaSuelta.ts:132`: `tax < 0 || tax > 1`. **Cualquier fracción de
  [0,1]**, y sólo en esa ruta.
  **✅ Control positivo:** el barrido encuentra esa validación conocida; si no la viera, abortaría.
* El juego *previsto* está escrito, pero como comentario de tipo, no como regla:
  `VatRateEntry = { rate … } // rate en % (21, 10, 4, 0)`.

**Conclusión con número:** sobre el juego previsto **{21, 10, 4, 0}** hay 15 combinaciones no
vacías; **11 son mixtas y las 11 salían irreconstruibles del papel**; las 4 de un solo tipo, no. Y
como el campo es libre, **el conjunto real no está acotado** — que es exactamente por lo que la
forma tenía que servir a N tipos y no a dos.

> ⚠️ **Un censo que NO publico porque salió ciego.** Intenté además contar los valores de tipo
> literales del árbol; el barrido devolvió **1 valor (0 %)** y su propio control positivo lo
> declaró ciego (no encontraba el 21 %). No arreglo el barrido ni publico su número: un 1 de un
> detector ciego se lee igual que un 1 real.

---

## Lo construido

Una fila por tipo, **con su base y su cuota**, tal y como lo decidió el fundador. Leído del PDF:

```
Base imponible:2000,00 EUR
[PENDIENTE microcopy oficial] 21% 1000,00 EUR   IVA 21%: 210,00 EUR
                              10% 1000,00 EUR   IVA 10%: 100,00 EUR
TOTAL:2310,00 EUR
```

* **N tipos, no dos**: con 21 % + 10 % + 4 % salen tres filas. Ordenadas **descendente por tipo**,
  igual que `calcVatBreakdown`, para que dos documentos con las mismas líneas en distinto orden no
  salgan con las filas cambiadas de sitio.
* **Ni una operación aritmética nueva**: las bases salen del **mismo mapa** que el PDF ya calculaba
  y no imprimía nunca.
* **Con UN SOLO tipo, el papel no cambia.** Ni el desglose ni el marcador aparecen: con un tipo el
  documento ya era reconstruible y no había nada que arreglar. Incluye la factura íntegramente al
  0 %, que sigue sin fila de IVA.

### ⚠️ El rótulo: marcado, y hay que decir dónde se ve

`MARCADOR_MICROCOPY_DESGLOSE = '[PENDIENTE microcopy oficial]'`. La **forma** la decidió el
fundador; la **palabra** no está escrita y no me toca escribirla (regla 30). Va **una sola vez**,
como rótulo de la columna de bases: la fila la describen el tipo y el importe, que son dato.

> 🔴 **SE VE EN EL PDF**, sólo en facturas de más de un tipo. Hoy eso no llega a un cliente real
> —`INVOICING_ES_ENABLED` OFF para merchants ES (regla 24) y la demo con marca de agua—, pero es un
> documento fiscal y conviene saberlo. Se apaga escribiendo la palabra.

### 📋 El censo de marcadores **NO sube — y eso es un hueco, no un aprobado**

Medido: `censoActual()` de `scrum402-marcador-no-se-pinta.test.mjs` recorre **sólo
`public/dashboard/js/*.js`**. `src/` está **fuera del censo entero**. Así que este marcador —que se
pinta, y en una factura— **no lo vigila ningún trinquete**.

Lo único que lo vigila es el test de este ticket, que exige que salga **exactamente una vez** en una
factura mixta y **cero** en una de un solo tipo. Extender el censo a `src/` es otro ticket y además
está fuera de carril aquí (los guards son de S3).

---

## ⚠️ SCRUM-619: la forma sirve a las DOS respuestas

Sigue abierta la pregunta a la asesoría de si el suplido va **DENTRO** de la base imponible (hoy,
como una base al 0 % — medido en SCRUM-619) o **FUERA** (que es lo que dice `suplidos.ts`, y que
declara además que **ningún cálculo de emisión lo llama todavía**).

**Sí hay una forma que sirve a las dos, y es la que se ha construido**, porque el bloque está cerrado
sobre **tipos impositivos** y no sobre la naturaleza de la línea:

| respuesta de la asesoría | qué pasa con la maqueta |
|---|---|
| **DENTRO** | el suplido **es** la fila del 0 %, y «Base imponible» lo incluye. Es lo que imprime hoy. |
| **FUERA** | esa fila **desaparece del bloque** y el suplido baja a una línea propia, fuera. El bloque tiene una fila menos; **su forma no cambia**. |

🔴 **Por eso la fila se rotula por su TIPO y jamás como «suplido».** Si se etiquetara por la
naturaleza, la respuesta «FUERA» rompería la maqueta. Y hay una segunda razón, medida: **hoy el dato
no distingue un suplido de una exención** — los dos son una línea al 0 %. Un test lo fija: el bloque
no puede contener «suplido», «exento», «exenta» ni «reembolso», con control positivo de que la fila
del 0 % sí se está leyendo.

---

## El control

**ANTES** (leído del PDF, no del código): las cuatro filas de la tabla de arriba. El caso B enseña
las dos cosas que pedía el encargo — **una sola fila de IVA** y un cálculo que no se reconstruye.

**DESPUÉS**: dos filas, cada una con su base y su cuota, leídas del PDF. `60,00 × 21 % = 12,60` ✓ ·
`45,00 × 0 % = 0,00` ✓ · `60 + 45 = 105` ✓ · `105 + 12,60 = 117,60` ✓.

**NEGATIVO**: la factura de un solo tipo se compara **entera con `===`** contra la cadena que
imprimía antes: `Base imponible:60,00 EURIVA 21%:12,60 EURTOTAL:72,60 EUR`. Idéntica.

**NINGUNA CIFRA CAMBIA — y la prueba no la escribí yo.** El test de SCRUM-604 comparaba el bloque
entero con `===` y su rojo enseña las dos versiones:

```
+ 'Base imponible:105,00 EUR[PENDIENTE microcopy oficial]21%60,00 EURIVA 21%:12,60 EUR10%45,00 EURIVA 10%:4,50 EURTOTAL:122,10 EUR'
- 'Base imponible:105,00 EUR                            IVA 21%:12,60 EUR                 IVA 10%:4,50 EURTOTAL:122,10 EUR'
```

`105,00`, `12,60`, `4,50` y `122,10` están en los dos lados. Sólo se **añade**.

### Los rojos

| inyección | qué cae |
|---|---|
| ① vuelve `if (g.vat === 0) return` | 4 tests: el del 0 %, la propiedad, el de SCRUM-619 y el ✅ de SCRUM-604 |
| ② se quita la columna de bases | 4 tests: los mismos menos el de 604, más el de N tipos |

En los **dos** rojos el **control negativo sigue verde**: el camino de un solo tipo no lo toca
ninguna de las dos inyecciones. Eso es información, no descuido — dice que el arreglo está acotado
al caso mixto, que es justo lo que el encargo exigía. Reversión: `Buffer.compare === 0`, 0 CR.

### El test de SCRUM-604 se ha actualizado, con el GO que él mismo pedía

Tres expectativas cambian de cadena. Una de ellas, `DEFECTO ①: con un SUPLIDO, la base al 0 % NO se
imprime`, era una **caracterización del defecto** y pasa a fijar su arreglo — invirtiendo su
propiedad («dos bases ya NO pueden imprimir el mismo número de filas que una»), no borrándola. Su
propio comentario lo anticipaba: *«si ha cambiado, o se arregló el defecto ① (bien, pero es un
cambio en documento fiscal y necesita constar con su GO) o se rompió el cálculo»*. **Este encargo es
ese GO**, y el cálculo no se ha tocado.

Y **`DEFECTO ②` sigue en pie**: el total impreso sigue ignorando el guardado. Sólo se le actualizó
la cadena.

---

## Lo que NO cubre

1. **El céntimo del apartado 🛑.** Es el hallazgo grave y va a ticket propio.
2. **El desglose del PRESUPUESTO no se toca.** El fundador decidió sobre la factura. Y ojo: el del
   presupuesto (`pdf.service.ts:733`) **sí** consume `calcVatBreakdown` — o sea que factura y
   presupuesto redondean por caminos distintos dentro del mismo fichero.
3. **El XML de VeriFactu no se toca** (tiene su propia partición, SCRUM-636), ni el sellador.
4. **`src/` sigue fuera del censo de marcadores.**
5. **El desglose no dice si un 0 % es suplido o exención**, porque el dato no lo distingue. Es
   SCRUM-619 y no se adivina aquí.

## Ficheros

* `src/modules/invoicing/infra/pdf/pdf.service.ts` — el bloque de tipos: una fila por tipo con su
  base; deja de saltarse la cuota cero; y `MARCADOR_MICROCOPY_DESGLOSE`. El camino de un solo tipo
  queda tal cual.
* `tests/scrum623-desglose-por-tipo.test.mjs` — **nuevo**, 7 tests. La propiedad se comprueba
  **leyendo el papel** y haciendo la aritmética a mano: si usara una función del producto, estaría
  midiendo el código consigo mismo.
* `tests/scrum604-desglose-en-el-pdf.test.mjs` — tres expectativas actualizadas, con su porqué.

## HALLAZGOS FUERA DE ALCANCE

* **El céntimo entre el papel y el registro** (apartado 🛑). Es lo más serio que ha salido de aquí.
* **Factura y presupuesto redondean distinto** dentro del mismo fichero (punto 2 de arriba).
* **El censo de marcadores no mira `src/`** (punto 4).
* **`fmtImporte` está copiado en SEIS sitios más** del árbol — lo declara el propio fichero en su
  cabecera y sigue igual.
