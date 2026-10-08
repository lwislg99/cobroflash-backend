# SCRUM-1512 · Del alta pública a la primera plantilla: cuántos pasos hay entre un correo cualquiera y un WhatsApp saliendo del número de la casa — medido, sin arreglar nada

**Medido contra:** `origin/main` = `179c248b496a963a999b5d45f125c5b458f21d78` · 2026-10-08T02:23:05Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1512/medir.cjs`

J1 (relevo, sesión `jv-j1`, equipo de Javier). **Es MEDICIÓN.** No se toca `src/`, ni el esquema, ni ningún
workflow; entran este registro y `docs/master/evidencias/SCRUM-1512/`. Nada contra producción ni staging, y
**ninguna plantilla ha salido de esta máquina hacia ningún teléfono**: las peticiones a Meta se anotan y se
contestan dentro del propio guion (0 intentos de salir, contados). El `dist` es `tsc --noCheck` de ese commit.
Al cerrar, `origin/main` ya iba por `453d3a5130dc2c01996b1a794b14262212f241a5`: entre los dos, **0 ficheros
de `src/` ni de `prisma/`** (23 ficheros, todos de `docs/`).

## Para que nadie lo lea como un incidente

`INVOICING_ES_ENABLED` está en OFF para merchants ES reales, y con OFF, en España, ni documento ni cobro por
YaQu (regla 24). **Hay CERO merchants con clientes reales.** Esto no es un incidente: es un hueco medido antes
de que haya clientes, que es cuando medirlo sale gratis. Todo lo de abajo ocurre en una base desechable.

## 0 · El veredicto, en una frase

**Entre un correo cualquiera y una plantilla pidiéndose a Meta por el número de la casa hay CINCO peticiones
y un buzón que abrir, y ninguna la para nadie: alta, canjear el enlace del correo, crear un cliente con el
teléfono que uno quiera, crear un presupuesto y enviarlo.** Lo único que se le pide a quien llega es poder
leer el correo que escribió. **El último tramo —que Meta acepte y entregue— NO está medido**: pedía un envío
real, y ahí se paró (§6).

## 1 · Qué hace falta para registrarse (punto 1 del ticket) — ejecutado

| qué se probó | qué salió |
| --- | --- |
| `POST /auth/register` con nombre y correo, sin sesión | 200. La respuesta **no trae sesión**: crea la cuenta (`plan=trial`, `status=active`, 14 días) y manda un enlace |
| abrir el correo y canjear el enlace (`GET /auth/verify`) | 302 a `/dashboard/` **con sesión** |
| invitación, aprobación, pago, captcha, alta guiada obligatoria | **ninguno aparece**: con `onboardingCompleted=false` la cuenta crea cliente, presupuesto y envía |
| 12 altas seguidas, 12 correos distintos, misma IP | **12 de 200, 0 de 429, 12 cuentas** |
| POSITIVO del contador: 7 altas con el MISMO correo | 5 de 200, 2 de 429, 1 cuenta |
| CERO: correo sin arroba · enlace inventado · sin sesión | 400 y 0 cuentas · 302 sin sesión · 401 y 401, 0 peticiones a Meta |

**El único freno del alta es poseer el buzón.** El limitador (5 cada 15 min) cuenta por IP **y correo**, así
que no limita cuántas cuentas crea una misma dirección.

## 2 · La cadena completa, paso a paso (punto 2) — ejecutado

**Cuenta A · no dice país (la app pone `ES`).** Es el caso por defecto.

| paso | petición | respuesta |
| --- | --- | --- |
| 1 | `POST /auth/register` | 200 |
| — | abrir el correo | 1 enlace |
| 2 | `GET /auth/verify?token=…` | 302, sesión |
| 3 | `POST /admin/customers` (nombre + móvil) | 201 |
| ✗ | `POST /admin/invoices` | **409 `factura_suelta_no_disponible`**, 0 facturas: **la regla 24 aquí SÍ para** |
| 4 | `POST /quote/create` (una línea) | 201 |
| 5 | `POST /admin/quotes/:id/send-whatsapp` | **200 enviado: 1 plantilla `quote_decision_es` al teléfono que escribió** |

Una cuenta española recién creada **no llega a la ruta de `:766`** (no puede tener factura), pero **no la
necesita**: el presupuesto sale en cinco.

**Cuenta B · el mismo alta, con `country: "PT"` en el cuerpo.** `/auth/register` almacena el país que le
manden, y fuera de `ES` el modo de emisión es `fiscal` sin mirar el flag (`emission.service.ts:36`).

| paso | petición | respuesta |
| --- | --- | --- |
| 1-3 | igual que A | 200 · 302 · 201 |
| 4 | `POST /admin/invoices` (factura suelta) | **201, `F260001`** |
| 5 | `POST /admin/invoices/:id/resend-whatsapp` | 200 enviado: crea el cobro y **1 plantilla** |
| 6 | `POST /admin/invoices/:id/send-reminder` (la de `:766`) | 200 enviado: **1 plantilla `payment_request_es`** |

**A `:766` se llega en SEIS**, y la primera plantilla de factura sale en el quinto. Antes del paso 5 la
factura no tiene cobro y `send-reminder` manda **texto libre, no plantilla** (1 petición de tipo `text`):
Meta sólo entrega texto dentro de la ventana de 24 h, y eso aquí no se ve.

**Que el flag de España lo decide un campo que escribe quien se registra es lo medido, no una opinión sobre
si debe ser así.**

## 3 · De qué número sale (punto 3) — LEÍDO de la forma, nunca del valor

**Es UNO para todos los merchants.** `WHATSAPP_PHONE_NUMBER_ID` es una sola variable de entorno
(`src/core/config/env.ts:86`), y los 9 usos de `whatsapp.ts` la leen de `config`.

| control | resultado |
| --- | --- |
| campos del modelo `Merchant` | 79 (bloque de 11.005 caracteres) |
| POSITIVO: campos del `Merchant` que casan `/whatsapp/i` | 1 — `whatsappPhone` (el teléfono de contacto del profesional, no el emisor) |
| PREGUNTA: campos que casan id de número, WABA o token | **0**, y **0 de 611** en todo el esquema |
| CERO: un nombre que no existe | 0 |
| ejecutado: rutas distintas pedidas a Meta por las dos cuentas | **1** (`/v21.0/<id del entorno>/messages`), todas las peticiones |

El valor no se ha leído: en el guion ese id es un texto de laboratorio. **Si producción tiene la variable
puesta, NO lo sé** (§6). El tope de comercio (100 al día, leído en `dist`) es por cuenta, y las cuentas no
tienen tope: el riesgo **no se queda dentro de la cuenta**.

## 4 · Hallado de paso, y es de mi carril: una cuenta reenvía la factura de OTRA

`POST /admin/invoices/:id/resend-whatsapp` llama a `sendInvoicePaymentRequest(id)` **sin el comercio de la
sesión** (`invoicesAdmin.routes.ts:653`), y esa función busca la factura sólo por `id`
(`invoiceWhatsApp.service.ts:32`). Ejecutado: la cuenta A (española, que ni siquiera puede facturar) pide
reenviar la factura de B.

| petición de A sobre la factura de B | respuesta | plantillas |
| --- | --- | --- |
| `resend-whatsapp` | **200 enviado** | **1, al cliente de B** |
| `send-reminder` (contraste: misma sesión, misma factura) | 404 | 0 |

La respuesta le devuelve a A **el teléfono del cliente de B y la ficha de su enlace de pago** (`to`,
`pay_token`), y la plantilla queda anotada **a nombre de B** (consume su tope). Los `id` de factura son
enteros correlativos. **No se arregla aquí:** el encargo es medir, y el arreglo toca el camino de envío de la
factura. No encontré que estuviera registrado: 25 ficheros de `docs/` y `tests/` nombran la ruta y ninguno
habla de esto; **Jira no lo busqué**. Las otras rutas del router no se han barrido con esta pregunta.

## 5 · Lo ejecutado (12 casos, 12 cuadran; salida entera en `evidencias/SCRUM-1512/salida-medir.txt`)

Positivo obligatorio: 4 plantillas en la corrida y el contador de 429 ve 2 donde los hay; sin cualquiera de
los dos el guion sale 2 («mudo»). Rojo visto: con `--forzar-rojo` (esperar que la cuenta española SÍ emita)
sale 1, con 1 caso en rojo de 12 (`salida-rojo-forzado.txt`). Dos corridas seguidas dan la misma salida byte
a byte. Peticiones a Meta: 5 (4 plantillas, 1 texto). Intentos de salir de la máquina cortados: 0.

Reproducir, desde la raíz y con PGlite instalado fuera del repo:

    node ../../../node_modules/typescript/bin/tsc --noCheck
    node ../../../node_modules/prisma/build/index.js migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > <tmp>/esquema.sql
    node docs/master/evidencias/SCRUM-1512/medir.cjs dist <carpeta node_modules con @electric-sql> <tmp>/esquema.sql
    NO_COLOR=1 node docs/master/evidencias/SCRUM-1512/forma.mjs

(`NO_COLOR=1` para que la salida guardada no lleve bytes ESC: el guard SCRUM-942 los rechaza en el árbol.)

## 6 · Lo que NO se midió

- **El último paso de verdad: que Meta acepte la plantilla y llegue a un teléfono.** Pedía un envío real y
  está prohibido. Haría falta: credenciales que pone el fundador, un número de pruebas suyo como destino, y
  su permiso expreso. Lo medido termina en «la app le pide a Meta la plantilla, con el destino que escribió
  el recién llegado».
- **Producción.** Todo es `dist` local, `NODE_ENV=development`, base desechable. No sé si producción tiene
  puestas las credenciales de WhatsApp, ni si un proxy delante (Cloudflare, Railway) limita el alta.
- **El correo real.** Aquí el enlace se lee del log de la app (sin clave de correo, lo escribe ahí). Que un
  buzón desechable cualquiera reciba el de producción no está probado.
- **La base real.** La desechable nace de `schema.prisma`: mide qué hace el código, no qué hay en las bases
  de la casa. El cliente de Prisma es el compartido; su esquema difiere del de la rama sólo en el orden de
  dos atributos (medido con `diff -w`).
- **Otros caminos hacia una plantilla.** 7 ficheros llaman a los dos emisores de plantilla; ejecuté tres
  puntos (presupuesto, reenvío de factura, recordatorio). Albaranes, recordatorios automáticos y avisos al
  profesional, no. Puede haber un camino de menos de cinco pasos que no he visto.
- **Cuántas plantillas por cuenta por el camino del presupuesto.** El 100 es el tope leído; las 100 seguidas
  las midió SCRUM-1509e sobre `:766`, no yo sobre el presupuesto.
- El formulario web del alta (si el navegador pone algo que el servidor no exige): sólo pedí al servidor.
- Tanda completa: no hay cambio de código. Las de registro: ver la entrega.

## 7 · Errores propios

- **Leí `id` y `country` de `/admin/me`, que no los trae.** La primera corrida dijo `id=undefined`, y con
  eso `count({ where: { merchantId: undefined } })` contaba las facturas de TODAS las cuentas: un 0 que no
  miraba lo que decía. Ahora el guion lee la cuenta de la base por su correo y sale «mudo» si la sesión no
  es de esa cuenta. Es la línea `A9` de arriba.
- Esperaba `modo_sin_factura` y la app contesta `factura_suelta_no_disponible`: lo corrigió el rojo.
- El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); seguí porque el encargo es medir. No corrí
  `prisma generate`.
