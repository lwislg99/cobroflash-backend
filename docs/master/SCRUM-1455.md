# SCRUM-1455 · CRUCE DE CARRIL DECLARADO (`area-j1`, lo trabaja J2e) — un id que no cabe en la columna daba 500 en la ficha de factura: 7 lecturas hechas, 9 no

**Medido contra:** `origin/main` = `6aaec0dc8f0267518a50f626299ae901f81e2ae1` · 2026-10-06T13:28:49Z

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
