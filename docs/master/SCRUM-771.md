# SCRUM-771 · El emisor aceptaba el tipo de IVA que le dieran

**Fecha:** 6-sep-2026 · **Carril:** producto / fiscal (capa de ANTES) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `00c6cb0cc328eb88cea26bc4b672ebad25e51a47` · 2026-09-06T07:41:15+01:00

---

## DE DÓNDE SALE

De un hallazgo de SCRUM-760, dejado por escrito al cerrarlo:

> `albaranes.routes.ts:1148` entrega `tax: l.tipoIva / 100` a `emitInvoice`, y `invalidTipoIva` /
> `TIPOS_IVA_ES_BP` **no aparecen ni en `invoicing/` ni en `fiscal/`**. Cierro aguas arriba; que el
> emisor valide es su ticket.

Éste es su ticket. 760 tapó **una** puerta —la de la voz—. Cualquier otra boca llegaba a la fila
de la factura sin que nadie mirase el número. Y aquí ya no es una casilla mal pintada: es un
**documento fiscal con un tipo de IVA que nadie comprobó**, con su número de serie gastado.

---

## 🔴 EL ROJO, POR EL CAMINO REAL Y **NO** POR LA VOZ

«La mano»: `POST /admin/invoices` (factura suelta). Handler REAL, emisor REAL, y la BASE DE DATOS
doblada por el punto que el propio código ofrece — `prisma.ts` cachea su instancia en
`global.prisma` cuando `NODE_ENV !== 'production'`. **No se tocó ninguna base.**

```
tax = 1     (100 %) → HTTP 201 · factura ESCRITA
tax = 0.15  ( 15 %) → HTTP 201 · factura ESCRITA
tax = 0.5   ( 50 %) → HTTP 201 · factura ESCRITA
```

Salida literal del control con el portón quitado (mutación M2, ya con el ticket hecho — es el
mismo estado que tenía `main`):

```
✖ SCRUM-771 · 🔴 EL CONTROL QUE DECIDE: un 100 % por «la mano» NO llega a emitirse
  AssertionError: 🔴 SE HA ESCRITO UNA FACTURA CON UN 100 % DE IVA. […]
  Fila escrita: {"merchantId":71,"customerId":7,"quoteId":null,"number":"2026-CF-007",
  "type":"F1","total":"200.00","currency":"EUR",
  "lines":[{"concept":"Reparación de bajante","qty":1,"price":100,"tax":1}], …
```

**Por qué pasaba:** la puerta de la suelta (`facturaSuelta.ts:132`) sólo miraba el **RANGO** —
`tax < 0 || tax > 1`. Y `1 > 1` es **falso**: el 100 % entraba **por el borde**. El 15 % ni
siquiera rozaba el borde.

---

## EL CENSO DE BOCAS — derivado, no escrito a mano

La población **no se enumera a mano**: se ancla en `allocateInvoiceNumber`, y quien garantiza que
ésa es la población COMPLETA es **SCRUM-203** («ninguna creación de factura se salta el embudo»).
Es la misma forma que usa SCRUM-246 para su portón de líneas.

**Medido: 7 bocas del embudo + 4 llamadores de `emitInvoice`.**

| camino | dónde | ¿portón? |
|---|---|---|
| `C1` | `quotes.routes.ts:635` | ✅ |
| `C2` | `jobs.routes.ts:1198` | ✅ |
| `C3` | `quotesAdmin.routes.ts:205` | ✅ |
| `C4` | `quotesAdmin.routes.ts:408` | ✅ |
| **`C5`** | `invoicesAdmin.routes.ts:923` (rectificativa) | ⛔ **excepción declarada** |
| `C6` | `lib/invoicing.ts:318` | ✅ |
| *(delega)* | `invoicing.service.ts:79` = `emitInvoice` | exento, sus llamadores se comprueban |
| `C7-parcial` | `albaranes.routes.ts:1159` | ✅ ← **la boca de SCRUM-760** |
| `C7-albaran` | `albaranes.routes.ts:1369` | ✅ |
| `C7-recapitulativa` | `recapitulativa.service.ts:94` | ✅ |
| `C7-suelta` | `invoicesAdmin.routes.ts:125` | ✅ |

**NUEVE bocas con portón.** El censo cruza su recuento con el analizador oficial de SCRUM-203 y
falla si no cuadran; y si un `camino`/`origen` no se puede leer por AST, **no lo da por bueno: se
declara CIEGO y falla**.

✅ **Control positivo del censo:** tiene que encontrar la boca que ya conocíamos (`C7-parcial` en
`albaranes.routes.ts`). Si no la encuentra, está ciego, devuelva la lista que devuelva.

---

## 🔴 LA ÚNICA EXCEPCIÓN, Y NO ES UN DESCUIDO: LA RECTIFICATIVA (C5)

Medido: la R1 construye sus líneas **copiando las de la ORIGINAL**, tipo de IVA incluido:

```js
origLines.map((l) => ({ ...l, price: -(Number(l.price) || 0) }))
```

Si una factura **ya emitida** lleva un tipo imposible —que es exactamente el daño que este ticket
impide de aquí en adelante—, poner el portón ahí **bloquearía la R1**. Y la R1 es lo **ÚNICO** con
lo que se corrige una factura emitida (regla 29: no se edita ni se borra).

O sea que gatear la R1 no evitaría ningún daño nuevo y dejaría el daño viejo **sin arreglo
posible**.

**Y no abre puerta:** para colar un tipo imposible por una R1 haría falta una ORIGINAL con ese
tipo, y **todas las bocas que emiten originales sí están gateadas**. El censo exige que la
excepción siga existiendo en el árbol: si desaparece, la exención sobra y hay que borrarla.

---

## DÓNDE SE VALIDA — y por qué NO hizo falta parar

🔴 **EN EL LLAMADOR, NUNCA DENTRO DEL EMISOR.** El portón nuevo vive en
`src/core/validation/tiposIvaEmitibles.ts` —la capa de ANTES, la misma que declara su vecino
`fiscalInput.ts`— y lo llama cada boca justo antes de pedir número, pegado a
`exigirLineasFacturables` (SCRUM-246) y por la misma razón: descubrirlo con el número ya gastado
deja dos salidas y las dos son malas.

**No hubo que parar.** Las nueve bocas viven fuera de `invoicing/` y de `fiscal/`, así que la
colocación correcta era alcanzable sin tocar el camino de emisión. **Ni un carácter dentro de
`invoicing/` ni de `fiscal/`.**

### ⚠️ EL ÚNICO JUICIO QUE PIDO QUE REVISES: `src/lib/invoicing.ts` (C6)

Está **fuera** de `invoicing/` y de `fiscal/` por directorio, que es como estaba escrita la regla.
Pero por sustancia es emisión: crea la factura y luego la sella (`applyVeriFactu`,
`sellarTrasEmision`). Lo que inclinó la decisión es que **SCRUM-246 ya puso ahí el portón hermano**
(`exigirLineasFacturables`, línea 315), así que hay precedente de que una comprobación
PRE-emisión vive en ese fichero. Mi línea va pegada a la suya. **Si lo consideras camino de
emisión, dímelo y la retiro: es una línea y su import.**

---

## EL PORTÓN JUZGA EL VALOR QUE EL EMISOR VA A USAR

`calcVatBreakdown` (`vat.service.ts:54`) —de donde salen la base, la cuota y el `CuotaTotal` que se
sella en la huella— hace:

```js
const taxFrac = Number(l?.tax) || 0;
```

El portón usa **esa misma coerción**, y es deliberado: si juzgara un valor distinto del que se va a
cobrar, **rechazaría líneas que el sistema calcula perfectamente** (una línea exenta sin campo
`tax` es 0 % para el calculador). Lo que **no** se duplica es *qué tipos existen*: eso lo decide
`invalidTipoIva` y nadie más. **Aquí no hay lista: hay una llamada.**

---

## 🔴 HALLAZGO: LA LISTA CABLEADA DE SCRUM-246 SE QUEDÓ CORTA

Medido, por AST, sobre el árbol de hoy:

```
LLAMADORES DE emitInvoice (reales, 3 ficheros):
  albaranes.routes.ts · recapitulativa.service.ts · invoicesAdmin.routes.ts
LLAMADORES_DE_EMIT (cableados en scrum246, 2 ficheros):
  albaranes.routes.ts · recapitulativa.service.ts
🔴 EN EL ÁRBOL Y NO EN LA LISTA: invoicesAdmin.routes.ts
```

`invoicesAdmin.routes.ts` (C7-suelta) entró después (SCRUM-289/346) y **aquella lista no creció**.
Su camino está protegido de hecho (llama a `exigirLineasFacturables` en la línea 122), pero **nada
lo afirma**: el guard de SCRUM-246 no lo mira. Es una lista escrita a mano que caducó en silencio.

**No lo he arreglado** —está fuera del alcance de este ticket—, pero **mi censo no repite el
error**: la lista se DERIVA del árbol, y la comprobación es **POR LLAMADA y no por fichero**. Eso
importa aquí más que en ningún sitio: `invoicesAdmin.routes.ts` tiene DOS bocas (la suelta y la
rectificativa), así que un control por fichero pasaría en verde con **una sola** protegida. La
mutación ② lo demuestra.

**Queda propuesto como ticket propio.**

---

## MICROCOPY

**NO APLICA — no hay texto nuevo en pantalla, y por eso no hay marcador ni caja medida.**

El rechazo es **FALLO CERRADO**: el portón lanza, cae en el `catch` que la ruta ya tenía, **no se
emite documento** y el motivo —que **NOMBRA el valor**, porque sale de `invalidTipoIva`— queda en
el log del servidor:

```
[POST /admin/invoices] tipo_iva_no_emitible: línea 1: el IVA 100 % no es un tipo de IVA
español. Admitidos: 0 %, 2 %, 4 %, 5 %, 7.5 %, 10 %, 21 %
```

Al profesional le llega el `500 internal_error` que la ruta ya devolvía para cualquier error no
tipado. **Traducirlo a un 4xx con su texto es microcopy y la firma el fundador (regla 30)**:
`exigirLineasFacturables` tiene su `COPY_ADMIN_SIN_LINEAS` aprobado, y esto necesitaría el suyo.
**Va en su propio ticket, con marcador, contador y caja medida a 929 y 390 px.**

Mientras tanto la elección es la conservadora: **mejor un 500 que una factura mal emitida.**

---

## ✅ CONTROL POSITIVO — el filo

Los **SIETE** tipos españoles `{0, 2, 4, 5, 7,5, 10, 21}` siguen pasando, **uno a uno**, y por
partida doble: en el portón puro **y por el camino real** (HTTP 201, `tax` intacto en la fila). El
2 %, el 5 % y el 7,5 % están ahí por las rectificativas de aquellas ventanas: un portón que los
tirase rompería una rectificativa. La mutación M3 lo demuestra vivo.

---

## MUTACIONES

### Declaradas al meta-guard — 3, las 3 VIVAS

| # | qué imita | cae |
|---|---|---|
| ① | se quita el portón de UNA boca (C7-recapitulativa) | el censo |
| ② | se quita el portón de C7-suelta, **dejando la otra boca del mismo fichero** | el censo (prueba que mira por LLAMADA, no por fichero) |
| ③ | nace una SEGUNDA copia de la lista de tipos | el censo de un solo fichero |

`npm run meta:mutaciones` — **corrido TRES veces**: **vivas 34 · mudas 0 · ciegas 0** en las tres,
idénticas. No se ha reproducido la oscilación de SCRUM-754.

### 🔴 EL REPARTO, Y ES POR UN LÍMITE MÍO TODAVÍA ABIERTO

`meta-guard-mutaciones.mjs` muta el fuente y corre el guard **SIN RECOMPILAR** (hallazgo declarado
en SCRUM-760, con ticket propio y **sin cerrar**). Por eso al corredor **sólo** se le declaran las
mutaciones cuyo test **lee el FUENTE por AST** —los dos censos—, y un assert del propio fichero lo
hace cumplir: si alguien declara una que cae en un test que importa de `dist/`, **el test falla
diciendo que esa mutación va a mano**.

Las demás se corrieron **A MANO, recompilando entre pasos**, verificando `sha256` del fuente y que
el árbol recompila:

| # | mutación | rojos |
|---|---|---|
| **M1** | se quita el portón de C7-recapitulativa | 2 |
| **M2** | se quita el portón de C7-suelta | 3 — **incluido EL QUE DECIDE**: vuelve a emitirse el 100 % |
| **M3** | el portón trae su propia lista `{0, 10, 21}` | 6 — **incluido el CONTROL POSITIVO de los siete** |
| **M4** | la coerción deja de ser la del emisor (fuera el `\|\| 0`) | 1 — sólo el suyo |
| **M5** | el rechazo deja de nombrar el valor | 3 |
| **M6** | segunda copia de la lista de tipos | 1 — sólo el suyo |

Las seis restauraron fuente con `sha256` idéntico y árbol que compila. **M4 y M6 caen en un solo
test**: que cada mutación caiga por lo suyo es la señal de que los tests miden cosas distintas.

---

## LO QUE ME CAZÓ A MÍ

**SCRUM-409** (`ningún fixture usa el merchant DEMO`). Mi doble usaba `merchantId: 1` y
`demo@yaqu.app`. El guard tiene razón y **se cambió el fixture, no el guard**: el demo no se
comporta como un merchant normal —marca de agua en el PDF, política de WhatsApp por id, pasarela
desviada—, así que el control habría medido otra cosa. Ahora usa un id inventado (71).

Y **mi propio control positivo me cazó a mí**: los siete tipos válidos daban 500 con el portón ya
puesto. No era el portón — era que mi doble de BD no tenía `invoice.update`, que el sellado
posterior necesita. **El rojo acusaba al caso, no al producto.** Igual con la segunda tanda de
llamadas: `prisma.ts` resuelve su instancia **una sola vez**, así que reasignar `global.prisma`
entre llamadas no llegaba a nadie. Las dos cosas están escritas en el fichero de test para que no
se vuelvan a descubrir desde cero.

---

## HUECOS DECLARADOS

- **`Number(l?.tax) || 0` convierte la basura en 0 %**, no la rechaza: un `tax: "pepe"` se emite
  como línea exenta. **Es deliberado y está fuera de alcance**: 0 % ES uno de los siete tipos
  válidos, así que no produce un tipo inventado, y rechazarlo cambiaría el comportamiento del
  calculador —que no se toca— y podría bloquear filas antiguas. Queda escrito.
- **El daño anterior no se repara.** Este portón impide emitir de aquí en adelante; **no revisa lo
  ya emitido**. Si hay facturas vivas con un tipo imposible, se corrigen por R1 (y por eso la R1
  queda fuera del portón). **No se ha medido cuántas hay**: exigiría leer una base real, y esta
  sesión no toca ninguna.
- **La respuesta al profesional es un `500 internal_error`.** Fail-closed y correcto, pero pobre.
  El 4xx con su copy es microcopy y necesita firma: ticket propio.
- **La doble unidad de `tipoIva`** (porcentaje en el albarán, fracción en la factura) **no se ha
  tocado**. A la factura siempre llega fracción, así que no estorbó para medir.
- **`Math.max(0, precio)`** de la línea de al lado **sigue siendo un recorte**. Sigue fuera de
  alcance, como en 760.
- **`LLAMADORES_DE_EMIT` de SCRUM-246 sigue corto.** Medido arriba, no arreglado: ticket propio.
- **No hay medición en navegador**: este ticket no toca ni una pantalla.
- **`recapitulativa.service.ts` tenía CRLF en el árbol de trabajo** (134 CR) con el **blob en LF**
  y `git status` limpio — deriva preexistente, no mía. Al tocarlo había que normalizarlo o
  SCRUM-533 lo cazaría. Se normalizó a LF; **el diff no muestra ni una línea de más** porque el
  blob ya estaba en LF.

---

## TANDA

**5.576 tests · 5.488 pass · 0 fail · 88 skipped · estado 0**, sobre el árbol ya mezclado con
`main` (dos merges durante el ticket: `760`+`586`, y después `768`).

Los 88 saltados declaran su motivo y **suman**: 76 `QA_DB_TEST` + 9 `LIBRO_PG_URL` +
1 `BOT_SUITE_TEST` + 1 `A55_DB_TEST` + 1 que no puede crear un enlace a fichero en Windows sin
elevación. **11 de los tests son de este ticket**, y el recuento de saltados no se movió ni una vez
en las cuatro pasadas: ningún test existente cambió de veredicto.

---

## EL MERGE DE `main`

Se movió **dos veces** con este ticket en vuelo, y la primera trajo **SCRUM-760 ya mergeado**
(PR #1077) — o sea que el ticket del que éste nace ya está en `main`. Se mezcló `main` **DENTRO**
de la rama —nunca al revés, nunca rebase— y la tanda y el meta-guard se volvieron a correr
**después** de cada merge.
