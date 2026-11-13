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

## J1 · SCRUM-1730b · construir (i) S2 por emisión y (ii) el tope del 31-dic (GO de c.21789)

**Medido contra:** `origin/main` = `a29e8fadcaa208fb9c6139341de3648318947da5` · 2026-11-13T16:21:11Z (hora de GitHub; sesión J1 `jv-j1ek`, por encargo del orquestador `cobroflash-backend-63`)

A9: comprobación → `tests/scrum1730-criterio-caja-huecos-declarados.test.mjs`

**Qué se ha hecho.** Con el GO de Javier en c.21789 (puntos 1 y 2). Sólo libros: ni builder, ni sellado, ni PDF.

- **`devengoPorCaja.ts` · `fechaDeDevengo` decide.** Con caja: si alguna línea lleva `causa: 'S2'`, devenga en `createdAt` (una mixta va ENTERA por emisión, como decide c.21789). Si no, devenga en el cobro si es hasta el tope, y en el tope si no hay cobro o el cobro es posterior. El tope es el 31-dic del año siguiente a `createdAt`, a las 23:59:59.999 locales, como el `hasta` de `rangoTrimestre` (`topeDeDevengo`). Con caja ya nunca devuelve `null`. La detección de S2 está copiada de `tieneLineasIsp` (`destinatarioIsp.ts`): aquélla no se exporta, y exportarla es tocar el camino de emisión (regla 38).
- **`libroRegistro.repo.ts` · `leerPorCaja`.** Con caja y rango, la base trae CANDIDATAS con tres consultas de un solo rango cada una: cobradas en el rango, emitidas en el rango y emitidas en los años cuyo tope cae en el rango. Cada candidata entra sólo si su `fechaDeDevengo` cae dentro, y el orden es fecha de devengo y número. Una cobrada después del tope sale como candidata por su `paidAt`, pero su devengo es el tope y se queda fuera: no se cuenta dos veces. Sin caja, o sin rango, la consulta es la de siempre.
- **El test de 1730.** Se retiran `s2` y `tope31dic` de `DEFECTO_CONOCIDO` (queda vacío; el (iii) nunca estuvo ahí). Los dos casos cambian de nombre y se añaden tres: la mixta (libro, casilla 122 y casilla 27 = 126 € en el T1), la cobrada DESPUÉS del tope (sale en el T4-2027 y NO en el T1-2028, y la casilla 27 da 210 y 0) y «el tope no adelanta nada» (sin cobro, fuera de 2026-T1, 2026-T4 y 2027-T3, que es lo de `scrum294b`). Casillas 28/29: salen del libro de recibidas, que no se toca.
- **Dos listas de piezas sin consumidor.** `fechaDeDevengo` ya tiene llamador: sale de `tests/_huerfanos-declarados.mjs` (la entrada de `devengoPorCaja.ts`, con `CAMPO_COBRO`, que también se usa ya) y pasa de `declaradas` a `retiradas` en `scripts/_sin-consumir-declarados.json`, un contenedor de S0 (`scrum1185` lo exige). Avisado al orquestador antes de tocarlo.

**Rojo primero.** Con `dist/` de los dos ficheros de `HEAD` (transpilados aparte) y el test nuevo: caen 4 de 10, los cuatro casos del arreglo. Con el arreglo, 10 de 10.

**Mutaciones** (catálogo rehecho contra el arreglo, con `correr` + `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`): base 10 pasados, 0 caídos, 0 saltados. Las **6 VIVAS**: sin la excepción S2; con la función devolviendo `null` sin cobro; con el libro sin pedir la ventana del tope (medio arreglo); con la cobrada después del tope contando en su cobro; con la caja desconectada (CIEGO); y con `s2` declarado otra vez. Árbol limpio después.

**Dirigida.** 54 ficheros: los que importan el libro, el 303, los libros AEAT, las evidencias, el 130, el 347 o `devengoPorCaja`, más `scrum294*`, `1063*`, `1064*`, `1240b`, `553`, `237`, `976`, `1387*`, `411`, `494`, `1185`, `189`, `615`, `622`, `719`, `273`, `267` y `1294`. Resultado: 518 casos, 511 ok, 6 saltados (todos `sin LIBRO_PG_URL`: 295, 296, dos de 297 y dos de 389) y 1 rojo, `scrum1185`, que se arregló con el movimiento de arriba (11 de 11 después).

**Build con tipos:** `tsc -p .` sale 2 por UN error, y no es de esta rama: `Job.queHayQueHacer` no está en el cliente Prisma compartido (junction al árbol común, no se regenera; A1). En los ficheros de esta rama, 0 errores.

**Errores míos.** Leí el arranque de normas después de Jira y no antes, y la cifra del arranque no la mandé al medirla (va a mis cicatrices).

**Sin medir:** ninguna base de datos (los 6 casos de `LIBRO_PG_URL`, saltados) · los libros AEAT y las evidencias, ejecutados sólo a través de los tests de la dirigida que los importan · la suite local entera (NO CORRIDA, por orden del encargo: 10 sesiones a la vez) · el cobro parcial (punto 4 de c.21789, ticket aparte) · el (iii), que espera a 1129.
