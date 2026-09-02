# SCRUM-661 · Congelar el coste unitario en la línea — el guard entra, el campo PARA

**Fecha:** 2-sep-2026 · **Carril:** documento (línea) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `8a1bbb81c056082b33ab3e1eeaa312d48d4f10c6` · 2026-09-02T13:19:52+01:00

**Tanda:** 4355 tests, 4276 pass, 0 fail, 79 skipped — medida DESPUES del ultimo cambio, entrada incluida.

---

## 🛑 LO PRIMERO: LA PREMISA DE S2 ES FALSA EN SU PARTE OPERATIVA

El encargo la marcaba para comprobar, y no aguanta.

> S2 (02-sep, informe de CAT-02): «`QuoteLineSchema` deja pasar sólo `concept/qty/price/tax` y
> **borra en silencio** `productId`, `costeUnitario` y `markup`.»

**El mecanismo es cierto; el hecho no.** `z.object` sí borra las claves que no declara —lo dice el
propio fichero en el comentario de `suplido` (SCRUM-500)—, pero **esos tres campos no llegan**. No
hay nada que se esté borrando.

**El cuerpo que viaja de verdad**, medido en `quotesView.js:3029-3035` (`lineaParaPayload`, que es
lo que entra en `createQuote` → `POST /quote/create`):

```js
{ concept, qty, price, tax, suplido }
```

* `costeUnitario` — **cero apariciones en TODO el front.**
* `productId` — no se envía.
* `markup` — **se disuelve** en `price` antes de salir: `finalPrice = safePrice * (1 + markup/100)`.
  (Sí aparece en el borrador de `localStorage`, que no sale del navegador.)

### Y hay una segunda capa, que es la que cierra la puerta

**`searchProducts` ni siquiera devuelve el coste.** Su `select` es
`id · name · description · price · vat · providerId · isActive` (`products.service.ts:211-219`).
Así que el front **no tiene** el dato que tendría que enviar.

> **La cadena completa, medida:** el coste vive en `Product.cost` → **no sale** de
> `searchProducts` → **no llega** al front → **no se envía** en la línea → el esquema no tiene nada
> que dejar pasar.
>
> Ensanchar el esquema hoy crearía **un campo que nadie rellena**, que es exactamente lo que el
> encargo llama «peor que no tenerlo». **La condición 4 (alcanzabilidad de punta a punta) NO se
> puede cumplir desde este carril**, así que PARO en el ensanchamiento y lo hablamos.

---

## PASO 0

**ENTRADA.** El profesional llega por la pantalla del documento: crea líneas en el editor de
presupuesto (`public/dashboard/js/quotesView.js`) y guarda con `createQuote` →
`POST /quote/create` (`api.js:1166`). El precio de la línea puede venir del catálogo por el
autocompletado (`attachProductAutocomplete`). **No hay ninguna entrada por la que hoy se le pida ni
se le enseñe el coste unitario en la línea:** el coste sólo existe en la ficha del producto.

**MECANISMO.** Existe la mitad de abajo y falta la de arriba:

| pieza | ¿existe? | dónde |
|---|---|---|
| el coste del producto | **sí**, mutable y sin histórico | `Product.cost` |
| que el coste salga del backend hacia el front | **no** | `searchProducts` no lo selecciona |
| que la línea lo lleve | **no** | `lineaParaPayload` no lo pone |
| que el esquema lo acepte | **no** | `QuoteLineSchema` no lo declara |
| que el PDF no lo filtre | **sin guard** | ← **esto es lo que entrega este ticket** |

---

## Lo que MIDO y el fundador necesita para decidir

### Consumidores de `QuoteLineSchema` — dos instrumentos, y coinciden

| instrumento | resultado |
|---|---|
| por identidad (`grep` del símbolo) | **2**: `schemas.ts:51` y `:61` |
| **el compilador** (retiro el símbolo y pregunto a `tsc`) | **2**, las mismas dos líneas |

Ayer un censo mío dio 1 donde había 3, así que esta vez el segundo instrumento no es adorno: los
dos coinciden, y por eso el 2 vale. Post-condición de la mutación: `schemas.ts` cambió, y se
revirtió byte a byte.

### ¿Rompería algo dejar pasar un campo más?

**No.** Medido: **cero `.strict()`** en todo `src/`. El borrado de claves desconocidas es el
comportamiento por defecto de `z.object`, no una decisión de seguridad tomada aquí.

### `productId` y `markup`

* **`markup` NO hace falta** para que el coste signifique algo: ya está incorporado al `price` que
  se guarda, así que margen = `price − costeUnitario` sería reconstruible sin él.
* **`productId` tampoco es necesario** para el margen, pero sin él no se podrá agrupar «cuánto gano
  con este producto». Es otra pregunta y **no la meto aquí**.

### El diff que dejó S2

Está en `docs/master/SCRUM-610.md:145`, y es sólo el ensanchamiento del esquema
(`costeUnitario: z.number().nonnegative().optional()` con su comentario). **No se ha aplicado**, y
no por desacuerdo con su forma —es correcta— sino porque **sin las dos piezas de arriba no rellena
nada**.

---

## Lo que SÍ entrega este ticket: la condición 1, el guard de fuga

`tests/scrum661-el-coste-no-llega-al-papel.test.mjs`, 5 casos, sobre **los dos documentos que ve el
cliente**: presupuesto y factura.

**Se lee el PDF de verdad** con `lineasDePdf` (SCRUM-659), no el objeto que se le pasa al
generador: que un dato no esté en la plantilla no prueba que no salga.

| caso | qué fija |
|---|---|
| **SUELO** | el lector VE líneas (>5). «No está el coste» y «no supe leer» son el mismo resultado con significados opuestos |
| **CONTROL NEGATIVO** | lo que SÍ debe salir —el concepto, el precio `100,00`— sale. Sin esto, un lector vacío pasaría el guard sin mirar |
| el coste no llega al **presupuesto** | ni el número (en sus tres grafías) ni el nombre del campo |
| el coste no llega a la **factura** | ídem |
| **🔴 EL ROJO** | con el coste impreso en el papel, el detector **lo encuentra y dice en qué línea** |

### Sobre el rojo, y la distinción honesta

La fuga se provoca metiendo el número del coste en un campo que el documento **sí** imprime, porque
`pdf.service.ts` **es de S3 y no se toca**. Eso **prueba el DETECTOR** —que si el coste llegara al
papel, este guard lo vería—, y **no** prueba que `pdf.service` filtre. Es lo que se puede afirmar
sin salirse del carril, y se dice tal cual.

**Por qué el guard entra hoy aunque el coste todavía no se guarde:** protege la FORMA, no el dato.
El día que el coste viaje en la línea, la fuga ya es imposible — y ese día nadie se acordará de
comprobarlo. Un guard que llega después del dato llega tarde.

---

## Las otras tres condiciones

| condición | estado |
|---|---|
| **1 · el coste no llega al PDF** | ✅ entregada, con su rojo |
| **2 · se escribe hacia delante, nunca hacia atrás** | ⏸ **no aplica todavía**: no hay campo que rellenar. Cuando lo haya, el test de «ausente ≠ cero» va con él |
| **3 · si no está decidido si se ve, no se esconde** | ⏸ no aplica: no hay nada que pintar, y pintarlo exige tocar `quotesView.js` (S2) |
| **4 · alcanzabilidad de punta a punta** | 🛑 **no se puede cumplir desde aquí** — es lo que motiva la parada |

---

## Lo que hace falta para desbloquearlo, medido y en orden

1. **`searchProducts` devuelve `cost`** (`products.service.ts`) — una línea en el `select`.
2. **La línea lo lleva y lo envía** (`quotesView.js`, `lineaParaPayload`) — **zona de S2 ahora
   mismo (SCRUM-660)**.
3. **El esquema lo acepta** — el diff de S2, ya escrito.

Sin los pasos 1 y 2, el 3 es un campo vacío. **Los tres son de un carril que hoy no es el mío.**

---

## Lo que NO se ha tocado

`pdf.service.ts` (S3, leído y no modificado) · `quotesView.js` (S2, SCRUM-660) ·
`products.routes.ts` y el trinquete de SCRUM-646 · `prisma/schema.prisma` · el bloque IGIC.
**Ningún microcopy nuevo:** este ticket no enseña nada al profesional.

## Los huecos que declaro

1. **No he verificado en navegador** ninguno de los dos PDF: he leído su texto generado.
2. **El guard vigila un número reconocible y el nombre del campo.** Si el coste se filtrara
   redondeado a otra cifra, o dentro de una cadena que no case con las tres grafías, no lo vería.
3. **No he probado que `pdf.service` filtre o no filtre un campo desconocido** más allá de que hoy
   no lo imprime: no puedo modificarlo para forzar el caso.
4. **No he medido producción.**

## Estado del arbol

* origin/main avanzo a 5797b7aa mientras se cerraba esto (y traia mi SCRUM-646 ya mergeado). Se ha
  MERGEADO main DENTRO de la rama —no rebase, la historia no se reescribe—, sin conflicto.
* Cliente de Prisma regenerado y dist/ reconstruido DESPUES de mezclar main.
* npm run guards:entrada en verde.

## Ficheros

* `tests/scrum661-el-coste-no-llega-al-papel.test.mjs` — **nuevo**, el guard de fuga.
* `docs/master/SCRUM-661.md` — esta entrada.

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* `searchProducts` no devuelve `cost`, así que el front no puede enseñar ni enviar el coste aunque quiera.
* El borrador de `localStorage` guarda `markup` por línea, pero el `markup` no viaja al servidor: se disuelve en el precio.
* `Product.cost` sigue siendo mutable y sin histórico — es la causa de fondo que este ticket quería tapar y sigue intacta.
