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

## SCRUM-1314b · Sellado y estado en UNA escritura, y no volver a sellar (P1 y P2 de c.20751)

**Medido contra:** `origin/main` = `091e4d765ba13083b93fb6c168ffbd70fb1f1563` · 2026-10-24T11:02:19Z

24-oct-2026 · **J1** (equipo de Javier), sesión jv-j1bo. **GO del fundador sobre el camino de emisión:
SCRUM-1314 c.20754** (P1 «Sí, GO», P2 «Sí, con el P1»). Cubre SOLO la anulación —sellado más estado— y
la guarda de no re-sellar; no el alta, R1, la remisión ni el XML, y nada de eso se ha tocado.

### Qué cambia

- `applyVeriFactuAnulacion` (`src/modules/invoicing/domain/verifactu.service.ts:464`) acepta `anular`.
  Con él, la misma `update` que escribe `vfAnulHash`/`vfAnulPrevHash`/`vfAnulTimestamp` pone
  `status: 'annulled'` con `status: 'pending'` en el `where` (:556), y la liberación de albaranes y del
  libro corre en esa misma transacción, dentro del cerrojo del merchant. Si un cobro entró en medio,
  P2025 y no queda nada: ni huella, ni cadena extendida, ni albaranes liberados.
- P2 (:511): dentro del cerrojo se lee si la factura ya tiene `vfAnulHash`; si la tiene, se conserva y
  no se recalcula (gemelo de SCRUM-1330 en el alta). Con `anular`, sólo se pone al día el estado, con
  la misma condición.
- `sellarAnulacionTrasEmision` (`selladoEstado.ts:191`) pasa `anular` y devuelve lo liberado.
- La ruta `POST /admin/invoices/:id/annul` (`invoicesAdmin.routes.ts:922`) ya no sella primero y
  escribe el estado después: para ES con NIF llama al sellado con la liberación dentro; sin sellado
  (fuera de ES o sin NIF) mantiene la transacción de estado + liberación de SCRUM-1303.
- **Cambio de comportamiento, dicho:** si falla la liberación de un comercio ES (un 500 de la base),
  antes quedaba la huella escrita y salía un 500; ahora se deshace todo y sale el 409
  `anulacion_no_sellada` ya existente («…así que no se ha anulado nada. Inténtalo de nuevo.»), que
  ahora es literalmente cierto. Ningún texto nuevo.

### Comprobaciones (corridas, en `tests/scrum1303-estado-dentro-del-where.test.mjs`)

- **Rojo primero contra el código de main** (`dist/` emitido con `tsc --noCheck` sobre el árbol sin
  cambios en `src/`): 11 casos, 8 pasan, **3 caen**, cada uno por su mensaje — «HA QUEDADO UN ESLABÓN
  DE ANULACIÓN SELLADO SOBRE UNA FACTURA COBRADA», «SE HA PISADO LA HUELLA DE ANULACIÓN» y «TRAS EL
  500 QUEDA UNA HUELLA DE ANULACIÓN SIN ANULACIÓN». Base sin mutar antes de tocar el test: 9/9.
- **Con el arreglo:** 11/11.
- **El «RESIDUAL CONOCIDO» deja de serlo** (:210): afirmaba `paid` + `vfAnulHash`; ahora afirma
  `vfAnulHash` y `vfAnulPrevHash` nulos y cero escrituras de huella. Se endurece (regla 41).
- **Mutaciones sobre `dist/`** (nunca `src/`; restaurado y comparado byte a byte tras cada una):
  M1 quitar `pending` del `where` → caen B′ y el caso del eslabón (2); M2 quitar la guarda de P2 → cae
  P2 (1); M3 no escribir `annulled` en la misma `update` → caen 4, el control positivo incluido.
  M1 y M2 quedan declaradas en `MUTACIONES_QUE_ME_TUMBAN` del propio test (`meta:mutaciones
  --solo-censo`: 769 declaraciones, las dos dentro). Y la de SCRUM-880 sobre el sello de la anulación
  sigue matando su caso («B · el sello que se ESCRIBE conserva los milisegundos»).
- **El doble no deshacía transacciones**: llamaba al callback y dejaba escrito lo que la transacción
  hubiera hecho antes de lanzar. El caso del 500 lo necesita, así que el test lo envuelve (:127) y
  restaura la fila SÓLO en ese caso: restaurarla siempre borraría el cobro que otra petición escribe
  en medio, que en Postgres sí queda.
- **Guards dirigidos** sobre el código final: los 492 ficheros de `tests:que-cubren` de los cuatro
  ficheros tocados más los que nombran `applyVeriFactuAnulacion`/`vfAnulHash`, el censo del camino de
  emisión, los de suite y los de registro, en tres tramos: 4.582 casos, **4 caen y los 4 son del
  entorno** —`scrum1298b` ×2 (la ruta corta `JAVIER~1` del temporal contra la larga) y `scrum351` y
  `scrum476` (el árbol anidado no tiene `node_modules` propio)—, leídos en su mensaje y no re-corridos
  contra main. Lista de VeriFactu y cadena aparte, otra vez sobre el código final: 1.052 casos, 1.037
  pasan, 15 saltos, 0 caen. `tsc --noEmit` del proyecto: 0 errores.
- **De paso, tres guards que cayeron con la primera forma del arreglo, y lo que se cambió:**
  `scrum153c` (el sellado escribía la clave `status`, aunque fuera `undefined`, sin `anular`) → se
  arregló el código: dos escrituras literales, una por rama. `scrum878` (no sabía clasificar un
  `...spread` en el `data:`) → lo mismo, sin spreads. `scrum880` (su doble no conocía `findUnique`) →
  se le enseñó a contestar SÓLO por `id`, y revienta con cualquier otra forma; no cambia ninguna
  aserción. Y `scrum525d`: el testigo de `docs/legal/AUDITORIA_CAMINO_EMISION.md:39` se movió por las
  líneas añadidas → coordenada puesta al día en sitio (y la de :104, del mismo fichero y sin testigo).
  Las de :217 y :234 (`verifactu.service.ts:930`, hoy :975) NO se han tocado: llevan escrito que las
  puso al día un permiso del fundador (SCRUM-1524 c.19292), y cambiarlas haría falsa esa nota.

**No hecho, dicho:** el recuento P3 (sólo lectura, staging y dev) es otra tarea de J1 y no se ha
corrido aquí; las filas que ya pudieran tener `vfAnulHash` sin estar anuladas siguen como estén. Los
otros escritores de `paid` (`mpWebhook.routes.ts`, `instanteDeCobro.ts`) no se han probado en carrera:
con este arreglo da igual quién gane, porque ninguno puede dejar huella, pero no está medido. Suite
entera local: NO CORRIDA (10 sesiones a la vez); hace de tanda el obligatorio de CI.

**Mi error, contado:** al reanclar la mutación de `scrum880` para la primera forma la llevé a un trozo
que, con la forma final (dos ramas), sólo existe en la rama `anular`, que ese test no ejecuta: habría
salido MUDA. Lo vi antes de correrla, la devolví a su ancla original y la ejecuté: mata su caso.

A9: comprobación → `scripts/meta-guard-mutaciones.mjs`
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
