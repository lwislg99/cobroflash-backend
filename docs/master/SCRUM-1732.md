# SCRUM-1732 · Criterio de caja y cobro parcial: la retención de garantía y el 100 % en el primer cobro

## J1 · SCRUM-1732 · opción C: el defecto declarado y fijado con el código real

**Medido contra:** `origin/main` = `8c61c10e34728282942cb896151cfde331a26072` · 2026-11-13T17:06:42Z (hora de GitHub; sesión J1 `jv-j1eo`, por encargo del orquestador `cobroflash-backend-63`)

A9: comprobación → `scripts/meta-guard-mutaciones.mjs`

**Qué es.** La medición ejecutada es de `jv-j1em` (SCRUM-1732 c.21820). La decisión de Javier está en c.21824: **«C ahora + A antes de caja»**, y B queda descartada. Esto es la C: un test `DEFECTO_CONOCIDO` que fija lo medido, **sin tocar `src/`, ni el esquema, ni ninguna base** (reglas 38 y 40). La sonda de c.21820 se quedó fuera de git, así que aquí se rehace y se sube: `tests/scrum1732-cobro-parcial-defecto-declarado.test.mjs`.

**Cómo mide.** Ejecuta tres piezas reales de `dist/` contra una base en memoria con estado:

- el webhook `POST /webhooks/psp` (`psp.routes`);
- `POST /admin/charges/:id/garantia` y `/:id/garantia/liberar` (`chargesAdmin.routes`, SCRUM-1107);
- `leerLibroRegistro` con `criterioCaja: true`.

El caso: una factura F-1732 de 1.000 € con su enlace de pago (un `Charge` de 1.000 €). El cliente paga 950 € por Bizum, con fecha declarada del 31-mar-2026, y retiene el 5 %. Después se declara la retención y se libera.

**Los cuatro huecos, fijados** (los cuatro salen DEFECTO, 9/9 casos en verde):

| hueco | lo que sale hoy |
| --- | --- |
| (a) pagada al 100 % | el webhook con `amount: 950` deja la factura `paid` y el `Charge` en `1000.00`, y no escribe nada más: la misma huella que con 1.000 |
| (b) liberación sin enlace | `Charge` 1733 de 50 €, `paid`; 0 escrituras en `invoice`; su evento lleva `{tipo: 'liberacion_garantia_obra', chargeOriginalId: 1732}` |
| (c) el libro, el 100 % de golpe | un solo asiento, en el T1-2026, con base 826,45 y total 1.000; ningún otro trimestre tiene nada |
| (d) cobros que suman más | `Charge` pagados del cliente: 1732 = 1000.00 y 1733 = 50, que suman 1.050 para una factura de 1.000 |

**Lo que NO está aquí.** La factura recibe `paidAt = new Date()`: es SCRUM-1735 (J2, GO en c.21824 ②). El test no mira nunca ese `paidAt`, y el libro se alimenta con una factura fabricada cuyo `paidAt` es el del cobro.

**Mutaciones** (`MUTACIONES_QUE_ME_TUMBAN`, pasadas una a una con `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`): **6 de 6 vivas**, con la pasada limpia en 9/9 y el árbol restaurado (`git status` vacío). Las seis son:

- el webhook no marca pagada una factura si el importe no llega (a);
- la liberación escribe en la factura (b);
- la caja desconectada (c);
- la liberación con importe 0 (d);
- retirar la declaración de (a);
- retirar la declaración de (c).

**Error mío, cazado por el instrumento.** En la primera pasada, la mutación «caja desconectada» salió **MUDA**: el caso se emite y se cobra en el mismo T1, así que filtrar por emisión da lo mismo. Le faltaba a (c) un control positivo de que la caja está ENCENDIDA. Lo añadí sembrado (la misma factura cobrada el 20-may tiene que salir en el T2), y la mutación pasó a viva. Lo cazó el arnés de la casa, que es la comprobación de la línea `A9:`.

**Qué tendrá que cambiar cuando llegue A** (tabla de cobros por factura: decisión → ALTER aditivo en las 3 bases → un PR, orden A5). Está escrito también en la cabecera del test:

1. Retirar de `DEFECTO_CONOCIDO` la entrada de cada hueco que A arregle, en el mismo cambio.
2. Enseñar a `baseConEstado` el modelo nuevo. Hoy, una escritura a un modelo desconocido se apunta en `otrasEscrituras`, y eso pone en ROJO (a) y (b).
3. Rehacer la medida de (c) contra la tabla de A. Lo que tiene que salir: 950/1.000 de la base en el T1 y 50/1.000 en el trimestre de la liberación. El tope del 31-dic para lo retenido es la pregunta 4 al asesor, en c.21820.
4. Si A deja (d) así a propósito, reescribir su entrada con el motivo; no borrarla a secas.

**Sin medir.** Ninguna base de datos. `mpWebhook.routes.ts` y el marcado manual (`invoiceAdmin.ts`) no se ejecutan aquí. Tampoco se ejecutan el 303 ni los libros AEAT con este caso, ni `ensureInvoiceForCharge`: se dobla para que lance, así que solo corre el marcado «P0-3» del webhook. El cliente de Prisma de este árbol va por detrás del esquema (`Job.queHayQueHacer`, según `_prisma-client-guard`), pero el test no lo usa, porque la base va doblada.

No se cierra (A13): queda A.

## J2 · SCRUM-1732c · opción A, PR-1: la tabla `invoice_payments` y sus escritores

**Medido contra:** `origin/main` = `6c5327559bb8e17f1ecad128f99331ee16b31a2f` · 2026-11-18T04:35:14Z (hora de GitHub; sesión J2 `jv-j2d0`, relevo 4 de `jv-j2c7`, `jv-j2c8` y `jv-j2c9`)

A9: comprobación → `tests/scrum1732c-escritores-invoice-payments.test.mjs`

**Qué es.** El PR-1 de la opción A, con las decisiones y los 7 textos firmados de c.21928, el ALTER aplicado en las tres bases (c.21940) y el orden A5. Modelo `InvoicePayment` → `invoice_payments`: una fila por cada dinero que entra y se atribuye a una factura. Append-only: una fila mal apuntada se anula con otra (`tipo = 'anulacion'`, `anula_id`). `Charge.amount` pasa a ser «lo pedido» y la tabla «lo cobrado» (c.21928 ②; la cabecera de SCRUM-1107/397 en `schema.prisma` lo dice). `Invoice.status` no cambia (V1).

**Escritores** (todos por `src/modules/billing/domain/cobrosDeFactura.ts`, idempotente por el único `(invoice_id, charge_id)`): `/webhooks/psp` (los dos marcados), `confirm-bizum` (importe declarado), `mpWebhook`, `/garantia` (409 si el cobro no está `paid` o cobrado + retenido ≠ total), `/garantia/liberar` (fecha declarada, fila `liberacion_garantia` con el `invoice_id`), el marcado manual y `/bulk-paid` (cruce J2→J1) y `/invoice/:id/paid-webhook`, que **se queda y apunta su fila** (lo miden `scrum1455b/c`; c.21947). **Los lectores no cambian: el devengo por tramos es el PR-2, de J1.** Cruces declarados en los commits: J1 (`invoiceAdmin.ts`, `invoicesAdmin.routes.ts`, `invoice.routes.ts`) y J3 (`ORDEN_BORRADO_MERCHANT`), autorizados por el orquestador J el 16-nov.

**Medido (ejecutado).** Tests de los escritores 13/13 y `scrum1732` 10/10, con mutaciones 11/11 y 7/7 vivas (jv-j2c8, c.21947). Tras el merge de `origin/main` `6c5327559`: tipos con un cliente Prisma propio en el temporal, salida 0; con el compartido (sin `invoicePayment`), salida 2 y 10 errores, todos de la tabla nueva. **Suite entera, 15 tramos de 113 ficheros**, uno por comando. Rojos míos que cazó y ya están arreglados en esta rama: `scrum1480f` (script nuevo declarado en `_sin-fila-declarados.json`), `scrum172` (`invoicePayment` en el fixture de merchant), `scrum241` (el backup lógico vuelca `invoice_payments`), `scrum289` (`facturaDelCobro` censada CLAVE), `scrum411` (dos conjuntos sin `export`; `esPaidViaValido` ya se consume y sale de los huérfanos), `scrum497/1547` (tres columnas de texto NO personales) y `scrum525d` (dos anclas de la auditoría que el esquema desplazó). Rojos que no son de código: el cliente Prisma compartido (`235`, `244`, `461`, `498` y el control de `241`), `1298b`, `351` y `932` (esta máquina), `1101` (intermitente: 11/11 suelto) y `854` (este registro).

**`scrum601`, re-anclado con permiso del fundador (c.22001).** El texto 7 firmado (`TEXTO_GARANTIA_NO_CUADRA`, `chargesAdmin.routes.ts:31`) sube los literales «a pelo» de 162 a 163 y los no legibles de 40 a 41. El primer intento de editarlo lo denegó el clasificador de permisos de la sesión y no se rodeó: se pidió (c.22000) y Javier dijo «Sí» con tres condiciones (c.22001). Las cifras salen de `censoCopy` sobre el árbol fusionado (`{ flag: 8, tipo: 11, aPelo: 163 }`, suman 182 de 182; 41 no legibles; el único literal nuevo en las dos listas es `chargesAdmin.routes.ts:31`). El diff de `tests/scrum601-copy-del-documento-vs-flag.test.mjs`, entero: `VEREDICTO_AL_MEDIR` pasa de `{ flag: 8, tipo: 11, aPelo: 162 }` a `{ flag: 8, tipo: 11, aPelo: 163 }` y `NO_LEGIBLES_AL_MEDIR` de `40` a `41`, cada uno con su línea de motivo `162 → 163 · 18-nov-2026 (SCRUM-1732c) · …` y `40 → 41 · …` encima. Nada más del guard cambia (12 líneas añadidas, 2 quitadas). Con eso, 5/5.

**Sin medir.** Ninguna base (staging y producción: los midió Javier, c.21940). El obligatorio de CI. yaqu.app. Que la limpieza del fixture de merchant borre bien las filas de anulación que se apuntan a sí mismas por `anula_id` con FK RESTRICT: solo corre en los tests con base.

No se cierra (A13): queda el PR-2 (J1) y la UI de los textos.
