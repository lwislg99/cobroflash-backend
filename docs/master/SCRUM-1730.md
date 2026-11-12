# SCRUM-1730 · Criterio de caja: los tres huecos del libro, el 303, los libros AEAT y las evidencias

## J1 · SCRUM-1730 · reproducir (i) y (ii) ejecutando el código, y proponer el GO

**Medido contra:** `origin/main` = `2c52196fddfdee2f2875c38d51642785d2566812` · 2026-11-12T18:05:57Z (hora de GitHub; sesión J1 `jv-j1eg`, por encargo del orquestador `cobroflash-backend-63`. Re-medido contra `420ee00b709e461b70f1c0e99766a5a1de834986`: 0 cambios en `src/` y `prisma/` entre los dos)

A9: comprobación → `scripts/meta-guard-mutaciones.mjs`

**Qué es.** Sale de SCRUM-1240 c.21773 (medición de `jv-j1ef`, leída en el código) y de la decisión c.21776 (los tres huecos a un ticket J1, cada arreglo con su GO). Aquí se REPRODUCEN ejecutando, se dejan fijados como defecto declarado y se propone el arreglo. **No toca `src/`** (regla 38): el test importa el libro y el 303 de `dist/`, que no son el camino de emisión. Comentario de Jira con la medición y las preguntas: **SCRUM-1730 c.21785**.

**Reproducido** (libro registro y 303 reales, base en memoria, merchant con `criterioCaja: true` leído por `criterioDelMerchantParaElLibro`):

- **(i) S2.** Factura con una línea `causa: 'S2'`, emitida el 15-feb-2027 y cobrada el 20-may-2027: cae en el T2 del libro y de la casilla 122 del 303, no en el T1. Control positivo: una S1 con las mismas fechas cae en el T2 (la caja está encendida).
- **(ii) 31-dic.** Factura del 10-mar-2026 sin cobro: `fechaDeDevengo` = `null` y el libro del T4-2027 no la trae. Controles: cobrada en nov-2027 sí sale en ese T4; sin caja sale por emisión en el T1-2026.
- **(iii) vivo contra congelado.** No reproducible: `invoices.merchant_criterio_caja` da 0 en `src/` y `prisma/` de `origin/main` (entra con el PR de 1129).

**Dato nuevo.** `fechaDeDevengo` tiene 0 llamadores en `src/` (huérfana declarada en `tests/_huerfanos-declarados.mjs`); el libro decide en el `where` de `leerLibroRegistro`. Arreglar sólo la función no cambia ningún libro: lo fija la 2ª mutación del test (MEDIO ARREGLO → rojo).

**Cobro parcial.** `Invoice` tiene un `paidAt`, un `status` y un `chargeId`; no hay tabla de cobros por factura (`Charge` → `Invoice[]` es un cobro para varias facturas, no al revés). El flujo que sí es parcial es la retención de garantía (SCRUM-1107): la liberación es un `Charge` nuevo sin enlace a la factura. Leído, no ejecutado.

**El test.** `tests/scrum1730-criterio-caja-huecos-declarados.test.mjs`, 7 casos: `DEFECTO_CONOCIDO` con una entrada por hueco citando SCRUM-1730 (patrón 1240b). Rojo si el comportamiento cambia con la declaración puesta, si se retira sin arreglar, con medio arreglo o en CIEGO.

**Rojo primero** con `correr` + `aplicarUna` del meta-guard, árbol commiteado en `5863c33506240d216cfaca1ebfc2d9915426c4d5` (base 7/7): las 5 mutaciones declaradas tumban el test que nombran, cada una por su motivo — CAMBIADO (prototipo del arreglo de (i)), MEDIO ARREGLO (sólo la función de (ii)), CIEGO (caja desconectada) y dos «se retiró la declaración». `git status` limpio tras la pasada.

**Propuesta de GO** (detalle en c.21785 ③; ninguna toca la emisión): (i) `libroRegistro.repo.ts` lee por emisión las facturas con líneas S2 — riesgo: la factura mixta; (ii) el `where` del libro + `fechaDeDevengo` con el tope del 31-dic — riesgo: no volver a contar las cobradas después del tope, y `createdAt` como fecha de la operación; (iii) tras 1129, criterio por factura y decisión de qué hace NULL. Preguntas ✅/❌ en c.21785 ④.

**Errores míos.** ① Mi primer driver le pasó a `correr` la ruta con `tests/` delante y la base salió 0 pasados · 1 caído: lo paró la PUERTA 1 del meta-guard (no muta sin base en verde). ② El ancla de la 5ª mutación no casaba (el `},` no va en su propia línea): lo paró su comprobación del ancla. ③ Encadené un `sed` roto con `&&` delante del `node` y leí el fichero de salida de la pasada ANTERIOR como si fuera el nuevo; lo vi por el `EXIT=1`, borré el fichero viejo y relancé con un driver escrito con la herramienta de escritura.

**Sin medir:** ninguna base de datos · los libros AEAT y el paquete de evidencias (sólo ejecutados el libro y el 303) · la suite local entera (NO CORRIDA; los guards dirigidos, en la entrega).
