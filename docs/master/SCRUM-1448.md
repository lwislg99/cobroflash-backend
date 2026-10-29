# SCRUM-1448 · Dos fuentes para «el total»: medido junto a SCRUM-1446 y SCRUM-1447

**Medido contra:** `origin/main` = `a65a8c756c0363ec5ea6f4f0b1e811ba17a909c0` · 2026-10-07T23:34:34Z (hora de GitHub)

A9: comprobación → `tests/scrum1446-los-tres-importes-del-pdf.test.mjs`

La medición entera está en `docs/master/SCRUM-1446.md`, §4. Aquí, sólo el resultado:

- El caso que el ticket pedía buscar existe, generado y leído del papel: guardado 0,03 €, impreso
  0,04 € (0,02 al 21 % más 0,01 al 10 %).
- Con un tipo y precios de dos decimales diverge el 0,2 %; con dos tipos, el 24 %. Lo nuevo: una
  factura por tramos diverge entre el 7 y el 11 %, y una con descuento de línea el 25 %, con un solo
  tipo.
- La factura sin líneas imprime el guardado; con líneas lo ignora. Una factura nueva sin líneas no se
  puede emitir (leído por texto: los 7 sitios que crean factura pasan antes por el portón de líneas).
- En el presupuesto, el pie y el Total salen de dos funciones y también se separan.
- No se ha arreglado nada: la fuente del total es la decisión de SCRUM-624, que espera a la asesoría.
- No medido: ninguna factura real.

## SCRUM-1448a · ¿Algún camino crea hoy un JUST? No: 0 de 12 en `src/`, y los 3 de `scripts/` tienen la rama muerta

**Medido contra:** `origin/main` = `5078f80c3726c93b3751baf9c10134b4a486eaa4` · 2026-10-27T11:52:43Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1448/censo-just.mjs`

[Escrito por J1 (`jv-j1cx`). El encargo es la decisión del fundador en SCRUM-1448 c.20918 («JUST: antes de
decidir nada, se mide si algún camino lo crea hoy»), leída entera en Jira con los otros cuatro comentarios.
Sólo lectura: no se ha tocado nada del camino de emisión. Cuando terminé, `origin/main` iba por `e19665301`; entre
las dos puntas no cambia nada en `src/`, `scripts/` ni `tests/_embudo-factura.mjs` (`git diff --stat` vacío).]

### En corto

- **Ningún camino de `src/` crea hoy un documento JUST ni con número `J-`.** Población: 340 ficheros de `src/`
  leídos por AST; 8 creaciones de `Invoice` (las mismas 8 que el censo de la casa, `tests/_embudo-factura.mjs`) y 4
  llamadas a `emitInvoice`: **12 caminos, 0 con JUST**. Nueve escriben `F1` literal, uno `R1` (`POST /:id/rectify`), y
  dos sólo pasan el valor: el `create` interno de `crearFacturaEmitida` (su `type` lo ponen sus 7 llamadores) y el de
  `emitInvoice` (`input.type ?? 'F1'`, que fijan sus 4 llamadores, los cuatro con `'F1'`).
- **Ninguna escritura posterior convierte una fila en JUST:** 24 `invoice.update|updateMany` en `src/`; ninguno
  escribe `type` ni `number`. Dos con `data` que el AST no ve, leídos a mano: `invoicesAdmin.routes.ts:791` sólo pone
  las fechas del recordatorio, e `invoiceAdmin.ts:310` sólo `status`, `paidAt` y `paidVia` (`campoPaidViaAlMarcar`).
- **Cruce por el nombre del campo (A10, SCRUM-1401):** 0 propiedades `type: 'JUST'` en todo `src/`. Los 7 literales
  `'JUST'` que hay son 5 lecturas (cuatro comparaciones y un filtro `not`), la declaración del tipo `TipoDocumento`
  (`tipoDocumento.ts:52`) y la etiqueta del registro de auditoría de `invoiceNumber.service.ts:431`, que no es la fila.
- **El número `J-` no se compone en ningún sitio:** de los 4 literales que empiezan por `J-`, 3 son lecturas (dos
  `startsWith` y una regex `/^J-/i`) y el cuarto es la declaración de `RECEIPT_NUMBER_PREFIX`. Esa constante tiene UNA lectura,
  `isReceiptNumber`. `allocateInvoiceNumber` lanza `invoicing_es_disabled` en modo `receipt` (SCRUM-1027), y es el
  único número de las 12 creaciones (el embudo da `motivo: null` a las 8).
- **Fuera de `src/` sí hay tres escritores de JUST** (`scripts/seed-demo.mjs:384` y `:441`, `scripts/seed-video.mjs:555`):
  `type: isReceiptNumber(number) ? 'JUST' : 'F1'`. Los tres toman el número de `allocateInvoiceNumber`, así que esa
  rama no puede salir: **código muerto, leído en el código y no ejecutado.**
- **Conclusión de la medición:** un JUST que se imprima hoy sólo puede ser una fila que YA exista, creada antes de
  SCRUM-1027 (21-sep-2026). Cuántas hay en cada base no lo he medido: no tengo base a la que preguntar (es la P8).

### El instrumento y sus controles

`node docs/master/evidencias/SCRUM-1448/censo-just.mjs .` → `salida-censo.txt` (salida 0, MEDIDO).

- **Siembra:** un fuente fabricado dentro del propio script, con un JUST por cada pregunta (creación,
  `emitInvoice`, `update`, prefijo), pasa por las mismas funciones. Con `--sin-siembra` sale **CIEGO, salida 2**
  (`salida-censo-ciego-sin-siembra.txt`), no verde.
- **Otro tipo:** el árbol real tiene que dar al menos una creación con `type` F1 literal (da nueve); si no, CIEGO.
- **Dos sondas:** la población de creaciones sale de mi recorrido Y de `analizarFuente` de la casa, y los conjuntos
  `ruta:línea` tienen que ser idénticos (8 = 8; 0 sólo míos, 0 sólo de la casa). Anidadas o SQL en crudo: 0.

### Lo que no he medido

- Filas JUST o `J-` que ya existan en dev, staging o producción: ninguna base (P8).
- Rutas: cada camino se nombra por su `router.<método>('<ruta>')` relativo al router; el prefijo de montaje no
  está resuelto.
- Receptores con alias (`const t = tx.invoice; t.create(…)`): el AST de la casa y el mío no los ven (el embudo lo
  dice en su cabecera).

### Errores míos

- La primera pasada etiquetaba «default de la BD» un `update` sin `type`, que en realidad quiere decir «no lo toca»;
  lo cacé al leer la salida, y la salida empujada es la corregida.
- En la primera redacción de este tramo escribí tres recuentos de memoria (10 F1, 6 lecturas de `'JUST'`, «4 literales
  y la regex»), y los tres estaban mal; los corregí releyendo `salida-censo.txt` antes de empujar.
- En el comentario de Jira (c.21002) empecé tres celdas de tabla con «0.», y Jira lo leyó como lista y se comió el
  cero sin dar error; lo vi en el cuerpo que devolvió la herramienta y lo edité.
- El encargo decía `src/`, y los escritores de JUST estaban en `scripts/`: los encontré porque pasé el embudo también
  por `scripts/` y `prisma/`, no porque el encargo lo pidiera.

## SCRUM-1448b · Filas JUST / `J-` en staging y dev: CIEGO, este árbol no tiene clave de ninguna de las dos

**Medido contra:** `origin/main` = `efe736f3f01b5ecbc6dce221e80a3dfc3bfcd42a` · 2026-10-27T12:58:40Z (hora de GitHub)

A9: sin fallo que generalice — el CIEGO es una ausencia del entorno, medida con la herramienta de la casa (`scripts/comprobar-claves-bd.mjs`), y no un error de este puesto

Encargo: la P7b del fundador (c.21008, ✅): contar con sólo lectura las filas de `invoices` con `type='JUST'` o
`number LIKE 'J-%'`. Producción la midió el fundador en Railway (c.21012 y c.21013). Staging y dev, este tramo.
Sesión `jv-j1cy`. Nada escrito en ninguna base; ninguna consulta lanzada.

### En corto

| base | total | JUST | `J-` | las dos | F1 | quién |
| --- | --- | --- | --- | --- | --- | --- |
| producción | 2 | 2 | 2 | 2 | 0 | el fundador en Railway (c.21012); las filas 216 y 217, comercio 18, `pending`, sin huella (c.21013) |
| staging | CIEGO | CIEGO | CIEGO | CIEGO | CIEGO | sin `DATABASE_URL_STAGING` |
| dev | CIEGO | CIEGO | CIEGO | CIEGO | CIEGO | sin `DATABASE_URL_DEV` |

CIEGO no es cero: no se ha preguntado a ninguna de las dos bases.

### Por qué CIEGO

- `node scripts/comprobar-claves-bd.mjs` en este árbol: `DATABASE_URL_STAGING`, `_DEV` y `_TESTS` AUSENTES, y su
  SUELO dice que no leyó ninguna cadena de conexión. Sale con 1 («No se sigue»).
- El árbol no tiene ningún fichero `.env*`.
- Ninguna variable `DATABASE_URL*` en el entorno de proceso, de usuario ni de máquina (Windows). Control de que el
  listado ve algo: `PATH` sí aparece en el proceso.
- Es lo mismo que registró la S0 el 14-oct-2026 en CLAUDE.md (regla 3): ningún árbol de la máquina llevaba esas
  claves. No se ha recorrido hoy el resto de árboles: el encargo era éste.

### De dónde salen las filas `J-` (leído en `git log origin/main`, no en ninguna base)

| commit | fecha | qué |
| --- | --- | --- |
| `2aef59b62` | 2026-06-11 | nace el justificante `J-` con `INVOICING_ES_ENABLED` en OFF (`git log -S RECEIPT_NUMBER_PREFIX -- src`) |
| `b8e3f81a61344f5cfa94184be9e31c45c1270cdd` | 2026-09-22T09:42:53+01:00 | SCRUM-1027 (#1608): con el flag en OFF deja de generarse cualquier documento |
| `8931af810c514c0a7e4086db4f09b028bab92ab6` | 2026-09-28T23:14:18+01:00 | SCRUM-825: se retira el generador `J-`, ya sin llamador |

Las dos de producción (20 y 21-sep) caen dentro de esa ventana. Una fila `J-` de staging o dev, si existe, sólo
puede haber nacido entre el 11-jun y el 22-sep, o de los seeds que 1448a dejó con la rama muerta.

### Lo que no he medido

- Las filas de staging y de dev: nada. Quien tenga la clave corre el mismo SELECT del orquestador (total, JUST,
  `J-`, las dos, F1) y, si sale alguna, `id`, `merchantId`, `number`, `status`, `createdAt` y si tiene `vf_hash`.
  Control de lectura: `total > 0`, no F1 (producción da F1 = 0 con la tabla bien leída, c.21012).
- El turno de staging no se ha tomado: sin clave no había nada que reservar.

### Errores míos

- Mi primera orden usó `$CLAUDE_JOB_DIR` en Git Bash, donde no está definida: el `git rev-parse` salió 128 y el
  volcado de las normas no se escribió. Lo vi por la salida y lo repetí con la ruta escrita.

## SCRUM-1448c · La sonda del enunciado: `Invoice.total` contra el total que imprime el PDF, factura a factura

**Medido contra:** `origin/main` = `77ce98573b1b5e090dfcf7754c4e7960bc63b85a` · 2026-10-27T15:14:44Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1448/sonda-total-del-pdf.mjs`

Encargo: lo que c.21038 reabrió. El enunciado pide una sonda de sólo lectura que compare, para las facturas de la
base de pruebas, `Invoice.total` con el total que imprime el PDF, y diga sobre cuántas miró. P7a y P7b no la
cubrían. Sesión `jv-j1da`. Nada escrito en ninguna base. `src/` sin tocar: la sonda carga `dist/` y lo llama.

### En corto

| base | filas en `invoices` | PDF generados y leídos | tipos | imprimen ≠ guardado |
| --- | --- | --- | --- | --- |
| staging | 9 | 9 | 9 JUST | **0 de 9** |
| dev | 12 | 12 | 12 F1 | **0 de 12** |
| producción | 2 (c.21012) | NO MEDIDO | 2 JUST (c.21013) | NO MEDIDO: la sonda no corre contra producción |

Las tres pasadas se corrieron entre las 15:12Z y las 15:14Z. Salidas:
`salida-sonda-staging.txt`, `salida-sonda-dev.txt` y `salida-sonda-dev-ciego-sin-siembra.txt`, en
`docs/master/evidencias/SCRUM-1448/`.

### Cómo mide

- Una consulta (`id, number, type, total::text, lines::text, currency, vf_estado, merchantId`) dentro de una
  transacción `READ ONLY`. Antes de medir, la base lo confirma: `SHOW transaction_read_only` = `on`, y un
  `UPDATE … WHERE false` sale RECHAZADO. Calcado de `SCRUM-1314c/contar-huellas-sin-anular.mjs`. Se niega a
  correr si el host es el de producción.
- Cada fila pasa por el `generateInvoicePdf` REAL de `dist/`, con los parámetros que deciden el total tal como
  los pasan sus tres llamadores (`lib/invoicing.ts` ×2 e `invoicesAdmin.routes.ts`): `total: inv.total.toString()`,
  las `lines` crudas de la columna, `type` y `currency`. El total se lee del papel con `tests/_texto-del-pdf.mjs`:
  `TOTAL:`, `TOTAL COBRADO:` (JUST) o `Total:` (sin líneas). Si encuentra cero o más de uno, la fila sale CIEGA.
- Las PDF van a una carpeta temporal del sistema (se cambia de directorio ANTES de cargar `dist/`).
- No lee nombres ni datos de clientes: el emisor y el cliente del PDF son un literal de QA.

### Controles

| control | cómo | resultado |
| --- | --- | --- |
| positivo SEMBRADO | la MISMA consulta sobre un `VALUES` fabricado (el banco desechable), por el MISMO camino: una JUST con 100,00 guardado y una línea de 100 al 21 % | DISCREPA: imprime 121,00 (`TOTAL COBRADO`). En las dos bases |
| quitar el positivo | `--quitar-sembrado` | **CIEGO, salida 2**, con la población real intacta (12 de 12). No sale verde |
| la F1 con las mismas líneas | la misma fila sembrada, como F1 | coincide: desde 624e (#2863) la F1 imprime el guardado |
| una JUST limpia | 121,00 guardado, la misma línea | coincide |
| población | filas leídas = `count(*)` de la tabla, y 0 ciegas | 9 = 9 · 12 = 12 |
| la rama F1 quitada (mutación en `dist/`) | `leeElRegistro = false` | la siembra F1 discrepa → CIEGO, salida 2 |

### Qué dice, y qué no

- **En la F1 la comparación no puede salir distinta hoy:** imprime `params.total`, que ES el guardado
  (`pdf.service.ts`, la rama `leeElRegistro`). El 0 de 12 de dev lo confirma, pero no informa: es la construcción
  de 624e. Si alguien le quita esa rama, la sonda lo ve. **Medido:** con `const leeElRegistro = false;` en
  `dist/` (nunca en `src/`), la siembra F1 imprime 121,00 sobre 100,00, el veredicto sale CIEGO con salida 2, y
  `dist/` se restauró (el `grep` de la línea original vuelve a dar 1). Salida:
  `salida-sonda-dev-con-dist-mutado-f1-recalcula.txt`. Dato de paso de esa misma pasada: aun recalculando, las 12
  F1 de dev imprimen su guardado.
- **Donde sí informa es en JUST y R1**, que siguen recalculando de las líneas (c.20916). Staging tiene 9 JUST, y
  las 9 imprimen su guardado: sus líneas suman exactamente el total. No hay ninguna R1 en ninguna de las dos bases.
- **Dev ha cambiado en una hora:** c.21016 contó 5 filas a las ~13:03Z; hoy a las 15:14Z son 12, todas F1. Es una
  base viva: la cifra lleva su hora.
- **No he tomado el turno de staging** (SCRUM-188): el turno es para las tandas que escriben y se toma escribiendo
  en el marcador de la base, y esta sonda no escribe. Si había una tanda corriendo, sus filas de prueba habrían
  entrado en la población; las 9 que leí son las 9 JUST que c.21016 contó a las ~13:03Z.
- **SCRUM-1566d (C, el empate) no está en `main`** (`git log origin/main --grep=SCRUM-1566d` vacío): esta es la
  medición de ANTES de C, como pedía c.21038. Después de C se corre la misma orden.

### Lo que no he medido

- **Producción.** Sus 2 filas son JUST (216 y 217, c.21013), justo el tipo que recalcula: son las únicas de las
  tres bases donde el PDF puede imprimir hoy otro total. La consulta para pegar en Railway va en el comentario de
  Jira de este tramo. Es una COPIA de la aritmética de la rama que recalcula, no el PDF.
- La suite entera, en local: NO CORRIDA. Este tramo sólo añade documentos.

### Errores míos

- La primera orden de la sesión encadenó `git rev-parse --short origin/main HEAD` (salió 128) con el volcado de
  las normas a una carpeta que aún no existía. Lo vi en la salida y lo repetí por separado. No dejó ningún dato malo.
