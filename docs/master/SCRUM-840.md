# SCRUM-840 · Qué se puede romper en el camino del dinero sin que caiga ningún test

**Medido contra:** `origin/main` = `54ad4a68b807b8f3e22c709947096fd48dd1d4ae` · 2026-09-09T16:31:04+02:00
**Rama:** `scrum-840-la-tanda-en-el-camino-del-dinero`

> ⚠️ **Esta lista caduca.** La Sesión 1 está escribiendo AHORA en este camino (SCRUM-729). Por eso
> el SHA de arriba no es decoración: es la única forma de saber si lo de abajo sigue siendo cierto.

---

## 0 · La pregunta, y por qué no es un porcentaje

La automatización va a empezar a escribir código sola. A partir de ese día **la tanda es lo único
que separa un robot de un desastre silencioso**, y donde vive el dinero es la emisión fiscal.

Por cada punto, una pregunta: **si rompo esto, ¿cae algún test, y CUÁL?** La entrega no es una
cifra —una cifra se celebra— sino **la lista de puntos donde la respuesta es «no cae ninguno»**.

## 1 · El método, y sus dos límites dichos por delante

**Mutación, no cobertura de líneas.** Una línea «cubierta» sólo dice que alguien pasó por ella;
mutarla dice si alguien la estaba **mirando**.

| decisión | por qué |
|---|---|
| se muta `dist/`, **nunca `src/`** | regla 38: el camino de emisión fiscal **no se toca**. Y el `npm run build` cuesta **51 s**, así que mutar el fuente era inviable en bucle |
| el original se restaura y **se verifica byte a byte** | contrato de `meta:mutaciones` |
| **centinela en disco** mientras hay una mutación puesta | ver §6: no es hipotético, saltó DOS veces |
| dos escalones: tests **directos** → tests **transitivos** | un test que no importa el módulo ni de rebote **no puede** notar la mutación, así que los transitivos son la población completa de un «vivo». Pero correrla entera por mutante cuesta ~40 s y la mayoría muere con los directos |

**Los tres operadores**, elegidos por ser el cambio de comportamiento **más pequeño** que existe —un
destrozo lo caza cualquier cosa y no mide nada—: invertir un comparador o un lógico, **quitar un
`throw`**, y voltear un booleano.

### ⛔ Lo que este método NO responde

1. **No dice si el test que cae comprueba lo correcto.** Dice que **algo** se dio cuenta.
2. **Un mutante «vivo» puede ser equivalente**: código cuyo cambio no altera el comportamiento
   observable. Se separan abajo los que son claramente artefacto.
3. **No cubre lo que ningún test importa**, ni de rebote — pero eso también se mide (§2).

## 2 · El primer hallazgo, sin mutar nada

**Cuatro ficheros del camino no tienen NI UN test que los importe directamente.** Sólo los alcanzan
tests que llegan de rebote:

```
domain/criterioDelMerchant.js      app/routes/invoice.routes.js
domain/cerrojoSaturado.js          app/routes/libroRegistro.routes.js
```

## 3 · 🔴 LA LISTA · lo que se rompe sin que caiga nadie, ordenado por lo que pasa si se rompe

**467 de 500 puntos medidos** · 31/31 ficheros · `pdf.service.js` incompleto (ver §5).

| | |
|---|---|
| **muertos** — cae un test, y el instrumento **dice cuál** | **261** |
| vivos | **206** |
| — artefacto de `tsc` (`__esModule`): ruido de mutar `dist/` | 29 |
| — proyecciones de Prisma (`select: { x: true }`) → §4, hallazgo aparte | 68 |
| **— LÓGICA DE PRODUCTO que nadie caza** | **109** |

### El filtro que decide el trabajo de esta semana

Se cruzan las dos condiciones. **(b) no se opina, se mide**: la función que contiene el punto
tiene que estar **exportada** y su cuerpo **no tocar `prisma`** — si necesita base, ya no cabe «en
un test».

```
109 puntos de lógica viva
 ├─ 41  ✅ función exportada y SIN prisma  → cabe en un test
 ├─  5  🔴 exportada pero toca prisma      → hace falta base de datos
 └─ 63  ⚠️ no exportada, o dentro de una función que no supe localizar
```

### 🔴 (a) Y (b) — ESTOS SON EL TRABAJO. Cambian lo declarado o el importe, y caben en un test

| punto | función | qué se rompe |
|---|---|---|
| `verifactu.service:143·144·146` | `exigirTipoDeclarable` | **qué documento se declara y COMO QUÉ TIPO**. Es el vector de SCRUM-413: un justificante declarado como F1 |
| `verifactu.service:497 ×4 · 498` | `buildVerifactuRegistrosXml` | se emite **sin productor configurado**: el XML declara un productor que no está |
| `verifactu.service:521` | `buildVerifactuRegistrosXml` | **qué anulaciones entran** en el XML (`vfAnulHash && vfAnulTimestamp`) |
| `verifactu.service:529` | `buildVerifactuRegistrosXml` | **el nombre del emisor declarado** (`legalName \|\| name`) |
| `verifactu.service:58` | `formatFechaHoraHuso` | **el signo del huso** en la marca temporal declarada |
| `verifactu.service:483` | `buildVerifactuRegistrosXml` | el límite `verifactu_demasiados_registros` del envío |
| `selladoEstado:68 ×3` | `entraEnLaCadena` | **si la factura entra o no en la cadena** (ES + NIF + no rectificativa) |
| `recargoEquivalencia:78·84` | `calcularRecargo` | **el importe del recargo** que va en la factura |
| `recargoEquivalencia:122` | `leerRecargoDelCliente` | si el cliente lleva recargo |
| `retencionIrpf:135` | `leerTipoRetencion` | **la retención** de la factura |
| `criterioCaja:66` | `clasificarPorCobro` | **la cuota** declarada por criterio de caja |
| `criterioCaja:93` | `leerCriterioCaja` | si el merchant va por criterio de caja |
| `facturaSuelta:84·89` | `validarFacturaSuelta` | precio negativo y tipo de IVA fuera de rango **pasan** |
| `finalInvoice.service:56` | `buildFinalInvoice` | el signo de la línea «menos anticipo facturado» |
| `suplidos:99` | `leerMarcaSuplido` | los suplidos, que salen de la base imponible |
| `vistaPreviaSerie:48 ×2` | `vistaPreviaSerie` | la validación de la secuencia F — **numeración** |
| `huecosSerie:72` | `huecosDeLaSerie` | el `truncado` de los huecos de serie |
| `libroRegistro:94·99·102·108·110·127` | `construirLibroRegistro` | **el libro registro**, que es una declaración |
| `libroRecibidas:124·139` | `construirLibroRecibidas` | ídem, el de recibidas |

**Son 31 puntos en 13 funciones.** Todas exportadas y sin base de datos: **un test las llama y ya**.

### Cumplen (a) pero NO (b) — necesitan base, así que no caben en un test

`invoiceNumber.service:316` (`allocateInvoiceNumber`, **la serie por año**) ·
`verifactu.service:314` (`applyVeriFactuAnulacion`) · `libroRegistro.repo:87·94·105`.

🔴 **El de la serie por año es el más caro de la lista y es el que no cabe.** Va al mapa, no a la
semana.

### Cumplen (b) pero NO (a) — caben, pero no tocan lo declarado

`pdf.service:224·230·315·317` (`generateInvoicePdf`). Es el documento **que ve el cliente**, no lo
que se declara. `:315` (`Number(l.tax) || 0`) es el que más se acerca a importar.

### Los 4 que no supe localizar en el fuente, y digo cuáles son

`invoiceNumber.service:137` (`return false; // corte apagado`), `:276` (`merchant_not_found`), y
`verifactu.service:234` y `:329` — **las dos puertas de `verifactu_seal_inside_transaction`**.
Están dentro de funciones que mi localizador no casó entre `dist` y `src`; el punto está medido y
vivo, lo que no tengo es la clasificación (a)/(b) automática. Las dos puertas de sellado dentro de
transacción son, a ojo, de las más serias de todo el informe.

**Se dejan MEDIDAS Y SIN CLASIFICAR a propósito**, y su gravedad la juzga la Sesión 1, que es
quien conoce ese camino. Inventarles una clasificación que mi instrumento no supo derivar sería
exactamente el tipo de dato que parece medido y no lo está.

## 4 · Las 68 proyecciones de Prisma NO son lógica — y son otro hallazgo

Que `select: { id: false }` no rompa nada **no** dice que falte un test de esa línea: dice que
**ese camino no se ejercita contra una base de datos en la tanda**. Es un hallazgo distinto, de otra
familia, y va aparte: meterlo en la lista sería exactamente el porcentaje que este ticket no quiere.

## 5 · Lo que cuesta el motor, y si cabe en un PR

**Medido, no estimado:** 110 puntos en **31,9 min** → **17,4 s por punto**. Y el coste por llamada,
medido aparte: 67 ficheros de test en UNA sola llamada a `node --test` son **31,4 s**, o sea **0,47 s
por fichero de test**. De ahí sale el coste de cualquier fichero:

```
coste ≈ muertos × (0,5 + 0,47·directos) + vivos × (0,5 + 0,47·directos + 0,5 + 0,47·transitivos)
```

| fichero | puntos | vivos | directos | transitivos | coste |
|---|---|---|---|---|---|
| `verifactu.service.js` | 73 | 46 | 11 | 57 | **27,8 min** |
| `invoiceNumber.service.js` | 37 | 15 | 14 | 76 | 13,4 min |
| `pdf.service.js` | 53 | — | 17 | 92 | ~10,5 min |
| … | | | | | |
| `finalInvoice.service.js` | 9 | 3 | 1 | 1 | **0,2 min** |

**Camino entero: 109 min. Mediana por fichero: 1,4 min.**

### ¿Sería viable correrlo sobre lo que toca un PR antes de mergear?

**No es disparatado — pero sólo sobre el DIFF, no sobre el fichero entero.**

* Sobre **el fichero entero**: la mediana (1,4 min) cabe de sobra al lado de la tanda, que ya tarda
  ~9 min. Pero un PR que toque `verifactu.service.js` costaría **28 min**, y eso no lo aguanta nadie.
* Sobre **las líneas que el PR cambia**: un PR típico mueve 10-30 líneas, que dan del orden de
  **5-15 puntos** → **1,5 a 4,5 min**. Ése sí cabe, y es la misma escala que el CI de hoy.

⚠️ **Y hay una propiedad que lo hace más atractivo de lo que parece:** el coste lo pagan **los
supervivientes**, porque son los únicos que escalan al barrido transitivo. Un PR cuyas líneas están
bien cubiertas muere rápido y cuesta segundos. Uno cuyas líneas **no** están cubiertas paga el
barrido entero — que es exactamente cuando quieres que alguien mire.

> 🔒 El instrumento es más lento justo cuando tiene algo que decir.

**Lo que haría falta antes**, y no lo he construido: mutar sólo las líneas del diff, tener `dist/`
compilado (51 s, que el CI ya paga) y la disciplina del centinela — porque un mutador que muere a
mitad en CI deja el artefacto tocado para el siguiente job.

## 6 · 🔴 El instrumento, otra vez, antes que el árbol

Dos incidentes propios, los dos con el mismo patrón y los dos contados:

1. **Maté el motor a mitad de una mutación** y el `finally` pudo no correr. Comprobado: aquella vez
   `dist/` estaba intacto. **De ahí salió el centinela.**
2. Y a la segunda **el centinela saltó de verdad**: `invoice.routes.js` quedó mutado
   (`sha1 794a485e`) y se restauró regenerando desde `src/` (`33c97169`). Sin el centinela, la
   siguiente medición habría corrido **sobre un árbol mutado** y yo habría publicado esos números.

> 🔒 Un instrumento que muta el árbol necesita saber, al arrancar, si la vez anterior murió a mitad.
> Restaurar en un `finally` cubre el fallo ordenado; no cubre el que te mata el proceso.

## ⛔ No tocado

**Ni un test nuevo** (eso es otro ticket, y de quien conoce el camino) · **`src/` intacto**,
verificado con `git status` · el camino de emisión **sólo se ha leído** · ningún ticket nuevo por
cada hueco (regla 37): **una lista, y sólo se convierte en ticket lo que tenga víctima**.
