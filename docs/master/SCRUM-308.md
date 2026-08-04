# SCRUM-308 · CARACTERIZACIÓN-RECTIFY: qué hace HOY POST /rectify, para que un cambio se vea

**Fecha:** 4-ago-2026 · **Carril:** B (QA/caracterización) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `eebc191dc75da0040f4934ccd8b92cc857726832` · 2026-08-04T23:18:48+01:00

> ⚠️ Esa hora es el **committer date del primer commit del trabajo** (`a449e06`), no una lectura de
> reloj — el ancla apunta al árbol contra el que se midió (R14, como SCRUM-252/267/299).

## Por qué (medido en SCRUM-308, no supuesto)
Una ruta de emisión fiscal —`POST /admin/invoices/:id/rectify`, con huella VeriFactu encadenada
detrás— **sin un solo test que diga qué hace**: 0 tests demostraban que /rectify FUNCIONA sobre
`pending` o `paid`, 0 rectificaban una `annulled`, y el único test de la ruta (`scrum263:207`)
asserta un 409 por falta de líneas. **Autorización del fundador:** «escribe los tests, SOLO los
tests, NO se toca /rectify (regla 38). Caracterizar el comportamiento actual de una ruta fiscal es
lo más seguro que se le puede hacer; cambiarla sin tests, lo más peligroso.»

## Qué caracterizan (el PRESENTE, no un juicio)
- **ÉXITO (los que faltaban, primero):** R1 sobre `pending` → **201**; R1 sobre `paid` → **201**.
  Sin ellos, cualquier bloqueo futuro se construiría a ciegas y nadie cazaría un «lo bloqueaste todo»
  (la mordida de SCRUM-260).
- **⚠️ EL CASO QUE NADIE ESCRIBIÓ — R1 sobre `annulled` → HOY EMITE (201).** `/rectify` **no mira
  `status`**: es CIEGO al estado. El test dice lo que hace hoy, marcado **EN DISCUSIÓN** (SCRUM-308
  propone bloquearlo: dos registros contradictorios encadenados en VeriFactu, regla 29 = no se
  deshace). NO está bendecido; cuando se decida el bloqueo, ese test cambiará su expectativa — y que
  cambie es la señal de que el comportamiento cambió.
- **Los 3 cortes que sí existen (para que consten):** `type==='R1'` → 409 `cannot_rectify_rectification`
  · `already_rectified` → 409 · `isReceiptNumber` (J-) → 409 `cannot_rectify_receipt`. + `invalid_id`
  → 400 · `not_found` → 404.

## Cómo (patrón de SCRUM-263, sin BD ni turno)
Router REAL del `dist`, handler de negocio invocado con un `res` de doble y `prisma` SUSTITUIDO
(mutando el objeto exportado, que es al que apuntan los `const { prisma }` ya cargados). **El 201 es
REAL:** el doble se completó hasta que el handler llega a su respuesta — incluida la `auditLog` de la
tx, porque `allocateInvoiceNumber` AUDITA la reserva del número dentro de la misma transacción
(SCRUM-207); un doble incompleto habría dado 500 y **mentido sobre lo que hace /rectify** (el SUELO
que el fundador marcó como el peor caso). Merchant NO-ES a propósito: `getEmissionMode='fiscal'`
emite sin depender del flag ni entrar en la cadena VeriFactu, así el doble es mínimo y el test mira
el ESTADO, no el modo. `t.after` restaura `prisma`: no ensucia a otros tests del proceso.

## Rojo por el mecanismo
Rota a mano la guarda `type==='R1'` **en el `dist`** (artefacto de build, NO la fuente `.ts` — regla
38 intacta) → cae **solo** el test del corte `type==='R1'` nombrándolo (`cannot_rectify_rectification`),
los otros siguen verdes: el test es específico de esa guarda, no un 409 en bloque. Restaurado con
`npm run build` desde la fuente intacta; 7/7 verde.

## 🔴 Límite reportado (lo que este doble NO hace)
El doble **PRESENTA** una factura con `status:'annulled'`; **NO la CONDUCE** a anulada por la ruta
`/annul` contra una BD real. La secuencia real **anular→rectificar** —que es la que produciría el
incidente en producción— necesita **gateado** (turno de staging), y es otra conversación. Que ningún
test conduzca a `annulled` de verdad es, además, la razón medida de que nadie viera el hueco.

## Fuera de alcance (regla 38, no tocado)
`/rectify`, `invoicesAdmin.routes.ts`, el flag, `allocateInvoiceNumber` ni ninguna línea del camino de
emisión. Implementar el bloqueo (autorizados los tests, NO el cambio). El front. Producción.

## Ficheros
- `tests/scrum308-caracterizacion-rectify.test.mjs` — 7 tests de caracterización, sin gate.

**Ungated 1303 · 1236 pass · 0 fail · 67 skip.**
