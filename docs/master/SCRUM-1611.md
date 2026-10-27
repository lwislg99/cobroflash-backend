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

## J6 · SCRUM-1611b · la barrera esperada en 234, la barrera de serie en 814 y el conjunto en 92

**Medido contra:** `origin/main` = `d03550cdde406c0e6a9d11058ebe02d9c588f3cf` · 2026-10-27T00:05:30Z (hora de GitHub; sesión J6 `jv-j6db`, por encargo del orquestador `cobroflash-backend-8b`, decisión de reparto SCRUM-1611 c.20980. Rama `scrum-1611b-barrera`, que sale de la punta de 1599s `64c2c7badcf354d093593a530d795831b7def153` (PR #2907, abierto: no estaba en main) y lleva mergeada la rama de evidencias de jv-j6cy, `scrum-1611-banco-sin-carrera` (PR #2911), para AÑADIR este tramo al registro que esa rama crea y no crearlo dos veces)

A9: aviso → cicatriz J6 «No me medí al acabar de leer Jira, el segundo punto fijo: la siguiente cifra fue 208k, ya pasado el aviso, la misma que dejó j6cy en SCRUM-1611 la víspera» — no se pudo comprobar: ningún hook de este árbol lee el usage de la sesión en los puntos fijos del encargo

De paso, retirado `evidencias/SCRUM-1611/mutdist.mjs.txt` (de §1611, su texto queda en `76e8b6b346739767c667f322926438029578620f`): es un guion de mutación con su lista propia que no nombra el catálogo, y `scrum1387` (y con él `guards:entrada`, scrum976) lo tumbaba en esta rama y en #2911. Las dos mutaciones que aplicaba a mano están ahora en `MUTACIONES_CON_BASE` de 234 y 814 y las corre `mutar-1599i`. No se ha tocado el guard.

De paso, otra mía, también a cicatrices: corrí `carriles.mjs de` sobre 234 y 814 después de editarlos (los tres tests salen «sin fila en §3: nadie lo reclama»).

Banco: el Postgres 16.14 de `pgbanco-1599p` sin cambiar (`initdb -E UTF8 --no-locale`; `SHOW server_encoding` = `UTF8`, comprobado: el orquestador avisó de que `arrancar-pg-1599q` lo crea en WIN1252), loopback, base rehecha desde la plantilla en cada fichero. Mutaciones con el runner de la casa, `evidencias/SCRUM-1599/mutar-1599i.mjs`, que muta `dist/` y lo restaura byte a byte; además, sha256 de los tres `.js` comprobados con `sha256sum -c` tras cada lote. El fuente de la emisión no se toca: 0 líneas de `src/`. Salidas: `evidencias/SCRUM-1611/salida-1611b.txt`; el ruido de ③, `ruido92-1611b.mjs.txt`.

### ① scrum234 · la barrera, esperada

Las emisiones salen cuando la barrera YA tiene su `FOR UPDATE` (`Promise.race([barreraTomada, barrera])`). Ninguna aserción cambia. Catalogada en `MUTACIONES_CON_BASE` la mutación natural, quitar el `pg_advisory_xact_lock` de `allocateInvoiceNumber`.

| test | pasada | n | resultado |
|---|---|---|---|
| nuevo | limpia | 6 | 6 verdes |
| nuevo | sin `pg_advisory_xact_lock` | 6 | 6 MUEREN, por «UNA DE LAS DOS EMISIONES CONCURRENTES FALLÓ» (P2002) |
| nuevo | contador `seq` (la de §1599s) | 6 | 6 MUEREN, por «el contador no cuadra» |
| viejo (`HEAD` de 1599s) | sin `pg_advisory_xact_lock` | 8 | 8 MUEREN |

⚠️ **El rojo del viejo NO lo he reproducido**: en mi banco el test viejo ya mata la mutación 8 de 8. jv-j6cy lo vio vivir 4 de 13, y sólo cuando la barrera llegaba DESPUÉS de la 1ª lectura y B leía tras el COMMIT de A (c.20978): es un orden, y en esta máquina, a esta hora, no salió ni una vez. El arreglo no se apoya en un rojo mío: se apoya en la partición de j6cy (13 de 13) y en que quita la dependencia del orden. Este tramo no clasifica el orden de sus pasadas (no corrí la sonda B de j6cy).

### ② scrum814 · medida primero, construida después

La barrera toma `pg_advisory_xact_lock(SERIE_LOCK_NS, merchant)` desde una tercera conexión, lanza las dos peticiones (`dosALaVez`, sin tocar) y suelta cuando `pg_locks` muestra a las DOS esperando ese cerrojo. Si en `MARGEN_ARRANQUE_MS + 5000` no llegan las dos, el caso FALLA con «NO SE CONCLUYE NADA». El suelo del desfase de salida se queda como estaba: se AÑADE el de las esperas. Va en los casos ① y ②; el ③ es secuencial. De `dist/modules/**` sólo se importa la constante `SERIE_LOCK_NS`. Catalogada «sin `tomarCerrojoDeSerie`».

| test | pasada | n | resultado |
|---|---|---|---|
| nuevo | limpia | 5 | 5 × 3 de 3 verdes; diagnóstico «2 peticiones esperando el cerrojo» |
| nuevo | sin `tomarCerrojoDeSerie` | 5 | 5 MUEREN: caen ① y ② por «DOS FACTURAS DEL MISMO TRAMO»; el secuencial sigue verde |
| nuevo | `tramoTrasEmitidas(0)` (la de §1599p) | 5 | 5 MUEREN, 3 de 3 casos |
| viejo, con la misma mutación | sin `tomarCerrojoDeSerie` | 5 | 5 **VIVEN**, 0 de 3 casos caen |

La pieza que trabaja es la barrera: con ella muere 5/5, sin ella vive 5/5, con el mismo `dist/` mutado. Lo que había PREDICHO c.20978 (que sin el cerrojo las dos cuentan 0 y esperan en el de `allocateInvoiceNumber`) casa con el resultado; el orden dentro de la base no lo he registrado.

### ③ scrum92 · el conjunto, no el recuento

El caso 3 ya no hace `authSession.count()` sobre toda la base: toma `max(id)` antes, llama, y lee el CONJUNTO de sesiones con `id` mayor. Una del comercio del test es rojo en el acto. Una ajena no se distingue de una fuga, así que la ventana se repite hasta 5 veces hasta verla vacía, y ni una vacía es rojo. No se acota a los comercios del test (c.20978: la fuga de un fantasma cae en un comercio cualquiera) ni se declara `serie` (c.20980). Catalogada la fuga: el fantasma abre sesión en el comercio más antiguo.

| test | ruido de otro proceso (`ruido92`) | n | resultado |
|---|---|---|---|
| viejo | cada ~10 ms | 5 | 1 ROJO |
| viejo | cada ~2 ms | 6 | 1 ROJO, por «un email que no existe en NINGUNA tabla no debe crear ningún AuthSession» |
| nuevo | cada ~2 ms | 6 | 6 verdes: 5 con la 1ª ventana vacía, 1 con la 2ª (la 1ª traía una sesión del ruido) |
| nuevo, fuga al comercio más antiguo | sin ruido | 1 | MUERE: el comercio más antiguo es el del test |
| nuevo, fuga al comercio más antiguo | cada ~2 ms | 3 | 3 MUEREN: el más antiguo es el del ruido, y las 5 ventanas salen llenas |
| nuevo, `teamMemberId: null` (la de §1599p) | cada ~2 ms | 3 | 3 MUEREN |

El rojo del viejo es éste, reproducido con ruido; el «11 !== 9» literal de §1599s salió en el régimen T, que no he corrido. ⚠️ Lo que el caso 3 deja de ver: una fuga que no saliera en CADA llamada, con la base ruidosa en las ventanas en que no sale. El código entre el lookup y el `create` no tiene azar; si un día lo tiene, esto hay que volverlo a pensar.

### ④ Guards

En el comentario de Jira de este tramo (la dirigida corre después de escribir este registro).

### ⑤ Sin medir

- CI · staging · el régimen T (86 ficheros en paralelo) con estos arreglos.
- La tanda entera en local: NO CORRIDA (diez sesiones a la vez).
- El orden de las sentencias en la base (la sonda B de j6cy) en las pasadas de este tramo.
- Si #2907 y #2911 entran antes o después que ésta: ésta los lleva dentro a los dos.
