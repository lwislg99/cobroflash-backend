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
