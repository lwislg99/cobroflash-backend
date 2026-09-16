# SCRUM-616 · Qué guarda HOY `POST /admin/invoices` — y qué se descarta en silencio

**Medido contra:** `origin/main` = `88ab90ded330ba8b06b1dc01e47e92f5b70317e6` · 2026-08-24T22:15:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance:** una caracterización del camino de escritura de la factura suelta, hecha sobre
**funciones puras** —sin base de datos y sin turno de staging— y que **sólo LEE** ese camino
(regla 38). No arregla nada: lo que sale mal se declara como hallazgo.

Nace de un hueco que midió SCRUM-600 (DOC-10) y que el fundador aprobó como ticket propio.

---

## 1 · El hueco, y por qué no lo tapaba `scrum289b`

`tests/scrum289b-factura-suelta.test.mjs` cubre el gate (`modoDocumentoSuelto`), la tenencia
(regla 2), la regla 29 (sólo alta), el microcopy y que la validación acepta un cuerpo bueno y
rechaza uno malo. Lo que **no** cubría:

* **la FORMA del resultado** — qué queda guardado exactamente;
* **que las claves de más se descartan en silencio**.

Su control de aceptación comprobaba `r.ok === true`, `r.customerId === 7` y
`r.lineas.length === 1`. Nada sobre las **claves** de esa línea.

## 2 · 🔴 Por qué se puede caracterizar en puro, y no es un atajo

**Medido:** entre validar y guardar **no hay ninguna transformación**.

```
invoicesAdmin.routes.ts   emitInvoice(tx, { … lines: val.lineas … })
invoicing.service.ts      lines: (input.lines as any) ?? undefined
```

Lo que `validarFacturaSuelta` devuelve en `lineas` es **literalmente** lo que aterriza en la
columna `Invoice.lines`. Por eso caracterizar la función pura **es** caracterizar lo guardado.

**Y el supuesto no se da por bueno: lleva su propio suelo.** Un test comprueba que esas dos
líneas siguen ahí y falla diciendo que la caracterización ha dejado de medir lo guardado si
alguien mete algo en medio. Un test que sigue reportando cuando su modelo se rompió es peor que
no tenerlo.

## 3 · Lo que se guarda HOY

Con la línea tal como sale del front del presupuesto (`quotesView.js`, `payloadLines.push`):

| | línea normal | línea de suplido |
|---|---|---|
| **VIAJA** | `{concept, qty, price, tax: 0.21}` | `{concept, qty, price, tax: 0, suplido: true}` |
| **SE GUARDA** | `{concept, qty, price, tax: 0.21}` | `{concept, qty, price, tax: 0}` |
| **DESCARTADO** | *(nada)* | **`suplido`** |

Documento de dos líneas (60 € al 21 % + 45 € de tasa como suplido):

| | |
|---|---|
| desglose | `[{rate:21, base:60, cuota:12.6}, {rate:0, base:45, cuota:0}]` |
| base | `105` |
| cuota | `12.6` |
| **total emitido** | **`"117.60"`** — `.toFixed(2)`, porque `Invoice.total` es `Decimal(12,2)` y la ruta redondea ahí |

`lineaParaPayload` **borra** la marca cuando vale `false`: una línea normal sale con cuatro
claves exactas, no con cinco y un `suplido:false`. Por eso «línea normal» no descarta nada.

## 4 · 🔴 EL HALLAZGO — se pierde la clasificación, no el dinero

`suplido` **no sobrevive el viaje**. Y el matiz importa, porque manda a buscar en el sitio
correcto:

* **el `tax: 0` SÍ sobrevive** → los euros salen bien. Total con marca y sin marca: `45,00` los
  dos. Nadie cobra de más.
* **la MARCA se cae** → una vez guardada, **una línea de suplido es indistinguible de una línea
  legítima al 0 %**. El test lo afirma comparando las dos lado a lado: se guardan idénticas.

El documento deja de saber lo que es. No hay error, no hay aviso, no hay diferencia de importe:
**nadie se entera.** Y F8 —«suplido como concepto de primera clase»— es una de las ocho funciones
que DOC-10 declara innegociables.

**No se arregla aquí, y no es pereza:** completar la marca toca el camino de emisión
(reglas 29/38) y puede tocar `prisma/schema.prisma`, que es dominio del fundador. Se declara.

Coincide con lo que ya dejó escrito el propio `quoteSuplido.js` al nacer (SCRUM-500): la mitad
viva de la casilla es la que quita el IVA; la clasificación quedaba pendiente. Esto **mide** esa
mitad pendiente en el camino de la factura, que es donde DOC-10 la va a necesitar.

## 5 · La constancia de lo descartado — el corazón del ticket

La lista de claves **está fijada, no calculada y dada por buena**:

```
VIAJAN      concept, price, qty, suplido, tax
SOBREVIVEN  concept, price, qty, tax
DESCARTADAS suplido
```

Si alguien añade una clave a la línea que viaja, el conjunto cambia y **el test cae nombrándola**.
Un test que sólo comprobara «se descarta algo» se quedaría callado justo cuando aparece una clave
nueva — que es cuando hace falta que hable.

Probado: inyectando `referenciaProveedor` en la línea, el rojo dice

> `antes: concept, price, qty, suplido, tax`
> `ahora: concept, price, qty, referenciaProveedor, suplido, tax`
> *Si has ANADIDO una clave: comprueba si sobrevive, porque hoy el servidor tira en silencio todo
> lo que no sea concept/qty/price/tax.*

## 6 · Verificación

**Commit de partida:** `c6f9c05799e3687f0ae91a80ad1cf588ea150780`. Las dos inyecciones se hicieron
sobre `public/dashboard/js/quoteSuplido.js` guardando los **bytes de disco** de partida y
revirtiendo con `Buffer.compare` (SCRUM-570). Árbol limpio después de cada una.

| control | inyección | resultado |
|---|---|---|
| 🔴 ROJO-1 | quitar `suplido` de la línea que viaja | **fail=2**, y las dos lo nombran: «LAS CLAVES DE MAS SE DESCARTAN» y «`suplido` NO sobrevive el viaje» |
| 🔴 ROJO-2 | meter `referenciaProveedor` de más | **fail=1**, nombrando la clave nueva en el mensaje |
| ✅ POSITIVO | línea completa y correcta | verde — no salta con datos buenos |
| ✅ NEGATIVO *(dentro del test)* | clave inventada en el recorrido | el censo la lista como descartada |

## 7 · ⚠️ El riesgo de orden, aceptado con los ojos abiertos

Si el fundador decide que la factura guarde otra cosa —que la marca persista, que quepa una fecha
de vencimiento— esta caracterización habrá fijado algo que va a cambiar.

**Ese rojo sería útil:** avisaría de que **DOC-10 dejó de ser un cambio de front** y pasó a ser un
cambio de lo que se almacena, con lo que arrastra (regla 29, schema, sellado). Es justo lo que
nadie quiere descubrir tarde.

**Está escrito DENTRO del test**, no sólo aquí: la cabecera de
`tests/scrum616-que-guarda-la-factura.test.mjs` distingue los dos significados de un rojo —«se
rompió algo» y «cambió la decisión»— y dice qué hacer en cada caso. Quien lo vea rojo dentro de
tres semanas no tiene que adivinarlo.

## 8 · Hallazgo secundario: el encargo describía la línea del BORRADOR

El encargo afirmaba que la línea que viaja es `{concept, qty, price, markup, vat, suplido}`.
**Medido, ésa es la línea del BORRADOR** (`saveDraft`, snapshot a `localStorage`). La que viaja al
servidor es `{concept, qty, price, tax, suplido}`:

* `markup` **nunca viaja**: se pliega dentro de `price` antes de enviar
  (`finalPrice = base * (1 + markup/100)`);
* `vat` viaja como `tax` y **en fracción**, no en porcentaje.

Se dice porque cambia dónde está el riesgo: «una clave que se cae por el camino» no aplica a
`markup` ni a `vat` —esos no son claves perdidas, son claves transformadas a propósito—. La única
que se cae de verdad es `suplido`. Son dos poblaciones distintas, y confundirlas mandaría a buscar
un defecto donde no lo hay.

## Tests que introduce esta entrada

* `tests/scrum616-que-guarda-la-factura.test.mjs` — la caracterización, sus dos suelos y sus
  controles.
