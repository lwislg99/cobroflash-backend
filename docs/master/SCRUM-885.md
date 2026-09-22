# SCRUM-885 · El cobro a un cliente sin email: el documento no salía y el profesional no se enteraba

**Medido contra:** `origin/main` = `4b0d5739bc19e7bad5109a32822ef7039d9ca860` · 2026-09-16T13:36:13Z
**Rama:** `scrum-885-cliente-sin-email` · **Estado:** #1364 MERGEADO (`364e7d3a267d8babc49a92244168dc12096ce996`). Remate `scrum-885b-aviso-fijo-factura` EN PR (sesión 3: aviso fijo en la ficha). Pendiente: la firma del literal con su comentario de Jira (ver «Microcopy» y sesión 3)

## PASO 0 · medido corriendo, en local (nunca producción ni staging)

Postgres desechable propio (`127.0.0.1:55885`, base `yaqu_885_test`, esquema por `migrate diff
--from-empty` con el CLI local), `node dist/index.js` con `AUTO_INVOICE_ON_PAID` y
`AUTO_EMAIL_INVOICE_ON_PAID` encendidos y sin ninguna clave externa. «Confirmar Bizum recibido» con
la sesión del profesional sobre tres cobros.

**La primera pasada NO llegó al envío** (líneas de presupuesto mal formadas en la semilla →
`factura_sin_lineas`, sin factura): se contó como «no pude mirar» y se rehízo el banco.

| | sin email ni teléfono | solo teléfono | con email (control positivo) |
|---|---|---|---|
| Factura emitida | F260001 | F260002 | F260003 |
| ¿Se intenta el email? | **no** | **no** | sí — `invoice-F260003.eml`, `To:` el cliente |
| ¿Queda algo? | **nada**: ni evento, ni fila, ni log | nada del email (sí el intento de WhatsApp) | evento `emailed` |
| Respuesta al profesional | `{"ok":true,"status":"paid"}` | igual | igual |
| Pantalla | toast fijo «✓ Bizum confirmado: factura cobrada.» | igual | igual |

El detalle del trabajo y el de la factura eran idénticos con y sin email salvo el propio email. Causa:
`psp.routes.ts:199`, `AUTO_EMAIL_INVOICE_ON_PAID && customer.email` no entra y no deja nada. Todos
los caminos de cobro (Bizum manual, Stripe, Connect, recibo) desembocan en ese webhook.

## Decidido (orquestador, 16-sep-2026)

1. **Opción (b):** se avisa SOLO si el documento no salió ni por email ni por WhatsApp. El WhatsApp
   vale si su fila dice enviado o más (`SENT_OR_MORE` de `whatsappLog.service.ts`, que incluye
   `read`: es la definición de la casa, no una nueva). Fallido —ahora o después, por el webhook de
   estado— o sin intento, no cuenta.
2. **Dos sitios:** la respuesta de «Confirmar Bizum» (toast) y, permanente, la fila de la factura del
   trabajo. Calculado de lo ya guardado, una sola regla para dashboard y test.
3. **Con `AUTO_EMAIL_INVOICE_ON_PAID` APAGADO no se avisa.** Ese caso —no le llega a NADIE— es otro
   problema y NO es de este ticket. El valor de producción lo mira el fundador.

**Literal firmado:** «El documento no se ha enviado: el cliente no tiene email. Añade su email en su ficha y envíaselo.»

## Commits

| sha | qué |
|---|---|
| `61a6cbdcc63260597d792724bec0040c540a7dd5` | el ROJO: cae hoy por aserción en 3 casos, con el suelo de emisión cumplido |
| `11ca3d1e4ebce690b4d36ef8de2edfe2b64068e3` · 2026-09-16T14:01:03Z | hechos + regla: 7/7 verde |

### El rojo, sobre el código de `4b0d5739`

`tests/scrum885-documento-sin-enviar.test.mjs` conduce los handlers REALES (`confirm-bizum` → `psp`
por su «red» → `GET /admin/jobs/:id`) con base, emisión, correo y WhatsApp doblados. Hoy:
**3 ✖ por aserción** (sin email ni WhatsApp: «la respuesta de Confirmar Bizum no deja aviso visible»;
WhatsApp fallido; fallo posterior) y 4 ✔ (con email, WhatsApp enviado, flag apagado, ningún envío
nuevo). Suelo: si el cobro no emite el documento, falla «NO PUDE MIRAR».

### Lo construido

* `src/modules/billing/domain/envioDelDocumento.ts` — los HECHOS: `autoEmail`
  (`AUTO_INVOICE_ON_PAID` **y** `AUTO_EMAIL_INVOICE_ON_PAID`, las dos condiciones con las que psp
  envía), `clienteTieneEmail`, `whatsapp` ∈ `enviado | no_enviado | sin_intento | en_curso`.
  `no_enviado` incluye `failed` y un `queued` que no avanzó.
* `confirm-bizum` devuelve `envioDocumento`. psp lanza el WhatsApp sin `await`, así que al volver
  puede no haber fila: se espera **como mucho 3 s** y sólo si el aviso depende de ello (sin email y
  con número). Si no llega → `en_curso`, que **no avisa** en el toast; la fila del trabajo, que se
  relee, dirá lo que acabe pasando. Consecuencia declarada: un cliente con número y baja de WhatsApp
  (J3, sin fila) no avisa en el toast pero sí en la fila.
* `GET /admin/jobs/:id` — cada factura con cobro **pagado** lleva `envioDocumento` (`null` si no).
  Dos consultas para todas, filtradas por `merchantId` (regla 2).
* `public/dashboard/js/avisoDocumentoSinEnviar.js` — la regla y el literal firmado.
* **`psp.routes.ts` no se toca. Ningún envío nuevo. Sin schema. El camino de emisión, intacto.**

## Sesión 2 · 16-sep-2026 · medido contra GitHub `Date: Wed, 16 Sep 2026 14:46:28 GMT`

Arranque: `git merge origin/main` dentro de la rama (sin rebase), suite de lo mío en verde.

### Corrección del orquestador: EN COLA no es fallo

La regla anterior contaba cualquier `queued` como no enviado, y eso avisaba casi siempre en falso: un
WhatsApp en cola todavía no ha fallado.

* `queued` con menos de 10 minutos → `en_curso` («todavía no se sabe») → **sin aviso**.
* `queued` con más de 10 minutos → `no_enviado` → **con aviso** en la fila (atascado: no se calla para siempre).
* `failed` o sin intento → con aviso. `SENT_OR_MORE` → sin aviso.

Lo decide `estadoWhatsappDeFilas` con el `createdAt` de la fila; la regla del dashboard no cambia
(`en_curso` sigue sin avisar). Las dos rutas seleccionan `createdAt`.

### Commits de la sesión 2

| sha | qué |
|---|---|
| `4fafb054e604e5f11184171e5479590dcd65644d` | ROJO de la cola: los dos casos caen por aserción (toast avisa sobre un `queued` recién puesto; la fila avisa a los 9 min) |
| `b2c092bb03e55d981d891d58e9d5f6c49531d07e` | cola: `en_curso` hasta 10 min, luego `no_enviado` — 9/9 |
| `4a68d9f1b354a4690c794a17d507ca76c66571f9` | vista: fila (`.alert.warning`, AB3) + toast `warn` en jobDetailView e invoiceDetailView; script en index.html, SHELL del SW y `SCRIPTS_DEL_DASHBOARD`; atadura vista↔regla por AST |
| `b2f4062c7fc7da7e2fe1c6e3920c4156316a5c28` | factura aún sin cobrar no avisa (un mutante sobrevivía) |
| `f9bbd543a1a630b883dcb0fdd27bc66698f79d9f` | guards 860 y 411 de la tanda |

### La vista

* **Componentes reutilizados, ninguno nuevo:** `.alert.warning` dentro de la `.job-doc-row` (sólo un
  modificador `.job-doc-row__aviso { margin-top: 8px }`, la misma distancia que las acciones) y
  `showToast(texto, 'warn')`.
* **Confirmar Bizum (trabajo):** el ✓ se queda —el cobro SÍ está hecho— y el aviso va aparte. Tras el
  `refresh()` la fila lo conserva.
* **Confirmar Bizum (ficha de factura, `invoiceDetailView.js`):** toast, porque la pantalla se repinta
  justo después y se llevaría el aviso de estado.
* **Declarado:** el toast `warn` dura 3 s (`TOAST_MS_OK`: sólo `error` escala con el largo) y el literal
  tiene 98 caracteres. En el trabajo no importa (la fila lo deja fijo). **En la ficha de factura es el
  único sitio** y 3 s es poco para leerlo; no se ha tocado `duracionToast` (afecta a todos los avisos).
  Queda como hallazgo para el orquestador.

### Atadura vista↔regla (AST, `typescript`)

Las tres superficies llaman a `avisoDocumentoSinEnviar`: la fila con `inv.envioDocumento` dentro de
`invoices.forEach` y su `.texto` a `textContent`; los dos manejadores de `confirm-bizum` con la
respuesta de ESA petición y su `.texto` a `showToast`; y ninguna vista lleva una copia del literal.
Las variables se resuelven **en su función**: el manejador del botón vive dentro del `forEach` de la
fila y declara otra `avisoEnvio`, así que por nombre a secas los usos de uno contaban como del otro
(la primera versión del test cayó justo por eso).

### Rojos por mutación (8, todos ROJOS; reverso: 13/13)

| mutante | caen |
|---|---|
| la fila no llama a la regla | la atadura de la fila |
| la fila copia el literal | las ataduras de la fila y del toast del trabajo |
| el toast del trabajo lee `inv.envioDocumento` | la atadura del toast del trabajo |
| la ficha de factura no llama a la regla | la atadura de la ficha |
| la regla sin `no_enviado` | fallido, fallo posterior, cola >10 min |
| sin el filtro `status: 'paid'` | factura aún sin cobrar (**sobrevivía** hasta `b2f4062c`) |
| la cola nunca `en_curso` | cola recién puesta, cola >10 min (su control de 9 min) |
| la cola siempre `en_curso` | cola >10 min |

### Guards de la suite completa

Primera pasada: 7073 tests, **6 rojos, todos por esta rama** — ninguno ajeno:

* **SCRUM-860** (lecturas sin `select` hacia fuera, 82 > suelo 81): ensanchar el `include` del cobro
  en `confirm-bizum` sacaba el objeto entero hasta la respuesta. El `include` vuelve a ser el de main
  y el contacto se lee con su `select` **desde el id de la ruta** (pasarle `charge.customerId` seguía
  contaminando). Medido: 81.
* **SCRUM-411:** tres exports internos dejan de exportarse, y `SENT_OR_MORE` sale de
  `_huerfanos-declarados.mjs` porque ahora tiene lector (el trinquete al revés lo exigía).
* **SCRUM-726:** ver «Microcopy».

### Microcopy — la firma NO está completa

La firma delegada (SCRUM-861) exige en la misma línea la referencia a un comentario de Jira, y
**SCRUM-885 no tiene ningún comentario** (medido el 16-sep por el MCP). El literal se firmó en el mensaje
de arranque de la sesión. **No se ha inventado la referencia:** el registro
`docs/microcopy/2026-09-16-SCRUM-885-documento-sin-enviar.md` está escrito pero **fuera de la rama**
(con él dentro, SCRUM-726 cae con `firmante: null`). Cuando el orquestador deje el literal en un
comentario, se añade con su id.

### QA visual — medida en navegador real, no leída

App REAL (`node dist/index.js`, esta rama) contra el Postgres desechable del PASO 0 (`127.0.0.1:55885`,
`yaqu_885_test`), Edge headless por `puppeteer-core`, `BIZUM_MANUAL_ENABLED=true` sólo en ese proceso.
Semilla ampliada con facturas `pending` para pulsar los botones de verdad.

| caso | 390 px (móvil) | 1280 px |
|---|---|---|
| fila · sin email ni teléfono | aviso dentro de la fila (274×83), sin scroll horizontal | aviso (592×63), sin scroll |
| fila · WhatsApp `failed` | aviso | aviso |
| fila · CON email (control) | **sin** aviso | **sin** aviso |
| Confirmar Bizum · trabajo | toasts `ok` + `warn` con el literal, en vista; la fila avisa tras el refresh | igual |
| Confirmar Bizum · ficha de factura | toast `warn` con el literal | igual |

Errores de página: 0. **Dos «no pude mirar» en el camino, contados como tales y rehechos:** la primera
pasada fotografió detrás del modal de onboarding del merchant de la semilla (medidas válidas, fotos
no), y en la ficha de factura no llegó a pulsar nada (factura en `issued` y bandera apagada: sus
toasts eran los del trabajo, aún en pantalla). Capturas miradas una a una.

**Negativo cumplido:** ningún envío nuevo, sin schema, `psp.routes.ts` intacto, camino de emisión intacto.

## Sesión 3 · 16-sep-2026 · remate 885b · medido contra GitHub `Date: Wed, 16 Sep 2026 18:24:17 GMT`

**Rama:** `scrum-885b-aviso-fijo-factura`, desde `origin/main` = `364e7d3a267d8babc49a92244168dc12096ce996` (el merge de #1364).

### ① La firma del literal: SIGUE SIN COMENTARIO — parado

Medido por el MCP de Jira (`fields: comment`) al arrancar la sesión: **SCRUM-885 tiene 0 comentarios**.
El orquestador pidió buscar el comentario del fundador y, si no estaba, parar. **No se ha añadido el
registro de microcopy ni se ha inventado la referencia.** Se añade con su id en cuanto exista.

### ② DECIDIDO (orquestador, 16-sep): aviso FIJO también en la ficha de la factura

98 caracteres en un toast de 3 s no se leen. En la ficha va **también** el `.alert.warning` fijo, con la
MISMA regla (`avisoDocumentoSinEnviar`) que la fila del trabajo. El toast se queda. **La duración global
de los toasts no se toca.**

* `GET /admin/invoices/:id` devuelve `envioDocumento`: `null` sin cobro o con el cobro sin pagar; si no,
  los hechos de `envioDelDocumento` (email del cliente del cobro + filas del WhatsApp del cobro). Dos
  lecturas con `select` y `merchantId` (regla 2). Nada se envía.
* `invoiceDetailView.js` pinta `.alert.warning.invoice-detail__aviso` (`role="status"`) bajo la caja de
  estado. El margen va en CSS (`margin: 14px 22px 0`, el de la caja de estado): escrito desde JS subía el
  trinquete de SCRUM-713c a 341.

| sha | qué |
|---|---|
| `6f1f1f0ebed5eaf285c78482dc1ec26a35c8c278` | ROJO: 4 caen por aserción (la ficha responde 200 sin `envioDocumento`; la vista no llama a la regla fuera del confirm-bizum) |
| `bad4d3f722e08f7a38dddded7f777a591e19b734` | ruta + vista: 14/14 |
| `5f790dcbb14e478188c410522680d6169d573f4e` | el margen a CSS (trinquete 713c) |

**Rojos por mutación (4, todos ROJOS; reverso 14/14):** la ruta sin el filtro de pagada → «factura aún
sin cobrar» (falsa alarma en la ficha); la vista sin llamar a la regla, leyendo otro objeto
(`invoice.waDelivery`) o sin `warning` en la clase → la atadura por AST de la ficha.

**Suite completa (antes del arreglo del margen):** 7094 tests, 2 rojos, los dos de esta rama — SCRUM-713c
(arreglado) y SCRUM-854 (esta entrada).

### QA visual — medida en navegador real

App REAL (`node dist/index.js` de la rama) contra un Postgres desechable propio (`127.0.0.1:55889`,
`yaqu_885b_test`, esquema por `migrate diff --from-empty` con el CLI local), Edge headless, flags de envío
y `BIZUM_MANUAL_ENABLED` sólo en ese proceso.

| caso | 390 px | 1280 px |
|---|---|---|
| A · cobrada, sin email ni teléfono | aviso fijo 320×83, dentro de la página, sin scroll horizontal | aviso fijo 938×42, sin scroll |
| B · cobrada CON email (control) | **sin** aviso | **sin** aviso |
| C · «Cobrar por Bizum» en la ficha | toast `warn` con el literal **y** aviso fijo tras el repintado | — |
| C · 3,5 s después | toast ya ido (0), **el fijo sigue** | — |

Errores de página: 0. Capturas miradas.

## Sesión 4 · la firma del literal en el registro (16-sep-2026, 21:25 CEST)

La firma existía en Jira y faltaba en el repo: **SCRUM-885 comentario 15615** (20:09 CEST, orquestador por
delegación del fundador), releído con `fields: comment`; el literal coincide carácter a carácter con
`AVISO_DOCUMENTO_SIN_ENVIAR`. Registro en `docs/microcopy/2026-09-16-SCRUM-885-documento-sin-enviar.md`,
con el formato de la entrada vecina de SCRUM-890 (firma delegada), no con el borrador de la sesión 2.

| sha | qué |
|---|---|
| `e7e16261b2c7928b828ab6314ab942d947d659eb` | la entrada de microcopy |

**Medido:** `constaAprobado(literal)` → `[]` sin el fichero y → el fichero con él (control en las dos
direcciones). Guards de microcopy (726, 861, 709, 514) y el de 885: 43/43.
