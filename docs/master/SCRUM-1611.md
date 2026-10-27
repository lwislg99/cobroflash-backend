# SCRUM-1611 · dos tests de concurrencia de la numeración no cazan que se quite el cerrojo, y scrum92 cuenta sobre la base compartida

## J6 · SCRUM-1611 · medición y propuesta (nada construido)

**Medido contra:** `origin/main` = `c09dd883ebfaf0f5e2213fb31f623ca547871a01` · 2026-10-26T23:34:28Z (hora de GitHub; sesión J6 `jv-j6cy`, por encargo del orquestador `cobroflash-backend-8b`. Los tests al banco no están en main: medido sobre la punta de 1599s `7439e740a2933ce28ed3c7a9487cba98a745ef42`, PR #2907. Detalle y propuesta en Jira, SCRUM-1611 c.20978)

A9: aviso → cicatriz J6 «Me medí al acabar la lectura de arranque y no al acabar de leer Jira, aunque el encargo pedía los dos puntos; la siguiente cifra fue 178k, ya midiendo» — no se pudo comprobar: el contexto lo lee la propia sesión en su jsonl, y ningún hook de este árbol lo mide en los puntos fijos

Solo docs: 0 líneas de `src/`, `tests/`, `prisma/` o `.github/`. Banco: el Postgres 16.14 de `pgbanco-1599p` sin cambiar, en loopback, con la base rehecha en cada pasada. Las mutaciones van solo en `dist/` y se restauran por sha256 (`mutdist.mjs.txt`): `invoiceNumber.service.js` `66f09cfc…` y `quotesAdmin.routes.js` `3c1ae220…`, las dos de vuelta a su sha. Dos sondas en cada pasada (`medir1611.mjs.txt`): (A) `pg_stat_activity` + `pg_locks` cada ~15 ms, y (B) `log_statement=all` del propio Postgres, con pid y xid. Clasificadores: `orden234.mjs.txt` y `orden814.mjs.txt`. Salida entera: `evidencias/SCRUM-1611/salida-1611.txt`.

### ① scrum234: la barrera llega tarde

Hay concurrencia real: 3 conexiones y 2-3 transacciones abiertas a la vez. Lo que falla es el orden. El test lanza las dos emisiones sin esperar a que la barrera tenga su `FOR UPDATE`. Y en formato F la secuencia sale de un `findMany` de `invoices` (SCRUM-780), así que una emisión que llega antes que la barrera termina entera.

| 13 pasadas sin `pg_advisory_xact_lock` | n | CAE (P2002) | VIVE |
|---|---|---|---|
| barrera ANTES de la 1ª lectura de facturas | 6 | 6 | 0 |
| barrera DESPUÉS, B lee antes del COMMIT de A | 3 | 3 | 0 |
| barrera DESPUÉS, B lee después del COMMIT de A | 4 | 0 | 4 |

Candidato medido en una copia del test, sin empujar (`234-barrera-tomada.diff.txt`): las emisiones salen cuando la barrera ya tiene la fila. Con cerrojo: 5/5 verdes. Sin cerrojo: 8/8 caen con P2002. La barrera queda ANTES en las 13.

### ② scrum814: la carrera no llega a la base

Primer caso, 7 pasadas (1 limpia y 6 sin `tomarCerrojoDeSerie` en `quotesAdmin.routes.js`). Las dos transacciones se solapan 0 de 7 veces, con un desfase de salida del cliente de 0 ms en las 7. B llega a la base 26-32 ms después que A, y la tx de A dura 28-47 ms. Sin cerrojo vive 6/6. El suelo del test mide la salida del cliente, no el solape en la base. Por qué el servidor las escalona: SIN MEDIR.

### ③ scrum92

El caso 3 cuenta `authSession.count()` sin filtro (líneas 124-126): leído en el código. El «11 !== 9» no lo he reproducido. Acotarlo a los comercios del test pierde la fuga que vigila, porque `merchantId` es obligatorio y un fantasma solo podría casar con un comercio cualquiera.

### Propuesta (c.20978, ✅/❌)

- **234:** esperar a la barrera (medido) y catalogar la mutación del cerrojo. Además, un suelo que cuente en `pg_locks` las dos esperas: sin medir.
- **814:** una barrera con el mismo cerrojo de serie, tomada desde una tercera conexión, y el suelo pasado a las esperas en `pg_locks`. Predicho, no medido. ❌ declararlo no vigilado.
- **92:** ❌ acotar. ✅ `serie`, o comparar el conjunto de sesiones nuevas.

**Sin medir:** CI · staging · el régimen T con estos arreglos · suite entera local: NO CORRIDA.
