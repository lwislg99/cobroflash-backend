# SCRUM-1027 · EL ATAJO — que un merchant ES con `INVOICING_ES_ENABLED` en OFF deje de GENERAR el documento

**Medido contra:** `origin/main` = `73382cd096c3e68a4963508160a6cb1e68dec149` · 2026-09-21T16:45:41Z

**Puesto:** J1 · Facturación y VeriFactu (`jv-j1`, equipo de Javier) · **Rama:** `scrum-1027-atajo-flag-off-sin-documento`

> 🔴 **GO EXPRESO DE JAVIER (jefe), 21-sep-2026, en el chat de su orquestador: «825 tal cual y el
> atajo también».** Toca el camino de emisión (STOP, reglas 38/40): sin esa frase no se empieza.
> Con ella, se construye **dentro de los límites que trae el propio ticket** — y el despliegue
> (empujar) queda **fuera** de este GO: la sesión construye, deja el PR listo y PARA antes de
> empujar (§7).

---

## 0 · Qué manda, y qué hacía el código hasta hoy

La enmienda **SCRUM-612c** (PR #1593, en `main` desde las 14:55:34Z del 21-sep-2026) reescribió la
regla 24: con `INVOICING_ES_ENABLED` en OFF, en España, **no se emite ningún documento** — ni
factura, ni justificante, ni ningún otro — **y no se cobra por YaQu**. Dos excepciones, decididas
por Javier el mismo día: el merchant **DEMO** sigue emitiendo con marca de agua y cobrando en TEST
(P-1), y un **enlace de pago ya enviado** sigue cobrando (P-2).

Hasta esta rama, el código hacía lo contrario: un merchant ES real sin el flag emitía un
**justificante `J-…`** (V0-0 / SCRUM-346, A0.5, 6-ago-2026). Medido por Javier en producción el
21-sep: el 8-sep se borró todo (0 documentos) y el 20-sep a las 20:42 apareció uno **nuevo**,
merchant 18 (no el demo) — el camino **regenera** lo que se borra.

---

## 1 · PASO 0 — el punto único de decisión, confirmado por AST

`getEmissionMode(merchant)` (`src/modules/invoicing/domain/emission.service.ts:36-41`) es la
**única** función que decide el modo (`'fiscal' | 'demo' | 'receipt'`): mira `country`,
`isDemoMerchant` y `isFlagEnabled('INVOICING_ES_ENABLED', …)`, y nada más. Censo por `grep` sobre
`src/` (11 llamadores, ninguno reimplementa el criterio) — confirmado el 21-sep-2026: **no hay un
segundo punto de decisión.**

Pero el **punto de EJECUCIÓN** (dónde el modo `receipt` se convierte en un documento de verdad) es
otro: `allocateInvoiceNumber` (`src/modules/invoicing/domain/invoiceNumber.service.ts:487`, antes
del cambio). Ahí, y sólo ahí, `receipt` reservaba una referencia `J-` y auditaba la emisión. Los
**diez** caminos que piden un número (directos o vía `emitInvoice`) pasan TODOS por esta única
función — censo completo en §2.

### 1.1 · Qué asume que SIEMPRE hay documento (lo que se cae sin él)

Ya medido por J1 el 18-sep (`docs/master/SCRUM-612.md` §1.2) y reconfirmado aquí sin cambios: el
enlace de pago, el WhatsApp «te envía el justificante · Pagar», el cobro de la señal al aceptar el
presupuesto, los recordatorios de pago, «marcar como cobrada», el aviso de cobro al cliente, la
pantalla Cobros y el recibo público — **todos cuelgan de un documento emitido** (un único creador
de `Charge` en `charges.routes.ts:53`, llamado sólo desde `invoiceWhatsApp.service.ts:57`, que
sólo se invoca con un `invoiceId` ya existente).

### 1.2 · Qué pasa en su lugar

Presupuestos, firma, albaranes y partes **siguen igual** (regla 24 lo dice explícito). El
profesional cobra **por fuera de YaQu** hasta que exista factura (comentario 15950 de Javier). No
se construye aquí ningún camino de cobro alternativo: es zona de **J2**, no de J1, y no se propone.

---

## 2 · El censo completo — quién pedía un número, y qué se hizo con cada uno

| # | quién | ¿ya gateaba `receipt`? | qué se hizo |
|---|---|---|---|
| 1 | `quotes.routes.ts:736` — cliente acepta el presupuesto (**pública**) | no | ver §3.4 |
| 2 | `jobs.routes.ts:1457` (`collect-rest`) | no | gate nuevo, §3.2 |
| 3 | `quotesAdmin.routes.ts:292` (`POST /:id/invoice`) | no | gate nuevo, §3.3 |
| 4 | `quotesAdmin.routes.ts:561` (`POST /:id/invoice-manual`) | no | gate nuevo, §3.3 |
| 5 | `invoicesAdmin.routes.ts:152` (documento suelto, vía `emitInvoice`) | gate por `modoDocumentoSuelto`, pero devolvía `'justificante'` (dejaba pasar) | `facturaSuelta.ts` corregido, §3.1 |
| 6 | `invoicesAdmin.routes.ts:1022` (rectificativa R1) | sí — `if (rect) throw` ya existía | sin cambios; ahora es el caso general |
| 7 | `lib/invoicing.ts:338` (`ensureInvoiceForCharge`, sólo si `AUTO_INVOICE_ON_PAID`, OFF en todos los entornos) | no, pero **inalcanzable**: un `Charge` sólo nace de un documento ya emitido (§1.1) | sin cambios — sus 3 llamadores (`psp.routes.ts` ×2, `mpWebhook.routes.ts`) ya envuelven la llamada en `try/catch` propio que registra y sigue |
| 8 | `recapitulativa.service.ts:105` (vía `emitInvoice`) | sí — gateado en sus DOS únicos llamadores | sin cambios |
| 9 | `albaranes.routes.ts:1266` (`/facturar-parcial`, vía `emitInvoice`) | sí — gate en `:1223` | sin cambios |
| 10 | `albaranes.routes.ts:1539` (`/convertir-en-factura`, vía `emitInvoice`) | sí — gate en `:1416` | sin cambios |
| — | `invoice.routes.ts:15` (`POST /invoice/issue`, ruta interna legacy, `requireInternalSecret`, resto de n8n retirado por regla 1) | no | **declarado, no arreglado** — ver §6 |

Los gates ya cerrados (5 y del 6 al 10) son el trabajo previo de SCRUM-895/A0.4/171a; esta rama no
los toca.

---

## 3 · Qué se cambió

### 3.1 · El punto único (defensa en profundidad) — `invoiceNumber.service.ts`

```
// antes
if (getEmissionMode(m) === 'receipt') {
  if (rect) throw new Error('invoicing_es_disabled');
  const numero = await reservarReferenciaJustificante(tx, merchantId, now);
  await auditar(numero, true);
  return numero;
}

// ahora
if (getEmissionMode(m) === 'receipt') {
  throw new Error('invoicing_es_disabled');
}
```

Lo que antes sólo pasaba con `rectifying: true` pasa ahora para los **siete** caminos. No avanza
ningún contador de la serie fiscal, y no se escribe ninguna fila de auditoría para un documento que
nunca sale. `reservarReferenciaJustificante` **se queda sin llamador** — no se borra: retirarla es
SCRUM-825, con su propia firma (regla 27).

`src/modules/invoicing/domain/facturaSuelta.ts` (`modoDocumentoSuelto`): el veredicto para
`receipt` pasa de `'justificante'` a `'no'`. El tercer valor (A0.5) queda sin caso real; el tipo se
deja como estaba (`'factura' | 'justificante' | 'no'`) porque angostarlo es alcance de SCRUM-825.

### 3.2 · `jobs.routes.ts` — `POST /:id/collect-rest`

Gate `getEmissionMode(quotesConPlan[0].merchant) === 'receipt'` → `409
facturacion_no_disponible`. El merchant se lee del `include: { merchant: true }` que ya se añadió a
la consulta de `quotesConPlan` (todos los presupuestos del Trabajo son del mismo merchant): **cero
consultas nuevas** a la base.

### 3.3 · `quotesAdmin.routes.ts` — `POST /:id/invoice` y `POST /:id/invoice-manual`

Mismo gate, usando `quote.merchant` (ya venía en el `include` de las dos rutas).

### 3.4 · `quotes.routes.ts` — `POST /:token/decision` (C1, el cliente final)

Es el camino **más delicado**: público, sin login, y con un catch que hasta hoy convertía
CUALQUIER fallo de emisión en `facturaPendiente: true` + el aviso «Tu factura está en proceso; si
no la recibes hoy, coméntaselo al profesional». Con el punto único ya lanzando para `receipt`, ese
aviso se habría disparado también aquí — y sería **falso**: no hay ninguna factura en camino.

Arreglo: `if (stage && getEmissionMode(quote.merchant) !== 'receipt') { … }` — en modo `receipt` no
se intenta la emisión, no se marca `facturaPendiente`, no se manda ningún WhatsApp de cobro.
**Ningún texto nuevo**: es el mismo patrón ya decidido en SCRUM-612 §6 (M-6, «ningún texto: los
botones no se pintan»).

### 3.5 · Microcopy — regla 30/39

Las tres rutas nuevas reutilizan el marcador **ya aprobado y en `main`**,
`'[PENDIENTE microcopy oficial]'` (mismo mecanismo que `albaranes.routes.ts` e
`invoicesAdmin.routes.ts`), con `error: 'facturacion_no_disponible'`. **No se ha escrito ningún
texto nuevo.** Cuando `POST /admin/invoices` cae al veredicto `'no'`, reutiliza el mensaje **ya
firmado** «En este modo no se emiten facturas.» — sigue siendo verdad para el caso nuevo; no hace
falta, y no se permite, redactar uno propio.

---

## 4 · POSITIVO — verificado (unit, sin BD ni staging)

| caso | dónde se prueba | resultado |
|---|---|---|
| **DEMO sigue emitiendo con marca de agua** (id=1) | `tests/emission.test.mjs` («demo sigue emitiendo de la serie fiscal anual»); `tests/scrum81-allocate-flags.test.mjs` | ✅ intacto |
| **Fuera de España, siempre fiscal** | `tests/emission.test.mjs`, `tests/scrum81-allocate-flags.test.mjs` | ✅ intacto |
| **ES con el flag ON, sigue fiscal** | `tests/emission.test.mjs`, `tests/scrum81-allocate-flags.test.mjs`, `tests/scrum346-justificante-suelto.test.mjs` («NO-REGRESIÓN») | ✅ intacto |
| **Un enlace ya enviado sigue cobrando (P-2)** | no tocado: `POST /charges` y el flujo de cobro de un `Charge` ya existente no pasan por `allocateInvoiceNumber` — nada en este diff los alcanza | ✅ por construcción, no por test nuevo |
| **Presupuestos, firma, albaranes, partes** | ningún fichero de esas áreas figura en el diff | ✅ intacto |

## 5 · NEGATIVO — verificado

- **Ningún documento ya emitido se toca**: el diff no incluye ni una escritura sobre `Invoice`
  existentes, ni `update`, ni `delete` (regla 29).
- **Nada de `prisma/schema.prisma`**: cero líneas.
- **No se retira el tipo `JUST`**: `invoicing.service.ts` sigue forzando `type: 'JUST'` cuando la
  serie sale `J-` (código que ya no se alcanza en `receipt`, pero sigue ahí para SCRUM-825);
  `reservarReferenciaJustificante`, `isReceiptNumber`, `makeReceiptNumber` siguen exportadas.
  Comprobado por `tests/scrum1027-atajo-flag-off-sin-documento.test.mjs`.
- **Ningún rótulo nuevo ni cambiado**: el único texto que viaja al cliente/profesional en los
  caminos tocados es el marcador `[PENDIENTE microcopy oficial]` (ya aprobado como mecanismo) o el
  literal ya firmado «En este modo no se emiten facturas.» — ninguno de los dos es nuevo.
- **Cero producción, cero staging** desde esta sesión.

## 6 · Lo que NO se ha medido / NO se ha tocado, declarado

- **`invoice.routes.ts:15` (`POST /invoice/issue`)**: ruta interna legacy (protegida por
  `requireInternalSecret`, resto de la integración n8n que la regla 1 ya retiró). Si algún día se
  alcanza con un merchant en modo `receipt`, hoy devolvería `500 internal_error` en vez de un 409
  nombrado — igual que hacía la rectificativa antes de SCRUM-1027. **No se arregla aquí**: es un
  camino interno sin usuario final detrás, y ensancharlo sin necesidad no es "el atajo". Declarado
  para que quede escrito, no descubierto.
- **No se ha probado en un navegador ni contra staging** (prohibido desde una sesión). La
  verificación es de código: unit tests con dobles de `tx`/`prisma`, más AST sobre las rutas reales
  compiladas en `dist/`.
- **El texto que ve el cliente cuando el presupuesto queda en la firma sin más** (N1, la pantalla
  de condiciones de pago tras aceptar): sigue siendo pregunta abierta P-5 de SCRUM-612 (es de S1 /
  J2), no de este ticket.

## 7 · El límite del GO — no se ha empujado

Javier autorizó **construir**. Empujar es desplegar (auto-merge → `main` → Railway), y en el camino
del cobro el sí de empujar lo escribe un jefe en el chat de la sesión. **Esta rama está construida,
verificada y NO empujada.** El siguiente paso es avisar y esperar ese segundo GO.

---

## 8 · Tests — qué se escribió y qué se corrigió, con motivo

**Nuevo:** `tests/scrum1027-atajo-flag-off-sin-documento.test.mjs` — AST sobre las tres rutas
nuevas (gate antes de pedir número, 409 nombrado), el camino público C1 (no hay aviso falso), y
negativos (JUST intacto, nada de esquema/clientes).

**Corregidos** (encontrados en rojo por el propio `npm test`, no anticipados en el plan inicial —
todos medían el comportamiento ANTERIOR a la regla 24 enmendada):

| fichero | qué medía antes | qué mide ahora |
|---|---|---|
| `tests/emission.test.mjs` | `receipt` sin `rect` devolvía `J-` | `receipt` siempre lanza `invoicing_es_disabled` |
| `tests/scrum81-allocate-flags.test.mjs` | ídem | ídem |
| `tests/scrum289b-factura-suelta.test.mjs` | `modoDocumentoSuelto(receipt) === 'justificante'` | `=== 'no'` |
| `tests/scrum346-justificante-suelto.test.mjs` | el profesional ES real SÍ emitía su justificante (A0.5, control positivo e2e) | invertido: YA NO emite nada; los controles de entrada (sin cliente, sin líneas) se mueven al merchant con el flag ON, que sigue siendo el que los ejercita de verdad |
| `tests/scrum207-emision-auditada.test.mjs` | el justificante se auditaba | ya no hay nada que auditar: 0 filas |
| `tests/scrum396-referencia-justificante.test.mjs` | el reintento por colisión de referencia (7 tests) | ese mecanismo quedó inalcanzable; se declara y se mide que el rechazo llega ANTES de tocar el índice |
| `tests/scrum291-series-huecos.test.mjs` | ancla SHA-256 de `invoiceNumber.service.ts` (regla 38) | hash actualizado EN ESTE COMMIT, con el GO citado |
| `tests/scrum263-sin-lineas-409.test.mjs` | — (sin cambiar la aserción) | necesitaba que el gate nuevo de `jobs.routes.ts` leyera el merchant de una consulta YA mockeada, no de una nueva — ver §3.2 |
| `tests/scrum728d-viajes-de-la-reserva.test.mjs` | el justificante hacía 7 viajes a la base (6 dentro del cerrojo) | ya no reserva nada: rechaza tras leer el merchant, sin llegar a los viajes que medía |
| `tests/scrum887c-caso-c-bloqueado.test.mjs` | el fixture `MERCHANT` no llevaba `flags` (→ `receipt`) | se le añade `flags: { INVOICING_ES_ENABLED: true }`: el ticket mide el bloqueo por «descuento global + varios IVA», no el de la regla 24 |
| `tests/scrum667-marcador-visible.test.mjs` | censo congelado de marcadores en `src/` | +1 entrada por `jobs.routes.ts` y `quotesAdmin.routes.ts`, declarada a conciencia (A23 #14) |
| `docs/legal/AUDITORIA_CAMINO_EMISION.md` | cita `facturaSuelta.ts:74-78` (`modoDocumentoSuelto`) | la función se movió a `85-89` por los comentarios añadidos; corregida por SCRUM-525d |

`npm run guards:entrada` y la suite completa (`node --test tests/*.test.mjs`, TAP a fichero fuera
del árbol): verde, salvo los tres rojos **pre-existentes y no relacionados** de esta máquina, ya
documentados en `docs/equipo/traspaso-javier.md` §5 (SCRUM-858b: `wmic` no existe en Windows 11;
SCRUM-939b ×3: `gh.exe` sí está instalado en esta máquina, al revés de lo que un censo viejo
declaraba).

## 9 · Errores propios (A9)

1. **El primer intento del gate de `collect-rest` añadía una consulta `prisma.merchant.findUnique`
   nueva**, no cubierta por el doble de `tests/scrum263-sin-lineas-409.test.mjs` (que sustituye
   `prisma.quote`/`job`/`invoice` pero no `prisma.merchant`). Lo cazó ese mismo test, en rojo.
   Arreglado leyendo el merchant del `include` que ya traía `quotesConPlan` — cero viajes nuevos, y
   el test volvió a pasar sin tocar su fixture.
2. **El primer `sinComentarios` del fichero de tests nuevo era un filtro de líneas escrito a mano**
   (`replace(/\/\/.*$/, …)`), exactamente el patrón que `tests/scrum700-filtros-de-comentario.test.mjs`
   mide y prohíbe que suba. Lo cazó ese guard, no una relectura propia. Sustituido por
   `soloEjecutable` de `tests/_guard-texto.mjs`, el sitio único.
3. **La cita de `docs/legal/AUDITORIA_CAMINO_EMISION.md:34` quedó desfasada** por los comentarios
   añadidos en `facturaSuelta.ts` (movió la función 11 líneas). Lo cazó
   `tests/scrum525d-anclas-que-apuntan.test.mjs`, no una relectura manual del documento.

## 10 · Lo que no se ha tocado

`prisma/schema.prisma`, el tipo `JUST` y su infraestructura, los cuatro gates ya cerrados de
`albaranes.routes.ts`/`jobs.routes.ts`, `lib/invoicing.ts`, cualquier dato de cliente, producción,
staging.
