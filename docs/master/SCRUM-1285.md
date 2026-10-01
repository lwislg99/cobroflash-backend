# SCRUM-1285 — Lo que se teclea con un guardado en vuelo ya no se pierde ni dispara un segundo guardado (mitad de PANTALLA)

**Medido contra:** `origin/main` = `e75b94ca8755bd5d27981940c5ff4c01b2df8695` · 2026-09-29T16:28:26Z

Carril S2 (pantallas) · rama `scrum-1285-guardado-en-vuelo` · sesión `s2-29d`.

## Carriles, contra el árbol

- `parteOficinaView.js`, `quotesDetailView.js` y `api.js` → **S2** (`orquestador.md` §11bis: en
  `public/dashboard/js/` solo `jobsView`, `parteDetailView` y `albaranDetailView` son de S4).
- `src/modules/system/app/routes/quotesAdmin.routes.ts` (el PATCH que reemplaza sin comprobar versión)
  → **S1**. **No se toca aquí.** Los puntos 3 (entre pestañas o personas) y 4 de la aceptación son suyos.

## El patrón (no dos parches)

`api.js` · `congelarMientrasGuarda(zona, guardar)`: mientras el guardado está en vuelo, **todos** los
controles de su zona (`input, select, textarea, button`) quedan apagados; al volver, bien o mal, cada uno
recupera **el `disabled` que tenía** (un tramo ya facturado sigue bloqueado). Devuelve la misma promesa.

- Congelar en vez de fusionar o avisar: fusionar obliga a decidir quién gana campo a campo, y avisar de un
  descarte exige un texto nuevo (regla 39). Congelar no pierde nada y **no necesita ninguna frase**.
- Es la mitad de la pantalla. Dos pestañas o dos personas se siguen pudiendo pisar: eso solo lo para la
  condición de versión **dentro del `update`** (como SCRUM-1276), que es del servidor.

Aplicado en:

- `parteOficinaView.js` «Guardar precios»: zona = la tarjeta del parte.
- `quotesDetailView.js` «Guardar plan»: zona = la sección «Plan de cobro». Así, teclear ya no puede
  llamar a `recalcular()` y rehabilitar el botón: **no hay segundo PATCH desde esta pantalla**.

## Medición (ejecutando, en el banco de vistas, con la red retenida a mano)

`tests/scrum1285-guardado-en-vuelo.test.mjs`, 9 casos. Las dos pantallas **reales**, montadas y pulsadas.
Teclear y pulsar se simulan como un navegador (un control apagado no recibe nada; `onclick` y oyentes).

| Caso | Con el arreglo | Con las vistas de `main` |
|---|---|---|
| Oficina · control positivo: guardar normal manda el PATCH y repinta lo guardado | ✔ | ✔ |
| Oficina · con el PATCH en vuelo no se puede teclear | ✔ | ✖ |
| Oficina · sonda sin el patrón: lo tecleado en vuelo desaparece (debe verlo) | ✔ | ✔ |
| Oficina · guardado fallido: nada se queda congelado | ✔ | ✔ |
| Plan · control positivo: guardar normal manda el PATCH y repinta | ✔ | ✔ |
| Plan · en vuelo: no se teclea, «Guardar plan» no se rehabilita, un solo PATCH | ✔ | ✖ |
| Plan · la base se queda con el último plan pedido | ✔ | ✔ |
| Plan · sonda sin el patrón: sale un 2.º PATCH y con la latencia invertida la base REVIERTE (debe verlo) | ✔ | ✔ |
| Plan · guardado fallido: el tramo facturado sigue bloqueado, el libre y el botón vuelven | ✔ | ✔ |

Las dos sondas de «sin el patrón» son el control positivo del instrumento: cambian el helper por uno que
no congela y **exigen ver el defecto** (valor pisado; segundo PATCH y reversión con la respuesta vieja
llegando la última).

## Lo que queda fuera

- **Aceptación 4 (la ruta rechaza una versión vieja): S1**, en `quotesAdmin.routes.ts:483-486`. Con la
  pantalla congelada ya no sale un segundo PATCH **desde la misma pantalla**; entre dos pestañas sigue
  pudiendo pasar.
- **Aceptación 6 (editor de líneas del albarán 5/5):** no se ha tocado `jobDetailView.js`; el patrón es
  nuevo y hoy solo lo usan estas dos pantallas.
- El censo de rutas que reemplazan sin versión es de S3.

---

## Mitad de SERVIDOR (S1) · aceptación 4 · rama `scrum-1285b-plan-de-cobro-con-version`

**Medido contra:** `origin/main` = `3700de42ef552b5da5689f375084d8be8ff47157` · 2026-09-29T16:56:08Z

`PATCH /admin/quotes/:id/billing-plan` hacía `update({ where: { id } })`: reemplazaba sin mirar sobre qué
versión escribía. Ahora:

- La petición puede traer `version` = el `updatedAt` que la pantalla recibió (`quoteAdmin.ts:253` ya lo
  devuelve en el GET del detalle). La condición va **dentro del `where`** del `update`
  (`{ id, updatedAt: version }`), mismo patrón que SCRUM-1276: la base decide «¿sigue siendo esa versión?»
  y «escribe» en la misma sentencia; no cabe otra petición en medio.
- No casa → P2025 → **409 `version_superada`**, sin escribir. Ilegible → 400 `version_invalida`.
- La respuesta devuelve `version` (la nueva) para el siguiente guardado.

**Plantilla para el censo de S3:** `src/core/db/escrituraConVersion.ts` (`leerVersion`,
`esVersionSuperada`, los dos códigos). Cuatro líneas por ruta. El `where` lleva `updatedAt` como LITERAL
(no un spread): un spread lo vuelve OPACO para el censo 1285c, que lo midió así en CI.

⚠️ **Transición declarada:** sin `version` se escribe como hoy, porque la pantalla aún no la manda y
exigirla rompería el guardado normal al desplegar. **Falta (S2):** que `quotesDetailView.js:807` mande
`version: quote.updatedAt`, la actualice con la de la respuesta y trate el 409. El 409 va **sin
`message`**: cualquier texto para la persona pide firma (regla 39). Cuando la pantalla la mande, se exige.

**Patrón nombrado por el orquestador (29-sep), visto en SCRUM-1276:** *un fixture inválido que pasa
porque el código de producción es demasiado laxo.* Al apretar el código, el fixture cae (`scrum814`
creaba el presupuesto en `pending`, estado que no existe). La pregunta no es «qué he roto» sino «¿este
fixture era posible?».

Test `tests/scrum1285b-plan-de-cobro-con-version.test.mjs`, por el manejador real con la base doblada
(P2025 y `@updatedAt` emulados): control positivo (dos guardados seguidos, cada uno sobre la versión que
devolvió el anterior), versión superada → 409 sin cambiar la base, **latencia invertida** (el PATCH viejo
llega el último y no revierte), versión ilegible → 400, y la transición. **Rojo contra `3700de42`: 4/5**
(la transición pasa en los dos, como debe).

Fuera de alcance: si se emite una factura entre la lectura de `emitidas` y la escritura, eso no cambia el
`updatedAt` del presupuesto; lo cubre (o no) el censo de S3.

La tanda completa lo marcó (SCRUM-1185): `version` es un campo del cuerpo que ninguna pantalla manda aún. Declarado en scripts/_sin-consumir-declarados.json con carril **S2** y ticket SCRUM-1285; se retira cuando quotesDetailView.js lo mande. Resto de la tanda: solo el 1216b ajeno.
# Apéndice · SCRUM-1285c · Censo: escrituras que reemplazan un registro sin comprobar contra qué versión escriben

**Medido contra:** `origin/main` = `51d81311b01e19d592ad99a1f1f0817e4121cb55` · 2026-09-29T17:14:58Z

Carril S3 (instrumentos). Es la parte «censo» de SCRUM-1285: la pantalla es de S2 (#1985, `SCRUM-1285.md`) y la
ruta del plan de cobro es de S1 (rama `scrum-1285b-…`). **Solo LEE** el camino de emisión fiscal (regla 40): lo recorre
como AST, no importa, no ejecuta ni modifica nada de él.

## Qué entra

| Pieza | Qué hace |
|---|---|
| `scripts/_censo-escrituras-sin-version.mjs` | Censo por AST (TypeScript) de todo `<x>.<modelo>.update/updateMany/upsert` en `src/**/*.ts`. La identidad de cada modelo se deriva de `schema.prisma` (`@id`, `@unique`, compuestos y `merchantId`). Salida 0 = medido (cuenta, no juzga); 2 = no medido. `--todo` lista todas las clases. |
| `tests/scrum1285c-censo-escrituras-sin-version.test.mjs` | Lo mete en `npm test` (~3 s): mide el árbol real, anclas, casos fabricados, identidad y ciegos. |

## Clases

| Clase | Qué es |
|---|---|
| **LEE-Y-DECIDE** | `where` solo de identidad; antes, en la misma función, lee el modelo, y una condición (`if`, ternario, `switch`) mira el VALOR de un campo leído —directo o por una variable derivada, como `val = validar(q.plan)`— y **ese mismo campo se escribe** (o se escribe calculado a partir de sí mismo). Es la forma de 1276 y de 1285. |
| LEE-Y-RELLENA | Igual, pero la condición solo pregunta si el campo existe (`!q.pdfUrl`): rellena si faltaba. |
| LEE-SIN-DECIDIR | Lee antes, pero lo que escribe no depende de una decisión sobre lo leído. |
| A-CIEGAS | `where` de identidad sin lectura previa en la función: gana el último. |
| CONDICIONADO | El `where` lleva una clave que no es la de identidad (estado, versión, `portalToken: null`…). Es la forma del arreglo. |
| ATÓMICO | Todo el `data` son `increment`/`decrement`/… |
| OPACO | El argumento, el `where` o el `data` no son un literal. **No se sabe, y se dice.** Nunca cuenta como limpio. |

## Que sabe medir: controles, anclas y mutantes

- **5 rutas sintéticas en cada pasada.** Deben salir: la de 1276 con el defecto → LEE-Y-DECIDE; la misma con la
  condición en el `where` → CONDICIONADO; la forma del plan de cobro (decisión por una variable derivada) → LEE-Y-DECIDE;
  una que escribe un derivado → LEE-SIN-DECIDIR; una que solo rellena → LEE-Y-RELLENA. Si alguna falla, exit 2.
- **Dos anclas en el árbol real:**
  - `POST /:token/decision` (la ruta que 1276 arregló esta mañana) no puede tener ninguna escritura LEE-Y-DECIDE y
    tiene que tener su CONDICIONADO. Sale `:468 CONDICIONADO · :512 LEE-SIN-DECIDIR (pdfUrl) · :722 CONDICIONADO`.
  - `PATCH /:id/billing-plan` (1285) tiene que salir LEE-Y-DECIDE mientras siga roto, o CONDICIONADO cuando S1 lo
    arregle. Hoy sale `:483 LEE-Y-DECIDE`.
- **Mutantes (el censo sale con exit 2 y los tests en rojo):**

  | Mutante | Censo | Tests en rojo |
  |---|---|---|
  | No ve la condición del `where` | exit 2 · «la misma con la condición… salió LEE-Y-DECIDE» | 4 |
  | No ve la decisión | exit 2 · «la de 1276 con el defecto salió LEE-SIN-DECIDIR» | 4 |
  | No sigue la variable derivada | exit 2 · «la forma del plan de cobro… salió LEE-SIN-DECIDIR» | 3 |

- **Ciegos:** sin `schema.prisma`, o con un `src/` sin escrituras, sale «no medido»; nunca devuelve cero filas.
- **La raíz es la del árbol que se mide** (la del propio fichero), no la de donde esté instalado `typescript`. Así no
  repite el defecto de `_censo-fecha-sin-zona.mjs`, que con `node_modules` en junction medía otro árbol.

## Resultado sobre `main`

127 escrituras en 306 ficheros · 31 modelos.

| LEE-Y-DECIDE | LEE-Y-RELLENA | LEE-SIN-DECIDIR | A-CIEGAS | CONDICIONADO | ATÓMICO | OPACO |
|---|---|---|---|---|---|---|
| 30 | 6 | 14 | 38 | 20 | 1 | 18 |

**30 no son 30 defectos.** Se revisaron una a una leyendo cada función: un revisor de solo lectura las clasificó y yo
verifiqué las graves. Criterio: REAL = dos actores plausibles (doble clic, reintento de webhook, dos pestañas,
cron + petición) cruzan lectura y escritura y el resultado es incorrecto.

| Clase de la revisión | Nº |
|---|---|
| **REAL** | **21** (de ellas **1 hoy inalcanzable**, ver #13) |
| IDEMPOTENTE (dos a la vez escriben lo mismo) | 6 · `invoicing.ts:144/290/295`, `albaran.service.ts:901`, `payMp.routes.ts:62`, `quotesAdmin:795` |
| PROTEGIDA (candado real en el código) | 3 · `referral.service.ts:112` (`updateMany` condicionado previo), `invoiceNumber.service.ts:475` y `quoteNumber.service.ts:124` (`pg_advisory_xact_lock`) |

### Las REAL, por gravedad

| Gravedad | Dónde | Qué pasa | Verificado por mí |
|---|---|---|---|
| 🔴 dinero | `psp.routes.ts:346` y `:357` | **Sin carrera:** `payment.failed`/`payment.expired` sobre un cobro `paid` lo pisa. La única guarda (`:98-103`) mira `failed`/`expired`, no `paid`. Lo alcanzan `stripe.routes.ts:126/190` y `connectWebhook.routes.ts:124` (p. ej. un Bizum confirmado y la sesión de Stripe que caduca después). | ✔ leído |
| 🔴 fiscal | `psp.routes.ts:119` | Dos `payment.confirmed` pasan juntos la guarda de `:40` (doble clic en confirmar Bizum; el reintento de Stripe solo se deduplica en memoria) → doble conciliación y dos `ensureInvoiceForCharge` (`Invoice.chargeId` no es único). | revisor |
| 🔴 fiscal | `system/invoiceAdmin.ts:285` | «Marcar pagada» cruzada con una anulación resucita como pagada una factura anulada (guardas `:243/:250` sobre la lectura). | revisor |
| 🟠 dinero | `mpWebhook.routes.ts:240` | Un `rejected` que leyó `pending` pisa el `paid` que escribió el `approved` (`:105`) entre medias. | revisor |
| 🟠 dinero | `invoiceWhatsApp.service.ts:78` | Doble envío con `chargeId` nulo → dos Charge y dos enlaces de pago para una misma factura. | revisor |
| 🟠 dinero | `connect.routes.ts:54` | Doble clic → dos cuentas Express; el merchant puede quedar apuntando a la que no completó el KYC. | revisor |
| 🟠 dinero | `quotesAdmin.routes.ts:483` | **El caso de 1285** (ancla). | ✔ ancla |
| 🟡 estado | `system/quoteAdmin.ts:377` y `:424` | **SCRUM-1276 por el camino del admin:** aceptar/rechazar desde el panel sin condición en el `where`, mientras que el camino público (`quotes.routes.ts:468`) ya la lleva. | revisor |
| 🟡 estado | `albaranPublic.routes.ts:440` | La firma comprueba versión (`:399`) y transición (`:380`) sobre la lectura: un PATCH entre medias sella un contenido que el cliente no vio. | revisor |
| 🟡 estado | `maintenance.service.ts:522` | Escribe `active: plan.active` leído: un «cancelar» cruzado se revierte. | revisor |
| 🟡 estado | `sendQuote.service.ts:113`, `quotesAdmin.routes.ts:750` | Lee `draft`, espera al envío y escribe `sent`: puede pisar un `accepted`. | revisor |
| 🟡 estado | `connect.routes.ts:87` | Llamada de red entre lectura y escritura: revierte el `active` que escribió el webhook. | revisor |
| ⚪ menor | `subscriptions.routes.ts:116`, `albaranWhatsApp.service.ts:133`, `registroDeEnvios.ts:317`, `whatsappLog.service.ts:142`, `entornoApp.service.ts:93` | Clientes de Stripe duplicados, un token enviado que queda invalidado, estados de mensaje que retroceden, telemetría. | revisor |
| ⚪ inalcanzable hoy | `invoice.routes.ts:108` | Resucitaría una factura anulada, incluso sin carrera, pero el router `/invoice` va tras `requireInternalSecret` y **no tiene llamadas internas** (`app.ts:357-360`). | ✔ leído |

**Tres fallan sin carrera ninguna:** `psp:346`, `psp:357` e `invoice.routes:108`. Las dos primeras no tienen que esperar
al patrón de versión.

**Fuera de las 30 pero del mismo mecanismo (revisor):** `mpWebhook.routes.ts:105` (el censo la da LEE-SIN-DECIDIR y
tiene la doble transición a `paid` de `psp:119`), y la carrera de sellado de `ensureInvoiceForCharge` (`invoicing.ts:228/298`).

## Lo que el censo NO ve (declarado)

- Una lectura en otra función (servicio que lee, ruta que escribe) → sale A-CIEGAS. Ahí hay que buscar ese caso.
- `$executeRaw` y el SQL a mano.
- Si hay un candado (`$transaction` con `FOR UPDATE`, `pg_advisory_xact_lock`), el censo no lo sabe: lo dice la revisión.
- Las 18 OPACO (`data` o `where` en variable) no están revisadas.

## Lo que NO se ha tocado

Nada de `src/`, `public/` ni del esquema. Carriles de lo encontrado: dinero y cobros → S1/J (según `dos-equipos.md`);
lo fiscal (`invoiceAdmin.ts`, `invoice.routes.ts`, `invoicing.ts`) → J1, **solo se ha leído**.
