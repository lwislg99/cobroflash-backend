# SCRUM-1048 (CON-07a) — Resumen del trimestre: el cálculo

**Sesión 1 · 25-sep-2026 · rama `scrum-1048-resumen-trimestre-calculo`** · base `origin/main`
`bf4d82c6` (última entrega en `main` al empezar).

## Medición previa: qué de este ticket esperaba de verdad al asesor

El ticket pedía IVA repercutido, IVA soportado, diferencia **y retenciones**. Medido antes de
tocar código:

| parte | ¿esperaba al asesor? | evidencia |
| --- | --- | --- |
| IVA repercutido por tipo | NO — ya construido (SCRUM-296/389, `GET /admin/reports/vat`) | `reports.routes.ts` existente |
| IVA soportado por tipo | NO — `Expense.vatRate/vatAmount/vatDeducible` ya existen (SCRUM-403); solo hay que SUMAR lo que el profesional ya marcó, sin decidir deducibilidad | `prisma/schema.prisma:954-963` |
| Diferencia | NO — aritmética sobre las dos anteriores | — |
| Retenciones sufridas | **SÍ, pero no del asesor: de un ALTER que no existe.** `Invoice` no tiene NINGUNA columna para la retención aplicada; `retencionIrpf.ts` (SCRUM-293/A2) lo dice explícitamente: «espera el campo… las migraciones están paradas». Q-C5 (el % que aplica) SÍ está respondida (15/7/2/1 cerrada, SCRUM-1039), pero sin columna no hay dato que sumar | `prisma/schema.prisma` (grep `retenc`: 0 resultados en `model Invoice`); `src/modules/invoicing/domain/retencionIrpf.ts:6-11` |

Q-C4 (recargo de equivalencia) no bloquea nada de lo construido: el recargo es un régimen de
minoristas, no de los oficios de YaQu, y no entra en `calcVatBreakdown` ni en el desglose por
tipo que ya usan `/vat` y el 303.

**Conclusión:** 3 de 4 partes se podían construir sin dictamen fiscal. Construidas. La cuarta
(retenciones) queda declarada como bloqueada por schema, no por asesor — un GO del asesor hoy no
la desbloquearía.

## Hecho

- `src/modules/reports/domain/resumenTrimestre.ts` (nuevo): `agruparIvaPorTipo` (extraída de la
  agrupación que ya hacía `/vat` en línea, para no tener el mismo cálculo en dos sitios — A9),
  `calcularIvaSoportado` (nuevo: gastos por tipo de IVA, solo lo marcado `vatDeducible: true`
  entra en la cuota que resta; lo marcado `false` se cuenta aparte; lo sin marcar o sin
  `vatRate`/`vatAmount`/`baseAmount` se declara `sinClasificar`, nunca se reparte a ojo),
  `retencionesNoDisponibles` (declara el bloqueo, no inventa un 0,00), `construirResumenTrimestre`
  (junta las tres).
- `GET /admin/reports/resumen-trimestre?year=&quarter=` en `reports.routes.ts`: reutiliza
  `rangoTrimestre` y `leerLibroRegistro` (el MISMO periodo y el MISMO libro que `/vat`, para que
  las dos rutas no puedan decir cifras distintas del mismo trimestre) para el repercutido; lee
  `Expense` del mismo periodo para el soportado. Multi-tenant: filtra por `req.merchantId`, como
  el resto de `reports.routes.ts`.
- No toca `/vat`, `casillas.ts`, `modelo303.ts` ni ningún `invoice.create`/camino de emisión —
  solo lectura (regla 38).
- Respuesta marcada `borradorParaAsesor: true` (regla 7): nunca «lo que debes» ni «Hacienda».

## Tests (`tests/scrum1048-resumen-trimestre.test.mjs`, 10/10 verde, contra `dist/`)

Casos a mano del ticket: emitida base 1.000/210 + gasto deducible base 300/63 → diferencia 147.
Casos límite del comentario del fundador: trimestre sin datos · resultado negativo (se devuelve
tal cual, sin «devolución») · IVA no deducible fuera de la diferencia · `vatDeducible` sin marcar
→ sin clasificar, no repartido · deducible pero sin `baseAmount` → sin clasificar · varios gastos
del mismo tipo se suman · céntimos (0,10+0,20) · retenciones siempre no disponibles con motivo.

El caso «retención 15 % sobre 1.000 → 150 en su bloque» **NO se prueba**: no hay dato que sumar
(ver tabla arriba). No es un test que falte, es un bloque que no existe todavía.

## Verificación

`guards:entrada`: 12 guards, 112 tests, verde (13,8 s de 90). `npm test` completo NO se usó como
control: falla por una dependencia ausente preexistente (`read-excel-file`, ver abajo), ajena a
este ticket — mis 10 tests nuevos y los guards de entrada SÍ están verdes de forma aislada.

**Hallazgo con víctima hoy, no pedido por el ticket:** `npm run build` falla en este worktree
porque `read-excel-file` está en `package.json` pero NO instalado en `node_modules`
(`Cannot find module 'read-excel-file/node'`, `importarClientes.service.ts`). `tsc` emite igual
(no usa `noEmitOnError`), así que no bloquea esta entrega, pero SÍ hace caer en cascada decenas de
tests que importan `app.ts` (webhooks, `customersAdmin.routes`, etc.) porque `app.ts` importa esa
ruta. Reportado aquí, no arreglado (no es mi carril y otra sesión puede estar ya tocando
`importarClientes`/SCRUM-1046).

## Siguiente (fuera de este ticket)

- CON-07b (pantalla, S2): puede empezar ya, la ruta está.
- Retenciones: solo se desbloquea con el ALTER de SCRUM-293/A2 en `Invoice` (decisión de schema,
  no de asesor).
