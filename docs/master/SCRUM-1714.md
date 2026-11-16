# SCRUM-1714 · SIF-1 · las dos lecturas del flag en `exports.routes.ts` también miran el SII

**Medido contra:** `origin/main` = `5203048057ac173083b036a214043a6a3debf356` · 2026-11-12T12:27:39Z

A9: comprobación → `tests/scrum1714-exports-miran-el-sii.test.mjs`

Puesto S1 (equipo Luis), 12-nov-2026. Ticket abierto por el orquestador del equipo de Javier desde
SCRUM-1585 c.21567; encargado a S1 en c.21650. Skill `yaqu-verifactu-sif` cargada antes de tocar.

## Origen y decisiones que aplican

SCRUM-1585 (M) hizo que el modo de emisión mire el SII en cada emisión (`motivoSiiSinEmision`,
`emission.service.ts`): con el SII en «Sí» o «No consta» el merchant está en `receipt` aunque tenga
`INVOICING_ES_ENABLED`. Su registro dejó fuera, a sabiendas, «las dos lecturas directas del flag en
`exports.routes.ts` (contenedor S1)» (`docs/master/SCRUM-1585.md` §②). GO del fundador que aplica:
SCRUM-1585 c.20531 — D0 (la comprobación del SII en el camino, sin sellado ni XML), D2 (el dato del
SII obligatorio en cada consulta que alimente la decisión), D4 (la foral fuera). Este cambio no toca
el sellado, ni el constructor del XML, ni la huella: sólo la puerta de las dos rutas.

## 🔴 Rojo primero, por la ruta real (y la parte «No medido» del ticket, medida)

App in-process, sesión real por `/auth/verify`, banco desechable propio (`LIBRO_PG_URL`, cluster en el
temporal del job, puerto 55714, esquema por `migrate diff --from-empty`, 33/33 tablas). Merchant con
una F1 sellada y el flag puesto por merchant:

- SII «Sí» → `GET /admin/exports/verifactu.xml` contestaba **200 con el registro RRSIF** de la factura.
- SII «Sí» → `GET /admin/exports/datos.zip` llevaba **`facturas/verifactu_2026.xml`**.

O sea: sí, hoy esas rutas servían un registro de facturación de un merchant que no emite. Sin daño
vivo porque ningún merchant real tiene el flag (regla 24).

## Qué cambia

`src/modules/exports/app/routes/exports.routes.ts` (contenedor S1):

- `datos.zip`: `xmlPermitido` lleva además `motivoSiiSinEmision(merchant) === null`. El `merchant` ya
  era el registro entero (`findUnique` sin `select`), así que trae la columna.
- `verifactu.xml`: tras la línea del flag, `if (motivoSiiSinEmision(merchant) !== null) → 404 not_found`,
  el mismo 404 neutro de `receipt`, antes de tocar la BD de facturas. Al `select` se añaden `id`, `email`
  (quién es el demo) y `llevaLibrosPorSii`.
- Se usa `motivoSiiSinEmision` y no `getEmissionMode(...) !== 'receipt'` porque es exactamente el delta
  de M: con el flag apagado devuelve `null` y la línea del flag sigue decidiendo sola (las mutaciones de
  SCRUM-73 y SCRUM-82 siguen cayendo), y el demo sigue igual (rama del demo dentro de la función). Con
  `getEmissionMode` el demo pasaría a exportar con el flag apagado: cambio de conducta que nadie pidió.
- Va en una línea aparte, no fundida con la del flag, para que cada lectura tenga su mutación literal.

## Cómo se midió

- `tests/scrum1714-exports-miran-el-sii.test.mjs` (gateado por `QA_DB_TEST`/`LIBRO_PG_URL`; CI lo corre
  con el banco desechable). Referencia = el MISMO merchant con el flag apagado; SII «Sí» y «No consta»
  tienen que dar lo mismo (status y cuerpo de `verifactu.xml`; entradas y LEEME de `datos.zip`).
  Control positivo: SII «No» + flag → las dos rutas SÍ sirven el XML.
- Mutaciones sobre `src/` (copia en bytes y restaurada; `git diff --stat` igual antes y después):
  - M1 quitar el SII de `xmlPermitido` → cae SÓLO 1714, en el assert de `datos.zip`.
  - M2 `if (false)` en la puerta del SII de `verifactu.xml` → cae SÓLO 1714, en el assert de `verifactu.xml`.
  - M3 (la de scrum73) → caen 73 y 1714. M4 (la de scrum82) → caen 82 y 1714 (por el control).
  Catalogadas M1 y M2 en `MUTACIONES_CON_BASE` del test.
- Los 35 ficheros de `tests/` que nombran `exports.routes` o `emission.service`, con el banco: 248/248,
  0 saltados.

## Sin medir

- yaqu.app: no hay forma de verlo allí sin encender el flag a un merchant real, que es justo lo que la
  regla 24 prohíbe. La ruta real se ha medido in-process contra Postgres.
- `motivoSinEmision` en `/me` es SCRUM-1717 (siguiente de la cola), no esto.
