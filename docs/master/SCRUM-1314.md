# SCRUM-1314 · El sellado de la anulación escribe en la cadena antes que el estado — medición y preguntas

**Medido contra:** `origin/main` = `0628d3e0b76c798168468b5b440f5385a11eea77` · 2026-10-24T10:48:39Z

24-oct-2026 · **J2** (equipo de Javier), sesión jv-j2bc. **Sólo medición: no se ha construido nada.**
Todo leído con `git show origin/main:` y grep; nada ejecutado (ni tests, ni base). El detalle y las
preguntas al fundador, en el comentario 20751 del ticket.

## PASO 0

0 commits en main con «SCRUM-1314», 0 ramas `scrum-1314*`, 0 PR propios (la búsqueda «1314» devuelve
#1314 y #1901, de otros tickets), 0 comentarios en el ticket antes del 20751. No está resuelto por efecto.

## Lo que sigue vivo

- El sellado va antes que el estado y en otra transacción: `invoicesAdmin.routes.ts:928-940` llama a
  `sellarAnulacionTrasEmision`, que escribe `vfAnulHash`/`vfAnulPrevHash`/`vfAnulTimestamp` en
  `verifactu.service.ts:525-528`; el estado se escribe después, en `invoicesAdmin.routes.ts:956-976`.
  Residual declarado: `docs/BUGS.md:340` (P1-1303, abierto) y
  `tests/scrum1303-estado-dentro-del-where.test.mjs:167` («RESIDUAL CONOCIDO»).
- El cobro alcanza la carrera sin flag: la escritura está en `psp.routes.ts:195-198` (el ticket decía
  :187), dentro de `payment.confirmed` y fuera de `AUTO_INVOICE_ON_PAID`. Leído, no ejecutado.
- El eslabón huérfano se encadena (`ultimaHuellaDeLaCadena`, `verifactu.service.ts:565-603`, no mira el
  estado) y sale en el XML exportado (`buildVerifactuRegistrosXml`, `verifactu.service.ts:673-680` y
  :1111, servido por `exports.routes.ts:263` y :578).

## Lo que el ticket daba por cierto y ya no lo es

- «Un registro de anulación que se remitió»: hoy no se remite ninguna anulación. La cola sólo encola
  altas (`encolarRemision.ts:22`, único `TIPO_OPERACION_` de `src/`).
- El `count` a 0 es ahora un `update` condicionado con P2025 (`invoicesAdmin.routes.ts:970`).
- Carril: el arreglo es de **J1** (`dos-equipos.md:117` y :118, por `carriles.mjs de`); sólo
  `psp.routes.ts` es de J2 (:120).

## Defecto hermano, leído y no ejecutado

Re-sellar en un reintento pisa `vfAnulHash`: ni la ruta (:902) ni `applyVeriFactuAnulacion` miran si ya
hay huella de anulación. Tras un 500 en el paso 2, la factura queda `pending` con huella, y el reintento
la sobrescribe dejando huérfano el primer eslabón.

## Preguntas al fundador (comentario 20751)

- **P1** · sellado y `annulled` en una sola escritura condicionada a `pending`, dentro de la transacción
  del sellado. Recomendación ✅; construye J1; regla 40.
- **P2** · el sellado se niega a re-sellar si ya hay `vfAnulHash`. Recomendación ✅, con P1.
- **P3** · recuento de sólo lectura en las tres bases (`vfAnulHash` no nulo y `status` distinto de
  `annulled`). Recomendación ✅; con 0 filas, el asesor no hace falta para este ticket.

Sin medir: si producción tiene merchants ES con facturas selladas, y si los demás escritores de `paid`
llevan la guarda de anulada en el `where`.

A9: sin fallo que generalice — encargo de sólo lectura sin instrumento propio: cada cita sale de `git show origin/main:` y lo no ejecutado se declara en su línea

## SCRUM-1314c · P3: recuento de huellas de anulación sin anular en STAGING y DEV (sólo lectura)

**Medido contra:** `origin/main` = `091e4d765ba13083b93fb6c168ffbd70fb1f1563` · 2026-10-24T10:57:59Z

24-oct-2026 · **J1** (equipo de Javier), sesión jv-j1bp. Cumple la P3 de la decisión del fundador
(comentario 20754): staging y dev los cuenta J1; **producción la mira Javier y aquí NO se ha mirado.**
Ninguna fila escrita (regla 29). Sonda: `docs/master/evidencias/SCRUM-1314c/contar-huellas-sin-anular.mjs`,
calcada de la de SCRUM-612; se niega a correr contra el host de producción y no imprime URL.

Claves del árbol `jv-j6ar`: `node scripts/comprobar-claves-bd.mjs` → `rc=0`, las tres a destinos
no-producción (`DATABASE_URL_DEV` y `DATABASE_URL_TESTS` son la misma base, `yaqu_dev_javier`).

| base | ① READ ONLY | ② positivo sembrado | total | con huella | huella sin anular |
|---|---|---|---|---|---|
| staging (`acela…/railway`) | `SHOW`=on · escritura rechazada 25006 | 3/2/1 OK | 9 | 0 | **0** |
| dev (`acela…/yaqu_dev_javier`) | `SHOW`=on · escritura rechazada 25006 | 3/2/1 OK | 5 | 0 | **0** |

- ① La base CONFIRMA el modo: dice `on` y además rechaza un `UPDATE invoices … WHERE false` dentro de un
  savepoint (código 25006). Si lo aceptara, la sonda aborta sin medir.
- ② El positivo es la MISMA expresión de recuento sobre un `VALUES` fabricado, con un huérfano dentro.
  Quitándolo (`--quitar-sembrado`, contra dev) sale **2/1/0 · CIEGO · EXIT=2**: no da verde.
- ⚠️ **Lo que el cero NO dice:** en ninguna de las dos bases hay UNA sola factura con huella de
  anulación (`con_huella` = 0). No hay huérfanos porque no se ha sellado ninguna anulación; el recuento
  no informa sobre si la carrera ocurre, sólo de que hoy no ha dejado rastro. Población pequeña: 9 y 5.
- Sin medir: producción (de Javier); cuántas `annulled` hay sin huella (no se pidió).

A9: sin fallo que generalice — recuento de sólo lectura con su positivo sembrado comprobado en CIEGO; el único límite (producción no medida) es del encargo, no un tropiezo
