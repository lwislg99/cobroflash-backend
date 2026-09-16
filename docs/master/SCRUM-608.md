# SCRUM-608 · ALB-03 · Tipo de documento en la cabecera del PDF

**Fecha:** 6-sep-2026 · **Carril:** producto (documentos) · **Gate:** sin gate
**Medido contra:** `origin/main` = `590e019d2dedb4a951237e37396d7b0c265bef23` · 2026-09-06T06:23:40+01:00
**Tanda:** 5526 tests, 5438 pass, 0 fail, 88 skipped

---

## 🔴 EL TICKET LLEGÓ YA HECHO. Lo que se entrega es el guard, no la cabecera.

SCRUM-608 pedía que el PDF dijera arriba **Albarán** / **Presupuesto** / **Factura**, y daba por
hecho que sólo el presupuesto lo hacía. **Medido: los tres ya lo decían**, y desde antes de que el
ticket existiera. Su propia descripción lo anticipa sin saberlo: *«el documento solo declara el
estado del PDF de presupuesto […] no dice qué muestran hoy la cabecera del PDF de factura ni la de
albarán»*. Nadie lo midió al abrirlo, y la suposición se escribió como estado.

**Ni una línea del generador de PDF ha cambiado.** No hacía falta, y tocarlo habría sido peor que
no hacer nada (ver ① más abajo).

---

## ① ¿EL PDF DEL ALBARÁN SE REGENERA AL VERLO? — SÍ. Y no está leído: está PROVOCADO.

`src/modules/jobs/domain/albaran.service.ts:788` es la puerta entera:

```ts
if (!force && albaran.pdfUrl === pdfUrl && fs.existsSync(diskPath)) {
  return { diskPath, pdfUrl, numero: albaran.numero };
}
```

Es la misma forma que `src/lib/invoicing.ts:72` (`!fs.existsSync(diskPath)` dentro de `needs`), y
`src/lib/invoicing.ts:25` declara que **el fs de Railway es efímero**. O sea: tras un despliegue el
fichero no está, y el papel se vuelve a fabricar con el código del momento.

**Provocado** llamando al `ensureAlbaranPdf` real (compilado) con un `prisma` falso sembrado en
`require.cache`, sobre un albarán **v:3 FIRMADO** (con `contentHash` y bloque congelado):

| caso | montaje | resultado | esperado |
|---|---|---|---|
| 0 · control positivo | fichero ausente | se genera; primera línea `ALBARÁN / PARTE DE TRABAJO` | se genera |
| 1 · **control negativo** | fichero presente con un centinela dentro | el centinela sobrevive intacto | **NO** regenera |
| 2 · **el que decide** | fichero ausente **+ generador mutado** | primera línea `XXXX-CABECERA-MUTADA` | sale con cabecera nueva |

El caso 1 es lo que hace que el rojo del caso 2 signifique algo: la puerta no está siempre abierta,
así que el cambio del caso 2 lo produjo la mutación y no el montaje. La mutación vivió sólo en
`dist/` y se restauró con `Buffer.compare = 0`.

> 🔴 **CONSECUENCIA, y va al asesor, no a esta sesión:** el albarán está en el mismo sitio que la
> factura de **SCRUM-762**. Cambiar la cabecera de un albarán habría cambiado el aspecto de
> albaranes **ya firmados** — regla 29 — sin que nadie lo decidiera. Como el ticket no necesitaba
> cambio de cabecera, el STOP **no se ha llegado a cruzar**: queda escrito porque la próxima
> sesión que quiera tocar esa maqueta se lo encuentra aquí. `ensureAlbaranPdf` **no** aparece en
> SCRUM-762, que sólo mide la factura y deja `ensureQuotePdf` como hueco; ahora hay un tercero
> medido.

---

## ② LA FRONTERA FISCAL EXACTA, medida sobre el código

**La frontera NO es el fichero.** `src/modules/invoicing/infra/pdf/pdf.service.ts` contiene **los
dos**: el generador fiscal y el del presupuesto, que no lo es. El albarán sí vive aparte
(`src/modules/jobs/infra/albaranPdf.service.ts`), y su propia cabecera dice que es a propósito
(regla 24).

La frontera es **la función**, y las tres cabeceras están en tres sitios disjuntos:

| documento | dónde se decide el rótulo | dónde se pinta | fiscal |
|---|---|---|---|
| factura / rectificativa / justificante | `pdf.service.ts:353` (`docTitle`, `const` local) | `:357-359` | **sí** |
| presupuesto | `pdf.service.ts:717` (`QUOTE_LABEL = locale.quote`) | `:735-736` | no |
| albarán | `albaranPdf.service.ts:152` (literal en el `doc.text`) | `:151-157` | no |

**Lo que cruza la frontera** (los únicos símbolos que el fichero no fiscal toma del fiscal, censo
completo de `import`): `loadLogoBuffer`, `TITULO_OBSERVACIONES`, `partirConceptoYDescripcion` y el
tipo `ParamsPdfPresupuesto`. **Ninguno interviene en el rótulo.** `loadLogoBuffer` es el único que
entra en la banda de cabecera, y pinta el logo, no el título.

⇒ Una cabecera se puede tocar sin rozar a las otras dos, **pero no se puede DERIVAR de las otras
dos sin exportar algo de `pdf.service.ts`**, que es modificar el camino de emisión: STOP (AA1.4 /
regla 38). Eso decide la forma del guard (ver más abajo).

---

## ③ REQUISITO POR REQUISITO, contra el árbol de hoy

Los tres generadores se llamaron de verdad y se leyó el PDF resultante con el lector oficial de la
suite (`tests/_texto-del-pdf.mjs` · `lineasDePdf`, que devuelve las líneas **con su posición**).
**Primera línea de la página**, la de `y` mayor:

| variante | primera línea | segunda línea | ¿dice qué es? |
|---|---|---|---|
| factura `F1` | `FACTURA` | `Nº 2026-CF-000` | ✅ |
| factura `R1` | `FACTURA RECTIFICATIVA` | `Nº …` | ✅ |
| justificante `JUST` | `JUSTIFICANTE DE COBRO` | `Ref. …` | ✅ |
| presupuesto `country=ES` | `Presupuesto` | `Presupuesto #32` | ✅ |
| presupuesto `country=MX` | `Cotización` | `Cotización #32` | ✅ |
| presupuesto `country=null` | `Presupuesto` | `Presupuesto #32` | ✅ |
| albarán `VALORADO` | `ALBARÁN / PARTE DE TRABAJO` | `Albarán X1 · Versión 1` | ✅ |
| albarán `SIN_VALORAR` | `ALBARÁN / PARTE DE TRABAJO` | `Albarán X2 · Versión 1` | ✅ |
| albarán sin precios (ALB-02) | `ALBARÁN / PARTE DE TRABAJO` | `Albarán X3 · Versión 1` | ✅ |

**Control positivo y negativo del lector** en la misma pasada: sobre el PDF de factura,
`contiene("FACTURA")` = `true` y `contiene("ZZZ-NO-EXISTE")` = `false`. Un lector que dijera que sí
a todo, o que fuera ciego, se habría visto ahí.

**Censo de generadores de PDF, completo:** 3 `new PDFDocument` en `src/`, 3 funciones
`generate…Pdf`, 2 ficheros que importan `pdfkit`. No hay un cuarto papel sin medir.

**Y desde cuándo** (`git log -L` sobre cada línea del título):

| documento | commit que lo puso | fecha |
|---|---|---|
| presupuesto | `ece3279d` | 22-may-2026 |
| factura | `2aef59b6` | 11-jun-2026 |
| albarán | `77dbb674` (SCRUM-14) | 12-jul-2026 |

El ticket se abrió el **24-ago-2026**: los tres rótulos le llevaban entre seis semanas y tres meses
de ventaja. **El ticket nació satisfecho.**

**La premisa del encargo, corregida:** *«hoy un albarán y un presupuesto salen con la misma
cabecera»* — no es así. Abren con `ALBARÁN / PARTE DE TRABAJO` y `Presupuesto`, y ninguna de las
tres cabeceras coincide con otra.

---

## La decisión, y por qué

**No se toca el generador. Se entrega el guard.** El requisito estaba cumplido por tres literales
sueltos en dos ficheros **sin un solo assert encima**, y eso, aquí, es peor que en otro sitio: por
① una regresión en la cabecera no estropea sólo los papeles futuros, **reescribe el aspecto de los
ya firmados** en cuanto alguien los abre después de un despliegue.

`tests/scrum608-tipo-de-documento-en-la-cabecera.test.mjs` afirma sobre la **primera línea de la
página**, no sobre «el texto contiene»: «contiene» daría verde con la palabra escondida en el pie
legal, que es exactamente donde no sirve.

**Derivar vs. duplicar, con la imposibilidad MEDIDA:**

* El rótulo del **presupuesto SÍ se deriva** — de `getLocale(country).quote`, su propia fuente. No
  es una copia del literal: exige que la cabecera **siga al país**, cosa que un literal `'Presupuesto'`
  no probaría. El guard comprueba además que `ES` y `MX` den rótulos distintos, o el bucle no
  habría probado nada.
* Los de **factura y albarán se duplican en el guard** (escalón 3, con su comentario). La razón no
  es de calendario: `docTitle` es una `const` **local** dentro de `generateInvoicePdf` y el del
  albarán es un literal dentro de su `doc.text`. Derivarlos exige **exportarlos**, o sea modificar
  el camino de emisión → STOP. Queda escrito en el propio fichero.
* Y hay un test que **no duplica ningún literal**: los tres papeles no comparten cabecera. Es la
  víctima del ticket comprobada sin nombrar ni una palabra.

---

## Verificado en rojo

Las tres mutaciones están **declaradas** en el guard (`MUTACIONES_QUE_ME_TUMBAN`, contrato de
SCRUM-745) y las ejecuta `npm run meta:mutaciones`:

| mutación | qué imita | test que cae |
|---|---|---|
| el albarán abre diciendo `Presupuesto` | la víctima literal de ALB-03 | `el ALBARÁN dice ALBARÁN arriba del todo, en sus tres modos` |
| `docTitle` pasa a `'Documento'` | la factura deja de nombrarse | `la FACTURA dice FACTURA arriba del todo` |
| `QUOTE_LABEL` pasa a `'Documento'` | el presupuesto deja de seguir al país | `el PRESUPUESTO dice su tipo, y lo dice en el idioma del país` |

**Corrido TRES veces** (el meta-guard estaba bajo sospecha de oscilar): las tres pasadas dan el
mismo número — `vivas 22 · mudas 0 · ciegas 0`, salida 0. Las tres mías salen **vivas** en las tres.

**Las mutaciones apuntan a `dist/`, y está medido por qué:** este guard corre contra el compilado
—es la única forma de leer un PDF de verdad—, así que mutar el `.ts` no cambiaría nada de lo que
ejecuta y el meta-guard dictaría **MUDO sobre un guard sano**. Se muta el árbol que se corre.
`dist` está en `.gitignore`, así que la mutación no puede llegar a un commit ni por descuido.

Y contra el defecto 757 del meta-guard (*ignora en silencio una declaración con forma propia*): hay
un test que le pregunta **al lector oficial** —`mutacionesDeclaradas`, importado de
`scripts/meta-guard-mutaciones.mjs`— si ve las tres, y que además comprueba que cada ancla siga
existiendo en su fichero.

---

## Lo que NO cubre — huecos declarados

* **La cabecera del presupuesto no lleva FECHA.** La evidencia del ticket describe Holded como
  «Presupuesto» + *Número # / Fecha / Vencimiento*, y el nuestro lleva título + número y nada más
  (`vencimiento`/`válido hasta` = **0 apariciones** en `pdf.service.ts`, con control positivo:
  `docTitle` = 2). **No se ha tocado:** el «Qué hace» de ALB-03 es sólo el tipo de documento, y el
  vencimiento es el carril de DOC-15 (SCRUM-605). Se deja escrito, no arreglado.
* **La numeración no se ha rozado.** Ni el formato `AB260001` ni el candado de SCRUM-361. Los
  números del guard son atrezo con una forma que ningún guard de serie reconoce.
* **Los dos tests de `tests/albaran.test.mjs` gateados por `QA_DB_TEST` siguen saltando** y este
  trabajo no los toca ni los mide. Su hueco sigue exactamente donde estaba.
* **No hay medición en navegador ni caja de microcopy**, y no es un olvido: no se ha escrito ni una
  palabra nueva. Los tres rótulos llevan meses impresos y salen del árbol tal cual.
* **La vista pública del albarán** (`albaranPublicVista.ts`) no entra: ALB-03 habla del PDF. No se
  ha medido si esa pantalla dice el tipo de documento.
* **La regeneración del PDF de PRESUPUESTO** no se ha provocado (SCRUM-762 la declara como hueco y
  aquí sigue siéndolo). Sólo se ha provocado la del albarán.

---

## Ficheros

| fichero | qué |
|---|---|
| `tests/scrum608-tipo-de-documento-en-la-cabecera.test.mjs` | **nuevo** · el guard (7 tests) y sus tres mutaciones declaradas |
| `docs/master/SCRUM-608.md` | **nuevo** · esta entrada |

**Ni un fichero de `src/` cambia.** El generador de PDF —camino de emisión— sólo se ha leído.
