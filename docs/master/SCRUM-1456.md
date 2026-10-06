# SCRUM-1456 · Un id que no cabe en la columna daba 500 donde tocaba 400 — la ficha de cliente, y la forma única para los tres tickets de la familia (1455, 1456 y 1457)

**Medido contra:** `origin/main` = `b71719f32f623729debec40518e3c7c6d3601086` · 2026-10-06T13:45:45Z

6-oct-2026 · **J2e** (puesto J2, equipo de Javier), por encargo del orquestador (`cobroflash-backend-90`).
[Escrito por J2e, una sesión; no por el fundador. Los tres tickets y SCRUM-1379, con sus comentarios, los he
leído en Jira.]

**CRUCE DE CARRIL DECLARADO.** Este registro es el de mi carril (`area-j2`). La misma rama lleva
SCRUM-1455 (`area-j1`) y SCRUM-1457 (`area-j3`), que no son míos: el orquestador los dio juntos y a una
sola sesión para que las tres listas usen UNA forma de leer el id. Cada uno tiene su registro
(`SCRUM-1455.md`, `SCRUM-1457.md`) y los dos citan éste para lo común.

A9: aviso → cicatriz J2 «otra hora a ojo en un mensaje al orquestador: puse ~13:50Z y GitHub, leído minutos después, decía 13:28Z; es la quinta línea de J2 con lo mismo» — no se pudo comprobar: el mensaje al orquestador sale por la herramienta de mensajes, que ningún hook del repositorio ve antes de enviar

## Ⓐ La forma: ya existía, y no se ha escrito otra

`cabeEnColumnaInt` (`src/core/validation/enteroDeColumna.ts`, SCRUM-1379). Buscada por concepto antes
de escribir nada: 16 ficheros de `src/` la importaban ya en `main`. Los tres tickets la usan tal cual;
el fichero del helper no se toca (es de S1).

- Donde había `Number.isInteger(x)` → `cabeEnColumnaInt(x)`, en su misma línea.
- Donde había `Number.isNaN(x)` → `!cabeEnColumnaInt(x)`, en su misma línea.
- Una línea de `import` por fichero. Nada se mueve, nada se exporta, ninguna firma cambia.

## Ⓑ El borde, derivado del tipo de la columna (el esquema se LEE)

`prisma/schema.prisma`, leído y no tocado: **33 modelos; 29 llevan `id Int @id`, 3 llevan clave
compuesta de dos `Int` y 1 lleva clave de texto (`obligadoNif`). `BigInt` aparece 0 veces.** El DDL que
`prisma migrate diff --from-empty` saca de ese esquema crea las 29 como `"id" SERIAL`, que en Postgres es
un entero de 4 bytes: de **−2.147.483.648 a 2.147.483.647** (2³¹ − 1).

Medido con Postgres de verdad (Ⓓ), no deducido: `2147483647` se consulta y contesta 404;
`2147483648` reventaba con 500. El borde es ése y no otro. `10000000000` es «seguro» para JavaScript
(`Number.isSafeInteger`) y reventaba igual: por eso el criterio es el de la columna.

## Ⓒ El censo, abierto línea a línea — y dos recuentos que no cuadraban

Numeración de `origin/main` = `8dcc6d2a` (la del ticket). En la rama, las de `customersAdmin.routes.ts`
e `invoicesAdmin.routes.ts` bajan una línea por el `import`.

**El ticket dice «26 lecturas». Son 26 LÍNEAS y 30 LECTURAS**: cuatro líneas leen dos ids
(`:462`, `:485`, `:618`, `:638`). La familia entera son 46 líneas y 50 lecturas.

| Grupo | Líneas | Lecturas | Estado |
|---|---|---|---|
| `customersAdmin.routes.ts` — lectura, o escritura que no es dinero ni borrado: `:147` `:190` `:213` `:335` `:337` `:365` `:367` `:389` `:406` `:431` `:445` `:462` `:485` `:501` `:618` | 15 | 18 | **HECHO** |
| `customersAdmin.routes.ts` `:600` (`DELETE /:id`) y `:638` (`POST /:id/fusionar`) — datos de clientes | 2 | 3 | **NO HECHO → al fundador** (c.18414: datos de clientes) |
| `chargesAdmin.routes.ts` `:34` `:117` `:167` (confirmar Bizum, garantía, liberar garantía) — flujo de cobro | 3 | 3 | **NO HECHO, y es decisión mía** (Ⓗ): el orquestador las autoriza en c.18414, pero son flujo de cobro y la parada de `CLAUDE.md` pide al fundador |
| `psp.routes.ts:36` — el webhook interno del cobro; es la ÚNICA de las seis de webhook que lleva el id a la base | 1 | 1 | **NO HECHO → al fundador** (c.18414: dinero real) |
| `stripe.routes.ts` `:84` `:124` `:189` y `connectWebhook.routes.ts` `:52` `:112` | 5 | 5 | **NO SE TOCAN: es el arreglo correcto, no un recorte** (Ⓔ; aceptado en c.18414) |
| **Total** | **26** | **30** | |

`:190` es una línea y dos rutas (`PUT` y `PATCH /:id` comparten handler): por eso el test tiene 19
filas de clientes para 18 lecturas.

`customersAdmin.routes.ts:79` (`excluirId`) no es este defecto, como dice el ticket: no va a la base.

## Ⓓ El rojo primero, dos veces

**1 · Por la ruta, con la base doblada** (`tests/scrum1456-ids-que-no-caben-en-la-columna.test.mjs`,
entonces con 24 lecturas: 19 de clientes y 5 de facturas). Contra el build de `main` sin el arreglo: **51 casos,
27 pasan, 24 caen**; los 24 que caen son los 24 «un id que no cabe → 400» y ninguno más. 22 contestaban
500 y 2 contestaban 404. Salida: `docs/evidencias/scrum1456/rojo-primero.salida.txt`.

Los dos 404 son `despuesDe` (el cursor de `historial` y de `whatsapp`): con la base doblada el cliente
«no existe» y la ruta se va por el 404 antes de usar el cursor. **El doble no enseña ese 500; la base de
verdad sí** (abajo): con un cliente que existe, el cursor enorme daba 500.

**2 · Con lo de verdad** (`docs/evidencias/scrum1456/sonda-real.mjs.txt`): los routers de `dist/`, el
Prisma de verdad y un Postgres de verdad (PGlite en memoria, en loopback, base desechable creada con el
DDL del esquema). Lo único doblado es la sesión. **51 peticiones:**

| | 200 | 400 | 404 | 500 |
|---|---|---|---|---|
| Antes (build de `main` `8dcc6d2a`) | 7 | 8 | 15 | **21** |
| Después (la rama, con `main` `6aaec0dc` mezclado) | 5 | 30 | 13 | **3** |

Los 3 que quedan en 500 son los tres `POST /webhooks/psp` con un `charge_id` que no cabe: es
`psp.routes.ts:36`, que NO se ha tocado. Salidas: `sonda-real.antes.salida.txt` y
`sonda-real.despues.salida.txt`, en la misma carpeta.

### 🔴 El hallazgo que justifica el ticket entero, y es peor que el defecto que el ticket describe

`GET /admin/customers/1.5` contestaba **200 CON LA FICHA DEL CLIENTE 1**. Eso no es «un 500 donde
debería haber un 400»: **un id decimal resolvía SILENCIOSAMENTE a otro registro y contestaba como si
fuera el pedido.** Un 500 se ve; esto no se ve. Las dos pasadas de la sonda: **21 de 51 respuestas eran
500 → 3 de 51, y las tres son `psp`, que no se ha tocado**; y los dos 200 que desaparecen (7 → 5) son
exactamente `/admin/customers/1.5` y `/admin/customers/1.5/detail`.

**¿Pasa sólo en clientes? NO: pasa en cualquier columna `Int`, y también al ESCRIBIR.** Medido con el
Prisma de verdad sobre Postgres de verdad, sin pasar por ninguna ruta
(`docs/evidencias/scrum1456/sonda-decimal.mjs.txt`, 21 lecturas y 1 escritura sobre tres tablas con
ids 1, 2 y 3):

| Se pide el id | `customer` | `charge` | `merchant` |
|---|---|---|---|
| `1.5` y `1.9` | devuelve el 1 | devuelve el 1 | devuelve el 1 |
| `2.5` | devuelve el 2 | devuelve el 2 | devuelve el 2 |
| `3.5` | devuelve el 3 | devuelve el 3 | devuelve el 3 |
| `0.5` y `-0.5` | no existe | no existe | no existe |

El decimal se TRUNCA. Y `customer.updateMany({ where: { id: 1.5 } })` **escribió la fila 1** (count 1).
O sea: el ticket no es «500 en vez de 400» en ninguna ruta que valide con `Number.isNaN`; en ésas, un
id decimal opera sobre el registro de su parte entera.

**Cuántas rutas siguen así después de esta rama: 8, y son todas de las que esperan al fundador.**
Censo de `Number.isNaN(` en `src/` sobre la rama: 18 líneas; 8 validan el id de una ruta —
`invoicesAdmin.routes.ts` `status`, `pay`, `unpay`, `send-email`, `annul`, `rectify` y `regenerate-pdf`, y
`customersAdmin.routes.ts` `DELETE /:id`—; las otras 10 no leen un id de ruta (importes, fechas,
`excluirId`). LEÍDO, y deliberadamente NO ejecutado: `POST /admin/invoices/1.5/annul` anularía la
factura 1, y `DELETE /admin/customers/1.5` borraría el cliente 1.

**Lo que esto NO es.** No es un agujero de tenencia: todas esas consultas filtran por `merchantId`, y la
fila a la que resuelve el decimal es del mismo comercio que podía pedirla por su id entero. Tampoco
está visto en producción: es PGlite y el cliente de Prisma del checkout compartido (25-sep).

Los dos envíos de facturas que entraron después (Ⓗ) tuvieron su propio rojo: con las tres filas de
envío añadidas y sin tocar el fuente, **57 casos, 3 caen** (`resend-whatsapp` 500, `send-reminder` 500,
`send-email` 200).

## Ⓔ Los webhooks: de seis líneas, una; y cambiar las otras cinco altera el reintento

- **Sólo `psp.routes.ts:36` consulta la base con el id** (`prisma.charge.findUnique`). EJECUTADO en Ⓓ:
  hoy contesta 500 a `2147483648`, `10000000000` y `1e20`, y 404 a `2147483647`.
- Las otras cinco **no consultan nada con el `chargeId`**: lo reenvían por `axios` a `/webhooks/psp`.
  No tienen el defecto. LEÍDO, no ejecutado (ejecutarlo pide fabricar un evento firmado de Stripe).
- **Cambiarlas sí altera lo que Stripe reintenta.** LEÍDO: hoy, con un `charge_id` que no cabe, psp
  contesta 500, `axios` lanza, y el `catch` de `stripe.routes.ts` y de `connectWebhook.routes.ts`
  contesta **400** a Stripe, que reintenta. Con `cabeEnColumnaInt` en esas líneas el evento se salta, se
  marca procesado y se contesta **200**: Stripe deja de reintentar. Eso es una decisión, no un arreglo.
- Arreglando sólo `psp:36` (si llega el GO), Stripe sigue recibiendo el mismo 400: psp pasaría de 500 a
  400 y `axios` lanza igual con los dos.

Subido al orquestador el 6-oct y ACEPTADO por él en SCRUM-1456 c.18414: esas cinco no se tocan.

## Ⓕ Lo corrido

| Qué | Resultado |
|---|---|
| `tests/scrum1456-…test.mjs`, sobre la rama con `main` `6aaec0dc` mezclado (26 lecturas: 19 de clientes, 7 de facturas) | 55 de 55 |
| Ese test más `scrum1379`, `scrum1379b` y `scrum1379d` (los hermanos de S1) | 124 de 124, 0 saltos (corrido cuando el test tenía 51 casos; no repetido con los 55) |
| `tests/banco-scrum1456/mutar.mjs` (dos mutantes por llamada: `Number.isInteger` y `Number.isSafeInteger`) | **50 de 50 caen** (25 llamadas × 2), cada uno tumba sólo los casos de su lectura; 0 vivas, 0 ciegas; T0 en verde; árbol intacto por sha256. Salida: `docs/evidencias/scrum1456/mutar.salida.txt` |
| La dirigida (`node scripts/tests-que-cubren.mjs --lanzar`, en 4 tramos, con `main` `b71719f3` mezclado) | 329 ficheros · 3.214 tests · 3.205 pasan · **2 caen**, los dos de `scrum1199-avisos-alta-cliente` con `MODULE_NOT_FOUND`: el worktree no tiene `node_modules` propio y ese test carga un módulo por ruta. No son de este cambio; el juez es el CI, donde se leen por nombre |

`dist/` se construyó con `tsc --noCheck`: el worktree hereda el `node_modules` del checkout compartido,
cuyo cliente de Prisma es del 25-sep. El juez de los tipos es el CI.

## Ⓗ La autorización, citada, y lo que NO he hecho aunque la tuviera

**SCRUM-1456 c.18414** (6-oct-2026, GO parcial del orquestador, vale para los tres tickets). Autoriza
el bloque libre de 1455 y 1456, `chargesAdmin` `:34` `:117` `:167` y los tres envíos de 1455, con una
condición para los seis últimos: medir que nada reacciona distinto a un 400 que a un 500. Manda al
fundador `annul`, `rectify`, `regenerate-pdf`, `status`, `pay`, `unpay`, `invoice.routes.ts:63`,
`psp.routes.ts:36`, `DELETE /:id`, `fusionar` y `supresion.routes.ts:34`.

- **Los tres envíos, medidos antes de tocar** (con un id que no cabe, por la ruta): `resend-whatsapp`
  500, `send-reminder` 500, **`send-email` 200 con `sent: false`**. Los dos primeros se han hecho:
  `api.js` trata igual cualquier respuesta que no sea 2xx, y `invoiceDetailView.js` también. **`send-email`
  NO se ha hecho:** pasar de 200 a 400 cambia la rama por la que va la pantalla. La condición decía «si
  algo reacciona, se para».
- **`chargesAdmin`, NO hecho, y es decisión mía.** Confirmar un Bizum y la garantía son flujo de cobro.
  La parada de `CLAUDE.md` (protocolo de sesión, punto 4) pide el OK del FUNDADOR para eso, y el propio
  ticket las llama «STOP de un jefe». El GO es de una sesión. Son tres líneas idénticas a las demás: con
  el sí de Javier escrito en el ticket se hacen en esta misma rama.

## Ⓖ Lo que queda sin hacer, dicho

- **11 lecturas de este ticket** (3 de `chargesAdmin`, 4 que van al fundador en 3 líneas, y 5 que no se
  tocan a propósito): tabla de Ⓒ. **Este ticket no se cierra con este PR.**
- **No visto en yaqu.app.** La cuenta QA está caducada (lo dice el ticket) y no se piden credenciales.
  La aceptación 1 se ve en el test y en la sonda; en producción, NO.
- **Aceptación 3 (regla 2):** no se ha tocado ninguna consulta; el diff son las líneas de validación y
  el `import`.
