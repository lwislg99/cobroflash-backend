# SCRUM-986 · El estado de WhatsApp (Enviado / Entregado / Leído / No entregado) también en la LISTA de presupuestos

**Medido contra:** `origin/main` = `b6cde0517649d991a1b08eabb50017a81a03acfb` · 2026-09-21T17:27:29Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`).
**Rama:** `scrum-986-chip-whatsapp-en-la-lista` (parte del PR A del primer lote CRM; SCRUM-1032 va en su propia rama, ver el motivo abajo). **Primer commit de la feature:** `fef07537a402afaab9f380330ef31b0c1a48ac16`.
**Microcopy:** ninguna nueva. El chip es el de siempre (`waDeliveryChip`, rótulos aprobados y en uso); no se escribe ni un rótulo.
**Excepción de carril:** el ticket toca servidor (`src/`, carril de la S1) y lo encargó el orquestador a la S2 por mensaje en vivo («consulta agrupada por la página de ids en `listQuotesAdmin`»).

## Paso 0: el defecto existía hoy

`listQuotesAdmin` proyecta cada fila **a mano** y no trae `waDelivery`; `waDeliveryChip` solo se llama desde los dos detalles (`quotesDetailView.js`, `invoiceDetailView.js`). Con el test escrito antes del arreglo: **6 de 7 pruebas en rojo** (la 7.ª es el control positivo, que cuenta que el detalle SÍ lee de uno en uno).

## El plan de la consulta, medido antes de construir

Postgres 16.4 portable y desechable (loopback, base `yaqu_986_test`), la tabla `whatsapp_messages` con el DDL que sale del esquema real (`prisma migrate diff --from-empty`, no `db push`), **950.000 filas** (600.000 de presupuesto, 150.000 de factura, 200.000 entrantes sin documento) sobre 300 merchants. La página: los 100 presupuestos más recientes del merchant 7.

| consulta | tiempo | buffers | plan |
|---|---|---|---|
| **la elegida**: `WHERE merchant_id AND related_type='quote' AND related_id IN (100 ids) ORDER BY created_at DESC` (lo que genera Prisma `findMany`) | **0,78 ms** | 414 | `Bitmap Index Scan` por `whatsapp_messages_related_type_related_id_idx` (+ el de merchant) |
| `DISTINCT ON (related_id)` (no elegida: pide SQL a mano, y no ganaba) | 0,85 ms | 414 | el mismo |
| lo que hace hoy el detalle, UNA vez (`findFirst`) | 0,023 ms | 4 | `Index Scan` por el mismo índice; ×100 serían 100 viajes a la base |
| **control**: sin el índice `(related_type, related_id)` | **5,87 ms** | 2.015 | recorre las 2.001 filas del merchant |

**No hace falta índice nuevo ni cambio de esquema.** Límites declarados: datos sintéticos, caché caliente, una pasada, no es staging; en la página medida cada presupuesto tiene 1 envío (devuelve 100 filas y no ~200), pero el plan no depende de eso. El control sin índice prueba que el instrumento distingue (7,5×).

## Lo que cambia

| fichero | qué |
|---|---|
| `src/modules/messaging/domain/whatsappLog.service.ts` | `getDeliveryStatusMany(merchantId, tipo, ids)`: UNA consulta por la página, primera fila por documento (llegan de más nueva a más antigua). Falla → mapa vacío, la lista sale sin chips. `getDeliveryStatus` y esta comparten `ORDEN_DEL_ULTIMO_ENVIO` (`createdAt desc, id desc`): sin ella, lista y detalle podían contar dos estados del mismo presupuesto. |
| `src/modules/system/quoteAdmin.ts` | `listQuotesAdmin` llama a la anterior y proyecta `waDelivery` (proyección a mano: sin esa línea el dato se calcula y no sale, el «quinto eslabón» de SCRUM-595). |
| `public/dashboard/js/quotesListView.js` | el chip en la celda de estado (`div.status-wa`) y `tr.has-wa` en la fila que lo lleva, para recomponer la tarjeta móvil. **El marcado de la tabla no cambia** (ver «El guard de las listas hermanas»). |
| `public/dashboard/js/api.js` | `waDeliveryChip(w, { sinFecha })`: la lista pide el chip sin fecha; el detalle no pasa nada y sigue igual. |
| `public/dashboard/css/styles.css` | `.status-wa`, la tarjeta móvil con el chip, y `nowrap` en ID e importe (y fecha desde 1180 px) solo en la tabla que lleva una fila con chip: `.table--cards-mobile:has(tr.has-wa) …`. |
| `tests/scrum986-chip-whatsapp-en-la-lista.test.mjs` (8 pruebas) | A: una consulta por página (+control positivo). B: lista = detalle, con orden, empate por `id`, otro merchant y otro tipo de documento. C: si falla la lectura, la lista sale. D: la pantalla (banco de vistas) y que el chip sale de `waDeliveryChip`; y que el ajuste de anchos no se cuela en `table--cards-mobile`. La «base» es una tabla en memoria que APLICA el `where` y el `orderBy` que recibe: si el código olvida el merchant u ordena al revés, devuelve lo equivocado. |

El técnico ve esta lista igual que el detalle (`TECNICO_ALLOWED` incluye `GET /admin/quotes` y `GET /admin/quotes/:id`): el chip no le enseña nada nuevo.

## El guard de las listas hermanas (`guard:lista-trabajos`)

`guards:visuales` cayó en ese guard (1 de 37 en rojo) con mi primera versión: exige que Presupuestos, Facturas y Albaranes salgan **idénticos a la base de la rama** —salvo lo que se declare en el propio guard— y yo había añadido una clase (`table--presupuestos`) al `<table>`: 20 caracteres de más en el HTML de una lista SIN un solo chip. **Se arregló el código, no el guard (regla 41):** el ajuste de anchos pasó a CSS con `:has(tr.has-wa)` y el marcado de la tabla quedó como estaba. Medido después: Presupuestos `d0a5e18b3137a280` (3462 caracteres), idéntico a la base, y 0 defectos. Un test lo ata (M9). Ojo con lo que esto deja dicho: **cualquier cambio de marcado a una lista hermana obliga a tocar ese guard** (SCRUM-1032 lo hace con Clientes: va en otra rama por eso, pidiendo el OK del orquestador antes de tocar el guard).

## Verificado en rojo (BASE 8/8)

Nueve mutaciones, restauradas con `fs` (no PowerShell), **ninguna sobrevive**: M1 la lista no proyecta `waDelivery` · M2 la consulta agrupada olvida el merchant (cae en 2 pruebas) · M3 el orden invertido · M4 la pantalla no pinta el chip (2) · M5 se queda con la fila más antigua · M6 la lista vuelve a pedir la fecha · M7 `waDeliveryChip` ignora `sinFecha` · M8 el `nowrap` en la clase compartida · M9 la tabla vuelve a llevar una clase propia (cambia el HTML de la lista sin chips).

Foco de tests: 82 ficheros que tocan lo cambiado, **799 pruebas, 792 pass, 0 fail, 7 skipped** (los 7 son los gateados por `QA_DB_TEST`/`A55_DB_TEST`, declarados con su motivo; entre ellos `scrum148`, que corre `listQuotesAdmin` contra base real: pendiente del turno de staging).

## Lo medido en navegador (Edge headless, banco de listas, `docs/prototipos/SCRUM-986/capturas/`)

| ancho | antes | después |
|---|---|---|
| 390 | tarjeta 147 px | 167 px con chip (la fila «estado» a ancho completo: pill y chip juntos); el nombre del cliente NO se estrecha (218 px, igual) |
| 1280 | filas de 55 px | 75 px (el chip cuelga bajo la pill); ID, fecha, cliente e importe en UNA línea |
| 1440 | 55 px | 75 px, una línea |
| 641–1179 | ya iba justa (a 900: 3/5/3/2 líneas, 130 px; a 1024: 2/2/2/2, 67 px) | 900 igual (130 px); **1024 empeora: 67 → 88–130 px** (el nombre a 3–5 líneas) |

**Decisión que queda escrita (límite declarado):** entre 641 y 1179 px la tabla de presupuestos ya no cabía sin partir columnas; con el chip las filas crecen. Se probó acotar el ancho del chip (con `max-width` se partía en 3–4 líneas y las filas llegaban a 119 px): peor. No se rediseña la tabla aquí; lo bueno sería que esa franja use la tarjeta móvil o esconda «Método»/«Etiquetas», y eso es una decisión de diseño de pantalla, no de este ticket.

## Errores míos, confesados (A9)

1. Mi primera versión pintaba el chip CON fecha y **partía ID, fecha e importe de todas las filas** a 1280 px: lo cazó la medida en navegador, no el test (el test comparaba texto). De ahí `sinFecha` y el `nowrap` acotado a esta tabla. Y mi primera forma de acotarlo (una clase nueva en el `<table>`) puso en rojo `guard:lista-trabajos`, que solo cazó `guards:visuales` —no `npm test` ni `guards:entrada`—: por eso los guards de navegador se corren enteros antes de empujar.
2. Mi «rojo» del front lo hice guardando `git diff` con `>` de PowerShell 5.1, que escribe UTF-16: el parche no aplicaba y perdí dos ediciones, que rehice a mano. Para guardar/restaurar ficheros, `Copy-Item`.
3. El primer chequeo «ID e importe en una línea» medía la altura de la celda, que es la de la fila: no medía nada. Se rehizo contando las líneas reales de texto (`Range.getClientRects`).

## Pendiente

Verificar en yaqu.app tras el merge (lista de presupuestos con un presupuesto enviado por WhatsApp; comparar con su detalle) y pasar `scrum148` en staging bajo turno.
