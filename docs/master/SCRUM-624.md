# SCRUM-624 · El PDF recalcula el total e ignora el guardado — medición y propuesta

**Fecha:** 3-sep-2026 · **Carril:** documentos / dinero · **Gate:** sin gate — el censo corre en `npm test`

**Medido contra:** `origin/main` = `ce8f262a5270dbecfb3f503eaa8d1bd323db5683` · 2026-09-03T12:20:55Z

**Tanda:** 4962 tests, 4878 pass, 0 fail, 84 skipped — medida DESPUES del ultimo cambio, entrada incluida.

> 🔴 **ESTE TICKET NO CAMBIA NINGÚN CÁLCULO.** No se ha tocado `pdf.service.ts` ni ningún camino
> de emisión. Lo que entra es un censo con suelo y esta propuesta. La decisión es del fundador.

---

## Los tres números

| medición | resultado |
|---|---|
| **1 · ¿hay hoy un documento cuyo total guardado difiera del impreso?** | **SÍ: 1 de 7** en staging (dev tiene 0 facturas y el suelo lo dice) |
| **2 · ¿qué documentos recalculan?** | **3 recalculan, 4 leen lo guardado** — y los que recalculan usan **dos motores distintos** |
| **3 · ¿cuántos sitios calculan dinero?** | **202 sitios en 70 ficheros**, con **4 convenciones** vivas y **12 ficheros que mezclan** dos o más |

---

## MEDICIÓN 1 · Existe, y el camino real no es el que se buscaba

Recalculando por las dos convenciones y comparando con el guardado, factura a factura:

```
staging · 7 facturas, todas con líneas
  🔴 el PDF imprime distinto del guardado en:  1 de 7
     por línea distinto del guardado en:       1 de 7
     las dos convenciones difieren entre sí:   0 de 7

  J-20260722-R8Y8  (JUST, pending)  guardado 30,01 · imprime 30,00 · por línea 30,00
       líneas: [{ qty: 1, price: 30.003, tax: 0 }]
```

**El caso divergente no lo es por el IVA: lo es por los DECIMALES DEL PRECIO.** Su línea lleva
`price: 30.003`, y `core/validation/schemas.ts:16` declara `price: z.number().nonnegative()` —
**nada limita a dos decimales**. El total se guardó como `Decimal(12,2)` = 30,01 y el PDF, que
recalcula, imprime 30,00.

O sea que la pregunta abierta desde el 24-ago tiene **dos** respuestas, no una:

1. **el redondeo** — tres líneas de 9,99 € al 21 % dan **36,27** por la convención escrita y
   **36,26** por la del PDF;
2. **los decimales del precio** — el camino que de hecho ha ocurrido en datos.

**Atenuantes que hay que decir:** el documento divergente es un **justificante (`type: JUST`)**, no
una factura fiscal F1, y está en `pending`. La única F1 de la base cuadra. **No es una factura
emitida con un total mal impreso** — todavía.

**Suelo y control positivo, los dos ejercitados.** En dev el instrumento devolvió *«NO SUPE MIRAR:
cero documentos examinados»* en vez de «cero divergencias», que es la distinción entera. Y el caso
construido (3 × 9,99 al 21 %) se caza antes de mirar ningún dato: si no se cazara, el cero no
valdría nada.

**Producción no se ha tocado ni nombrado.** Si se quiere el mismo número allí, la consulta es de
sólo lectura y la corre el fundador:

```sql
SELECT id, number, status, type, total, lines
FROM invoices
WHERE jsonb_array_length(COALESCE(lines, '[]'::jsonb)) > 0;
```

y sobre su salida se aplican las dos funciones de `tests/scrum624-cuantos-sitios-calculan-dinero.test.mjs`.

---

## MEDICIÓN 2 · El alcance: no todos recalculan, y ahí está el problema

| documento / superficie | de dónde saca el importe | fichero:línea |
|---|---|---|
| **Factura F1/R1/JUST con líneas (PDF)** | 🔴 **RECALCULA**, float sin redondear hasta `fmt` | cálculo `pdf.service.ts:411` · pinta `:513` |
| Factura sin líneas (fallback del PDF) | el guardado | `pdf.service.ts:520` |
| **Presupuesto (PDF)** | el guardado | `pdf.service.ts:954` |
| **Albarán (PDF)** | totales ya calculados, que recibe | `albaranPdf.service.ts:264` · calculados en `albaran.service.ts:194` |
| **Factura final por tramos** | total explícito; **no** recalcula | `finalInvoice.service.ts:68` |
| **Vista de factura del dashboard** | el guardado | `invoiceDetailView.js:154` |
| **Landing pública del presupuesto** | 🔴 **RECALCULA** con `calcVatBreakdown` | `quoteDecisionLanding.routes.ts:8` |
| **Libro registro · modelo 303 · XML VeriFactu** | 🔴 **RECALCULAN** con `calcVatBreakdown` | `vat.service.ts:19-23`, y 20 ficheros lo importan |

**No es un descuido: es un patrón, y el patrón es peor que el descuido.** El papel que ve el
cliente y el registro que ve Hacienda **se calculan por dos motores distintos**:

- el PDF de factura tiene **su propio bucle** y no llama a `calcVatBreakdown`;
- `calcVatBreakdown` redondea base y cuota **por separado** con `round2`.

Y ya está medido lo que costaría unificarlos, en `pdf.service.ts:448`: **sobre 4.006 combinaciones,
cambiaría alguna cifra impresa en 547** (un céntimo en cuota y total). Está escrito en
`docs/master/SCRUM-623.md` y se dejó fuera de aquel ticket a propósito.

---

## MEDICIÓN 3 · Cuántos sitios calculan dinero

Censado **por AST y por identidad de nodo** —`Math.round` es `Math` + `round`, nunca la cadena—,
sobre `src/` y `public/`:

```
342 ficheros analizados
202 sitios que calculan dinero, en 70 ficheros

   65  .toFixed(2)                    — texto con 2 decimales
   51  reduce / +=                    — acumulación sin redondeo
   47  Math.round(x * 100) / 100      — decimal a dos
   39  Math.round(x * 100)            — céntimos enteros

🔴 12 ficheros MEZCLAN dos o más formas de redondear
   (public/dashboard/js/quotesView.js mezcla las TRES)
```

**Son cuatro convenciones, no las tres que se sabían.** Y una de ellas —`calcVatBreakdown` con
`round2`— es la del camino fiscal, no la de céntimos por línea.

> ⚠️ **Esto toca la decisión ya tomada.** La convención que manda es la de `albaranAFactura.ts:275`
> (céntimo por línea). Aplicarla al PDF no es tocar un fichero: **el motor fiscal
> (`calcVatBreakdown`) tampoco la sigue**, y de él cuelgan el libro registro, el modelo 303 y el
> XML de VeriFactu. No reabro la decisión; señalo su alcance real.

**La lección del propio censo, escrita porque es la familia que muerde:** la primera versión exigía
que la expresión tocara un nombre de dinero, y por eso **no veía** `round2(n)` en
`finalInvoice.service.ts:57` — el helper es genérico y su parámetro se llama `n`. Devolvía 119
sitios y 4 ficheros con mezcla. Contando todo redondeo con factor 100: **202 y 12**. Un censo que
exige demasiado devuelve un número más bajo en vez de declararse ciego.

---

## LA PROPUESTA — escrita, no ejecutada

### A · Leer lo guardado y no recalcular

**Qué se rompe:** el desglose por tipo de IVA se construye hoy del mismo bucle que el total
(`pdf.service.ts:399-411`). Habría que guardar base y cuota, o seguir recalculando el desglose
mientras el total viene de otro sitio — y entonces el papel podría no sumar.
**Facturas ya emitidas:** cambiaría lo impreso en **1 de 7** de staging (la de `price: 30.003`).
Sobre producción, desconocido: hace falta la consulta de arriba.
**🔴 El defecto que NO arregla:** cambiar «recalcula siempre» por «lee lo guardado siempre» deja el
mismo defecto con la fuente cambiada — **seguiría sin poder detectar la discrepancia**. Si el
guardado está mal, ahora se imprime mal y nadie lo sabe.

### B · Recalcular y COMPARAR, denunciando si difieren

**Qué se rompe:** nada del cálculo. Se añade una comprobación en el camino de emisión, que **es
STOP**: modificar ese camino necesita GO del fundador aunque sea para leer.
**Facturas ya emitidas:** **ninguna cambia de importe.** Se imprime lo mismo que hoy.
**Qué aporta:** es la única de las tres que convierte una divergencia silenciosa en un aviso. La
pregunta a decidir es qué hace al detectarla: registrar y seguir, o negarse a emitir. Negarse
bloquea el cobro de un profesional por un céntimo; registrar no protege a nadie hoy pero deja
rastro. **Recomendación: registrar, y que el aviso llegue al panel de sistema, no al cliente.**
**Coste:** hay que decidir qué convención es «la verdad» para comparar — y ahí vuelve la
MEDICIÓN 3: hoy hay cuatro.

### C · Dejarlo y documentarlo

**Qué se rompe:** nada.
**Facturas ya emitidas:** ninguna cambia.
**Qué cuesta:** el defecto sigue, y **SCRUM-594 lo amplifica**: un descuento porcentual genera
precisamente precios con más de dos decimales, que es el camino por el que la única divergencia
real ha ocurrido. Dejarlo tal cual y abrir el 594 encima es multiplicar los casos.

### Lo que este ticket sí deja hecho, decida lo que decida

El censo con suelo y trinquete (`tests/scrum624-…`): las cuatro convenciones no pueden crecer, la
divergencia de 36,27 / 36,26 queda fijada con números, y si alguien limita los decimales de
`price` el guard lo dice — porque eso cerraría el segundo camino y cambiaría este análisis.

---

## Evidencia

- **Suelo ejercitado de verdad:** en dev, cero documentos → *«NO SUPE MIRAR»*, no «cero divergencias».
- **Control positivo:** el caso construido se caza antes de mirar datos; y el censo caza los cuatro
  sitios que se habían leído a mano, incluido el que su primera versión no veía.
- **Control negativo:** un `Math.round(x)` sin factor 100 y un `toFixed(0)` no cuentan como
  redondeo de dinero.
- **Solo lectura:** ninguna escritura contra ninguna base. Producción no se ha abierto ni nombrado.

---

# SCRUM-624 fase B · EL PAPEL contra la base — y el arreglo es un STOP

**Medido contra:** `origin/main` = `2d826de6d18f7a76be0ef2509c2e469e7b383f54` · 2026-09-04T09:20:00+02:00

## 0 · PASO 0 (regla 39): el defecto EXISTE HOY

```
git ls-tree origin/main | grep -iE 'scrum-?624'
  docs/master/SCRUM-624.md · tests/scrum624-cuantos-sitios-calculan-dinero.test.mjs   [exit 0]
  CONTROL POSITIVO (704) → 3 ficheros                                                 [exit 0]

ramas: scrum-624-total-guardado-vs-recalculado → 0 commits fuera de main (ancestro: SÍ)
  CONTROL POSITIVO discriminante: chore-flujo-pr → 1 commit fuera de main

git log -S'SCRUM-624' origin/main -- src/   →  1 commit, y es de SCRUM-604
  CONTROL POSITIVO: git log -S'SCRUM-704' -- src/ public/  →  4 commits
```

Y la prueba definitiva: **`pdf.service.ts:926` sigue nombrándolo como defecto abierto**. Lo que hay
en `main` es la MEDICIÓN, y su propio registro lo dice: *«ESTE TICKET NO CAMBIA NINGÚN CÁLCULO»*.

**Veredicto: no está arreglado. Se continúa.**

---

## 1 · Qué añade esta fase, y en qué se diferencia de la medición

El censo fijó que las dos **convenciones** divergen, comparando **las dos fórmulas entre sí**. Esto
es otra pregunta: **se genera el PDF de verdad y se lee el número que IMPRIME**, y se compara con el
`total` GUARDADO que se le ha pasado. No se mira la función que calcula: **se mira el papel.**

`generateInvoicePdf` recibe **las dos cosas** —`total` y `lines`— y cuando hay líneas **ignora
`total`** y recalcula (`pdf.service.ts:399-411`). Ése es el defecto en una frase.

### Los dos números, leídos del papel

| caso | guardado | **IMPRESO EN EL PAPEL** |
|---|---|---|
| redondeo por línea · 3 × 9,99 al 21 % | 36,27 € | **36,26 €** |
| decimales del precio · 30,003 (el de staging) | 30,01 € | **30,00 €** |
| ✅ control positivo · 100 € sin IVA | 100,00 € | 100,00 € |

---

## 2 · ⛔ El arreglo es un STOP (regla 38), y por eso aquí sólo entra el guard

Corregir el cálculo **modifica el camino de emisión** y **cambia cifras ya impresas**: SCRUM-623 lo
midió — **547 de 4.006 combinaciones** cambiarían un céntimo. Eso lo decide el fundador, no yo.

Así que las dos divergencias quedan **DECLARADAS con su motivo**, en una lista que **solo puede
menguar** y que canta si aparece una tercera. Y el guard trae la puerta de salida: si un día el
papel imprime el guardado, **falla pidiendo que se borre la declaración** — para que la lista no
envejezca mintiendo, que es lo que me pasó con el trinquete de la cadena.

**La convención que gobierna es la ESCRITA** (céntimo por línea, `albaranAFactura.ts:275`). Lo que
no cuadra con ella es el bucle propio del PDF de factura, que no llama a `calcVatBreakdown`.

---

## 3 · Verificación

**Commit de todo ANTES del rojo: `3b32ddc44367f98a06fe6e596f3c34c2cd8f9dd0`** (verde, 5.021 · 4.937).

Quitando una declaración, el guard cae **nombrando los dos números**:

```
🔴 EL PAPEL DICE UN TOTAL Y LA BASE OTRO.
    guardado: 36,27 €   ·   IMPRESO EN EL PAPEL: 36,26 €
                                                          exit 1
```

**Control positivo enumerado**, uno por uno: línea entera sin IVA · línea entera al 21 % · dos
líneas que no arrastran céntimo · cantidad fraccionada exacta. Los cuatro imprimen su guardado, y si
al corregir la divergencia se descuadra alguno, el guard los nombra.

**Suelo:** si el lector no encuentra un número que SÍ está impreso, se declara ciego — un texto
vacío se leería como «no hay divergencia», que es el falso verde exacto de este ticket.

---

## 4 · 🔴 Un guard ajeno me corrigió una medición, y conviene que conste

`SCRUM-409` cazó mi fixture con `merchantId: 1` — **el merchant DEMO, cuyo PDF lleva marca de
agua**. Cambiado a `7` y **remedido**: los tres números salen idénticos, así que la medición se
sostiene. Pero sin ese guard habría reportado una cifra tomada de **un papel que no es el que ve el
cliente**, y nadie lo habría sabido.

## 5 · Hallazgo de otro carril, reportado y no arreglado (regla 9)

Hay **dos ayudantes para leer el texto de un PDF**: `tests/_pdf-texto.mjs` (`textoDePdf`, devuelve
una cadena, 4 ficheros lo usan) y `tests/_texto-del-pdf.mjs` (`extraerTextoPdf`, devuelve
`{ ok, texto, motivo }` **con suelo**, 13 ficheros). Sus nombres se diferencian en el orden de dos
palabras. Escogí el primero por el nombre y mi propio suelo me lo cazó: sin él habría leído
`undefined.ok` y el guard habría pasado midiendo nada.
