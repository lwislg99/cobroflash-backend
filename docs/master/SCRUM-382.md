# SCRUM-382

**Fecha:** 9-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `8037a7a30049a442eb857733832c9eca0bf99ec2` · 2026-08-09T19:51:07+02:00

## El defecto

`POST /admin/albaranes/:id/fotos` creaba el `Attachment` **sin mirar si esos bytes ya estaban**. En
obra se sube dos veces con facilidad —el pulgar, la barra de progreso que no se ve al sol— y la
copia se quedaba para siempre: ocupaba una de las **diez** plazas, salía repetida en el PDF y en el
paquete de evidencias de A7.

## ⚠️ `computeAlbaranContentHash` NO servía, y se midió antes de escribir

Existe un hash en el albarán, pero **sella el CONTENIDO DEL DOCUMENTO** (número, fecha, líneas,
quién firma) para la evidencia de firma. No mira los bytes de ninguna foto. Reutilizarlo habría
atado el dedupe de adjuntos al **sellado**, que es justo lo que la regla 38 no quiere que se toque.
Aquí el hash es de los BYTES y solo se usa para comparar: no se sella, no se guarda, no viaja.

## Lo construido

`src/modules/jobs/domain/fotoDuplicada.ts` — `huellaDeBytes` y `fotoYaSubida`, puros y aislados
(solo dependen de `crypto`). La ruta responde **idempotente**, como firmar y como emitir: misma
foto → **200 con `already: true`** y el id de la que ya está. Sin fila nueva y **sin texto nuevo**:
no hace falta contarle un problema a quien no lo tiene (regla 30).

**Sin columna de hash a propósito:** sería schema, que está congelado. Se compara contra lo que hay,
y el coste está **acotado por el propio tope del producto (10 fotos)**. Se filtra primero por
tamaño, así que lo normal es no calcular ningún SHA.

## Guard

`tests/scrum382-foto-duplicada.test.mjs` — 8 tests. El que más importa: **dos fotos del MISMO
tamaño y distinto contenido NO son la misma** (el falso positivo que borraría una foto buena), con
su suelo de fixtures. Más un guard de que el dedupe **no** usa el sellador, con respaldo de la
negación (SCRUM-237), y otro de que la ruta consulta el dedupe **antes** de crear.
