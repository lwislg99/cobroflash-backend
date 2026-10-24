# SCRUM-1455 · CRUCE DE CARRIL DECLARADO (`area-j1`, lo trabaja J2e) — un id que no cabe en la columna daba 500 en la ficha de factura: 7 lecturas hechas, 9 no

**Medido contra:** `origin/main` = `b71719f32f623729debec40518e3c7c6d3601086` · 2026-10-06T13:45:45Z

6-oct-2026 · **J2e** (puesto J2, equipo de Javier), por encargo del orquestador (`cobroflash-backend-90`).
[Escrito por J2e, una sesión; no por el fundador.]

El ticket es del carril de J1. Lo trabaja J2 porque el orquestador dio los tres de la familia (1455,
1456, 1457) a una sola sesión, para que haya UNA forma de leer el id. La forma, el borde derivado del
esquema, la sonda con Postgres de verdad y el banco de mutaciones están en `docs/master/SCRUM-1456.md`
(Ⓐ, Ⓑ, Ⓓ y Ⓕ) y no se repiten aquí.

A9: aviso → cicatriz J2 «otra hora a ojo en un mensaje al orquestador: puse ~13:50Z y GitHub, leído minutos después, decía 13:28Z; es la quinta línea de J2 con lo mismo» — no se pudo comprobar: el mensaje al orquestador sale por la herramienta de mensajes, que ningún hook del repositorio ve antes de enviar

## Ⓐ El censo de este ticket: 16 líneas, 16 lecturas

Numeración de `origin/main` = `8dcc6d2a` (la del ticket). En la rama, `invoicesAdmin.routes.ts` baja
una línea por el `import`.

| Línea | Ruta | Estado |
|---|---|---|
| `invoicesAdmin.routes.ts:245` | `GET /:id` (la medida en producción el 2-oct) | **HECHO** |
| `:348` | `GET /:id/dispute-package` | **HECHO** |
| `:525` | `PUT /:id/tags` | **HECHO** |
| `:1269` | `GET /:id/pdf` | **HECHO** |
| `:1330` | `PATCH /:id/asignados` | **HECHO** |
| `:549` | `PUT /:id/status` | NO HECHO → al fundador (SCRUM-1456 c.18414) |
| `:593` | `POST /:id/pay` | NO HECHO → al fundador (c.18414) |
| `:614` | `POST /:id/unpay` | NO HECHO → al fundador (c.18414) |
| `:873` | `POST /:id/annul` | NO HECHO → al fundador (c.18414: camino de sellado) |
| `:1025` | `POST /:id/rectify` | NO HECHO → al fundador (c.18414: camino de sellado) |
| `:309` | `POST /:id/payment-anomaly` | NO HECHO: c.18414 no la nombra en ninguna de sus dos listas, así que no está autorizada |
| `:1188` | `POST /:id/regenerate-pdf` | NO HECHO → al fundador (c.18414: camino de sellado) |
| `:647` | `POST /:id/resend-whatsapp` | **HECHO** (GO: SCRUM-1456 c.18414; hoy contestaba 500) |
| `:698` | `POST /:id/send-email` | **NO HECHO, aunque c.18414 lo autoriza**: hoy contesta 200 con `sent: false`, no 500, y pasarlo a 400 cambia lo que hace la pantalla. La condición del GO era parar si algo reaccionaba |
| `:734` | `POST /:id/send-reminder` | **HECHO** (GO: SCRUM-1456 c.18414; hoy contestaba 500) |
| `invoicing/app/routes/invoice.routes.ts:63` | `POST /:id/paid-webhook` | NO HECHO → al fundador (c.18414: webhook) |

La autorización es **SCRUM-1456 c.18414** (GO parcial del orquestador, 6-oct-2026, vale para los tres
tickets): lo que dice y lo que no he hecho aun teniéndola está en `docs/master/SCRUM-1456.md`, Ⓗ.

🔴 **Las siete que siguen validando con `Number.isNaN` (`status`, `pay`, `unpay`, `send-email`, `annul`,
`rectify`, `regenerate-pdf`) no tienen sólo el 500:** un id DECIMAL pasa esa validación y Prisma lo
trunca, así que `/admin/invoices/1.5/…` opera sobre la factura 1. Medido el mecanismo con Postgres de
verdad en tres tablas, lectura y escritura (`SCRUM-1456.md`, Ⓓ); en estas siete rutas está LEÍDO y
deliberadamente no ejecutado. Mismo comercio: no es tenencia.

`PATCH /:id/asignados` lee además ids del cuerpo (`assignedUserIds`): ya pasaban por `cabeEnColumnaInt`
desde SCRUM-1379 (`normalizarAsignados`). No hay nada que añadir.

**`librosAeat.routes.ts:18`** (el punto C del ticket, «contado, no abierto»): ABIERTO. `entero()` lee el
año y el trimestre de la query; el año acaba en `new Date(año, …)` (`rangoTrimestre`), no en una columna
`Int`. **No es este defecto y no se toca.** Qué contesta esa ruta a un año absurdo NO lo he medido.

## Ⓑ Lo corrido

- Rojo primero, por la ruta: las 5 primeras lecturas caían contra el build de `main` (500 en las cinco); las dos de
  envío, en su propia pasada, también (500 las dos).
- Con Postgres de verdad: `GET /admin/invoices/2147483648`, `/10000000000` y `/99999999999999999999`
  daban **500** y dan **400**; lo mismo `…/pdf` y `…/dispute-package`. `2147483647`, `-1` y `0` siguen en
  404. `abc` sigue en 400. `1.5` pasa de 404 a 400 en `GET /:id` y en `/pdf` (cambio de conducta que el
  ticket ya anuncia).
- Mutaciones: 14 de 14 (7 llamadas × 2 variantes), dentro de las 50 del banco.
- «Un id que existe, 200»: con la base doblada, en `PUT /:id/tags`. **`GET /:id` con una factura que
  existe NO se ha ejecutado** (ni doblada ni de verdad): la sonda no siembra facturas.

## Ⓒ Lo que queda sin hacer, dicho

- 9 de 16 lecturas (tabla de Ⓐ). **Este ticket no se cierra con este PR.**
- No visto en yaqu.app: la cuenta QA está caducada.

---

## J1 · SCRUM-1455b · un id decimal ANULA Y SELLA la factura que no es — medido por la ruta real, sin arreglo

**Medido contra:** `origin/main` = `f4cac4820bf65d7cc737ed3a7672e423a7fc1547` · 2026-10-20T15:13:39Z (hora de GitHub; sesión J1 `jv-j1a`, por encargo del orquestador `cobroflash-backend-09`)

A9: comprobación → `docs/evidencias/scrum1455/sonda-factura.mjs.txt`

[Escrito por J1, una sesión; no por el fundador.] El fallo propio que esa línea ata: en la primera pasada
de la sonda, `unpay`, `rectify` y `regenerate-pdf` salían «no» con un control que TAMPOCO actuaba (409 y
500 por la siembra: una F1 no se des-paga, el flag ES apagado, una factura sin sellar). Eso no era «no»: era
«no lo he podido juzgar», y lo habría entregado como un no. Ahora el veredicto tiene tres valores y un SIN
JUZGAR deja la sonda en CIEGA. Su rojo: con la siembra de entonces (`SONDA_SIN_EXTRA=1`) sale «2 de 16 rutas
SIN JUZGAR · EXIT=2» (`sonda-factura.sin-juzgar.salida.txt`).

### 🔴 La respuesta a ③: SÍ

`POST /admin/invoices/31.5/annul` **anula la factura 31 y SELLA su anulación en la cadena VeriFactu** del
comercio: `status` → `annulled`, `vfAnulHash` escrito, `vfAnulPrevHash` encadenado al eslabón anterior, y
la auditoría dice `factura_anulada` sobre la 31. La respuesta es 200 con `"number":"2026-S-0031"`,
`"veriFactu":true`. No es un código de error: es un registro de anulación de un documento fiscal que nadie
pidió anular, y un eslabón sellado no se deshace (regla 29).

Y no es la única: `POST /admin/invoices/34.5/rectify` **emite una R1 (`2026-CF-R-001`) sellada que rectifica
la 34**.

### ① El censo, re-medido: 16 lecturas en 16 líneas

`invoicesAdmin.routes.ts` (15) e `invoice.routes.ts:62` (1). Carril: `node scripts/carriles.mjs de
src/modules/system/app/routes/invoicesAdmin.routes.ts` → **J1**. El test lo ata: sus 16 filas son, como
conjunto, las rutas con `:id` de los dos routers, leídas del `dist` (no de un grep).

| Cómo valida hoy | Rutas | Un `1.5` |
|---|---|---|
| `cabeEnColumnaInt` | `GET /:id`, `dispute-package`, `tags`, `resend-whatsapp`, `send-reminder`, `GET /:id/pdf`, `asignados` | 400 |
| `Number.isInteger` | `payment-anomaly`, `invoice.routes.ts` `paid-webhook` | 400 |
| **`Number.isNaN`** | **`status`, `pay`, `unpay`, `send-email`, `annul`, `rectify`, `regenerate-pdf`** | **pasa, y Prisma lo trunca** |

### ② Lo que hace HOY cada una, por la ruta real

Montaje de SCRUM-1456 sin cambios de fondo: routers de `dist/` (build de `main` `f4cac482`, `tsc --noCheck`),
Prisma de verdad, Postgres de verdad (PGlite por socket en loopback, base desechable con el DDL de
`prisma migrate diff --from-empty`), sólo la sesión doblada (y `requireInternalSecret` en el webhook
interno). Por ruta se siembran tres facturas —la del decimal, la del control y una de OTRO comercio— y tras
cada petición se mira QUÉ FILA cambia, qué filas nacen y qué auditoría se escribe. **112 peticiones, 16
rutas × 7 casos.** `INVOICING_ES_ENABLED` va encendido SÓLO en la fila del comercio desechable: sin él la R1
no llega a emitirse. Sonda: `docs/evidencias/scrum1455/sonda-factura.mjs.txt`; salida:
`sonda-factura.antes.salida.txt`.

| Ruta | `x.5` | `2147483648` / `1e20` | id correcto (control) | otro comercio |
|---|---|---|---|---|
| `PUT /:id/status` | 🔴 200, **marca pagada la x** | 500 | 200, la suya | 404 |
| `POST /:id/pay` | 🔴 200, **marca pagada la x** | 500 | 200, la suya | 404 |
| `POST /:id/unpay` (justificante) | 🔴 200, **des-paga la x** | 500 | 200, la suya | 404 |
| `POST /:id/send-email` | 🔴 200, **manda el correo de la x** (`invoice-2026-S-0025.eml`) | 200 `sent:false` | 200, la suya | 404 |
| `POST /:id/annul` | 🔴 200, **anula y sella la x** | 500 | 200, la suya | 404 |
| `POST /:id/rectify` | 🔴 201, **emite la R1 de la x** | 500 | 201, la suya | 404 |
| `POST /:id/regenerate-pdf` | 🔴 200, **regenera el PDF de la x** | 500 | 200, la suya | 404 |
| `POST /:id/payment-anomaly` | 400 | **500** | 200 | 404 |
| `POST /invoice/:id/paid-webhook` | 400 | **500** | 200 | sin comercio (ruta interna) |
| las otras siete | 400 | 400 | 2xx, salvo `GET /:id/pdf` (500: la factura sembrada no está sellada) | 404 |

**④ Los dos controles, medidos:** el id correcto sigue llegando a SU factura en las 16 (la columna
«control»), y **ninguna factura de otro comercio cambia en ninguna de las 30 peticiones de tenencia** (15 rutas × 2): todas
las consultas filtran por `merchantId`, y la fila a la que resuelve el decimal es del comercio de la sesión.
El webhook interno no tiene comercio: busca por id a secas, por diseño, y no entra en este control.

El correo no salió de la máquina: sin `RESEND_API_KEY` ni `SMTP_URL`, el servicio lo deja en un `.eml` del
directorio de trabajo de la sonda (fuera del árbol), y el nombre del fichero dice de qué factura es.

### La sonda y el test, contra lo que harían con el arreglo — sin tocar `src/`

`tests/scrum1455b-un-decimal-no-llega-a-otra-factura.test.mjs` (base doblada que anota los números que llegan
a cada consulta): contra el build de `main`, **33 casos, 26 pasan, 7 caen**, y los 7 son el «decimal → 400»
de las siete de `Number.isNaN`; el censo y los 16 controles, en verde (`test.rojo-contra-main.salida.txt`).
Es otra sonda, independiente de la de Postgres, y caza el mismo conjunto.

Para saber si el test SABE ponerse verde, se parcheó SÓLO el `dist/` compilado (que no se sube) con
`Number.isNaN(id)` → `!cabeEnColumnaInt(id)` en esas siete: **33 de 33** (`test.dist-parcheado.salida.txt`),
y la sonda dice **los 16 decimales → 400 y los 16 controles siguen actuando** (`sonda-factura.dist-parcheado.salida.txt`).
Después se recompiló y el `dist` volvió a su sha256. La sonda se niega si la etiqueta no casa con el código
que lee: «DESPUES» sobre `main` y «ANTES» sobre el parcheado salen CIEGA, exit 2 (`sonda-factura.control-etiqueta.salida.txt`).

### 🔴 ESTE PR SALE ROJO A PROPÓSITO — no se toca el test para ponerlo verde

Siete casos de `scrum1455b` caen hasta que entre el arreglo. **El arreglo toca el camino de emisión, y es
STOP (regla 40):** `annul` (sella la anulación), `rectify` (emite y sella la R1) y `regenerate-pdf` (el
documento) son emisión; `status`, `pay` y `unpay` son cobro; `send-email`, con un id que no cabe, pasaría de
200 a 400 (la pregunta de pantalla que dejó abierta SCRUM-1456 c.18414). Las siete van al fundador desde
c.18414. Qué es el arreglo, para que se decida sobre algo concreto: **un token por línea en siete líneas de
`invoicesAdmin.routes.ts`** (`:550`, `:594`, `:615`, `:700`, `:875`, `:1027`, `:1190`), el `import` ya está y
ninguna firma ni consulta cambia.

### De paso, sin arreglar

- `payment-anomaly` y `paid-webhook` siguen dando **500** a un id que no cabe: su `Number.isInteger` para el
  decimal y no el tamaño. No es el defecto del decimal; `paid-webhook` es webhook (al fundador, c.18414) y
  `payment-anomaly` no la nombra c.18414.
- **No visto en yaqu.app.** No lo he intentado: anular por URL una factura real es justo lo que no se hace.

## J1 · SCRUM-1455b (relevo) · el arreglo: las siete de `Number.isNaN` pasan a `cabeEnColumnaInt`, con la firma que ya existía

**Medido contra:** `origin/main` = `e306a6a5e5b45a2e98792d30eee02fdec5ea2362` · 2026-10-23T16:03:34Z (hora de GitHub; mezclado en la rama, A4; sesión J1 `jv-j1at`, por encargo del orquestador `cobroflash-backend-62`)

A9: aviso → cicatriz J1 «Declaré en un registro que un arreglo esperaba la firma del fundador sin leer los comentarios de los tickets hermanos, y la firma ya existía desde el 7-oct en otro ticket» — no se pudo comprobar: la firma vive en un comentario de Jira, y ningún guard del repositorio lee Jira

[Escrito por J1, una sesión; no por el fundador.] **Corrección al tramo anterior, que es de este mismo
puesto:** «Las siete van al fundador desde c.18414» era falso el 20-oct. El fundador ya había firmado seis
el **7-oct, en SCRUM-1456 c.18731** («1-La autorizo», opción A): `status`, `pay`, `unpay`, `annul`,
`rectify` y `regenerate-pdf` (más `payment-anomaly` e `invoice.routes.ts:63`). El tramo y el PR #2628 no la
citaban. Lo encontró el PASO 0 del orquestador. La séptima, `send-email`, la firmó el **23-oct en
SCRUM-1455 c.20593** («Sí, también esa»), con su efecto aceptado: 400 en lugar de 200 con `sent:false`.

### El cambio

Un token en siete líneas de `src/modules/system/app/routes/invoicesAdmin.routes.ts`: `Number.isNaN(id)` →
`!cabeEnColumnaInt(id)`, en `:553` (`status`), `:597` (`pay`), `:618` (`unpay`), `:703` (`send-email`),
`:881` (`annul`), `:1033` (`rectify`) y `:1196` (`regenerate-pdf`), leídas en el árbol tras el merge. El
`import` ya estaba (`:30`). Diff: 7 líneas por 7, y en ninguna cambia la respuesta ni el texto (las siete ya
contestaban `400 invalid_id`). **Ninguna consulta, firma, sellado, numeración ni huella se toca**: es la
guarda de entrada, antes de leer nada (condición ⑤ de c.18731; regla 40).

### Rojo → verde, por la ruta

`tests/scrum1455b-un-decimal-no-llega-a-otra-factura.test.mjs`, sin tocarle una aserción, contra `dist/`
recompilado del árbol (`tsc --noCheck`): antes **33 casos, 26 pasan, 7 caen** (tramo anterior,
`test.rojo-contra-main.salida.txt`); ahora **33 de 33**, 0 caen, 0 saltan.

**Mutación, sobre `dist/` y no sobre `src/`:** las 14 guardas `cabeEnColumnaInt(id)` del fichero compilado
vueltas una a una a `Number.isNaN(id)`: **14 de 14 caen, y cada una sólo en el caso «decimal → 400» de su
ruta** (32 pasan + 1 cae = 33). El `dist/` volvió idéntico al final de la pasada.

### La condición ② de c.18731 (que nada reaccione distinto a un 400 que a un 500): LEÍDA, no ejecutada

Las pantallas que llaman a estas rutas (`invoiceDetailView.js` `status` :494, `rectify` :657,
`regenerate-pdf` :747, `annul` :878; `quotesDetailView.js` :1072; `jobDetailView.js` :2240) sólo
distinguen `!r.ok`, nunca 400 de 500, y todas mandan `invoice.id` leído de la base: ninguna produce un
decimal ni un id que no quepa. `send-email` es la única que cambia de rama (200 `sent:false` → 400), y
ese efecto es el que firmó c.20593. **No lo he ejecutado en un panel real.**

### Lo que no hace este tramo, dicho

- `payment-anomaly` (`:310`) y `invoice.routes.ts:63` (`paid-webhook`) siguen con `Number.isInteger`: el
  decimal ya da 400, pero un id que no cabe sigue dando **500**. **Cubiertas por c.18731, pendientes:
  siguiente tramo** (decisión del orquestador `cobroflash-backend-62`, 23-oct: otra forma, otro PR).
  `paid-webhook` es webhook: su condición ② está sin medir.
- **Tanda entera en local** (árbol anidado, `dist/` con `tsc --noCheck`): 12.370 tests, pasan 12.184,
  caen 24, se saltan 162 (suman). Ninguno de los 24 lee `invoicesAdmin`: 22 son del entorno (cliente de
  Prisma y CLI del checkout compartido, `node_modules`, hooks del árbol principal); `scrum1199` cae igual
  con las siete guardas devueltas a `Number.isNaN` (2 de 4), y `scrum1266b` pasa 15 de 15 suelto, dos
  veces, con el cambio. Lo que decide es el obligatorio de CI.
- **No visto en yaqu.app**: no lo he intentado; la prueba sería anular o sellar por URL, que no se hace.

## J1 · SCRUM-1455c · las dos que quedaban: `payment-anomaly` y `paid-webhook` pasan a `cabeEnColumnaInt`

**Medido contra:** `origin/main` = `28098fe4b1a160303526f5a4002d52556d2c5b22` · 2026-10-23T19:04:31Z (hora de GitHub; sesión J1 `jv-j1au`, por encargo del orquestador `cobroflash-backend-62`)

A9: comprobación → `tests/scrum1455c-anomalia-y-webhook-id-que-cabe.test.mjs`

[Escrito por J1, una sesión; no por el fundador.] La línea `A9:` apunta al caso «condición ②» de ese test:
el tramo anterior dejó la condición ② de `paid-webhook` «sin medir», y ahora es un censo que cae en
rojo el día que alguien del repositorio empiece a llamar a esa ruta, que es justo cuando un 400 y un 500
dejarían de ser indistinguibles.

**Firma:** SCRUM-1456 **c.18731** (fundador, 7-oct-2026, «1-La autorizo»), que nombra las dos en su tabla:
`payment-anomaly` 309 e `invoice.routes.ts:63`. Leída entera en Jira el 23-oct. Ninguna otra.

### El cambio

- `src/modules/system/app/routes/invoicesAdmin.routes.ts:310` (`POST /:id/payment-anomaly`):
  `!Number.isInteger(id)` → `!cabeEnColumnaInt(id)`. El `import` ya estaba (`:30`).
- `src/modules/invoicing/app/routes/invoice.routes.ts:64` (`POST /:id/paid-webhook`, era `:63`):
  `!Number.isInteger(invoiceId)` → `!cabeEnColumnaInt(invoiceId)`, más la línea del `import` (`:4`).

Las dos líneas **ya contestaban 400** (`invalid_input` e `invalid_invoice_id`) a un id que no es entero: no
nace ninguna respuesta nueva, ningún texto cambia. Ninguna consulta, sellado, numeración ni huella se toca
(condición ⑤ de c.18731; regla 40). El helper es de S1 y no se toca.

### Rojo → verde, por la ruta

`tests/scrum1455c-anomalia-y-webhook-id-que-cabe.test.mjs`: las peticiones entran por HTTP en un `express`
montado como `src/app.ts` (`/invoice` detrás del `requireInternalSecret` de `dist/`, con su cabecera;
`/admin/invoices` con el `requireRole` de la propia ruta). Sólo `requireAuth` se sustituye, por
`reqDeSesion`. La base doblada lanza, como Postgres, si le llega un número que no cabe en un int4.

- **Antes del arreglo** (`dist/` de la rama sin tocar `src/`): 8 casos, **6 pasan, 2 caen**: las dos rutas
  contestan **500** con `2147483648`.
- **Después:** 8 de 8, junto con `scrum1455b` (33): **41 de 41**.
- Casos: id que no cabe (`2147483648`, `10000000000`, `99999999999999999999`, `-2147483649`) → 400 y cero
  consultas · `abc` y `1.5` siguen en 400 · SUELO: `1`, `2147483647`, `0` y `-1` llegan a la base y dan 404
  (la doble no tiene la factura) · sin el secreto, `/invoice` sigue en 404 sin consultar.
- **Mutación sobre `dist/`:** cada una de las dos guardas vuelta a `Number.isInteger`: **2 de 2 caen, y cada
  una sólo en el caso «no cabe» de su ruta** (7 pasan + 1 cae = 8). `dist/` restaurado byte a byte.

### La condición ② de c.18731 (que nada reaccione distinto a un 400 que a un 500)

- `paid-webhook`: **nadie del repositorio la llama.** Censo del test: `src/`, `public/` y `scripts/`, más de
  100 ficheros; la palabra sólo está en el router que la declara (el positivo) y en un comentario de
  `src/app.ts` («legacy n8n […] Sin llamadas internas»). Desde fuera, sin el secreto, contesta 404 antes
  de llegar al id. **No medido:** un llamante fuera del repositorio con el secreto; no existe ninguno que
  yo pueda ver, y n8n está prohibido (regla 1).
- `payment-anomaly`: la llaman `invoiceDetailView.js:475` y `jobDetailView.js:2234`, con `invoice.id` leído
  de la base, y las dos acaban en el mismo `catch` con cualquier respuesta que no sea 2xx. **Leído, no
  ejecutado en un panel real.**

### Lo que no hace este tramo, dicho

- **`POST /admin/invoices/bulk-paid` (`invoicesAdmin.routes.ts:464`)**: lee los ids del CUERPO con
  `.filter(Number.isInteger)`, así que un id que no cabe llega a la base. **c.18731 no la nombra** y es
  marcar como pagada (flujo de cobro): **no se toca**; va al orquestador. No medido qué contesta hoy.
- **Error propio, cazado por un guard:** la primera versión del test construía tres nombres de `test()`
  en un bucle; `tests/scrum1415-nombres-construidos.test.mjs` la tumbó en la dirigida (932 tests, 1 cae).
  Ahora van seis nombres literales; ni la lista de 1415 ni ninguna aserción se tocaron.
- **Dirigida local** (89 ficheros: los guards de suite y de registro del encargo más todo test que nombra
  estas rutas o `cabeEnColumnaInt`): **932 tests, pasan 924, caen 0, se saltan 8** (suman; 6 sin
  `LIBRO_PG_URL` y 2 sin `QA_DB_TEST`), con el test ya corregido.
- **Suite entera local: NO CORRIDA.** Lanzada una vez en primer plano, no acabó en los 10 min del arnés,
  que la pasó a segundo plano; la paré sin leerla. El obligatorio de CI hace de suite.
- **No visto en yaqu.app:** no lo he intentado (una es un POST que anota en la ficha y la otra exige el
  secreto interno).
