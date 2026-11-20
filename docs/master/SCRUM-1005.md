# SCRUM-1005 · CLIENTES · Pestaña «Documentos adjuntos» en la ficha del cliente

## SCRUM-1005a · J2 · diseño del ALTER, propuesta de tope y plan del PR (sin construir)

**Medido contra:** `origin/main` = `e37a7051f87b195ceeae4852c56a02bc0d218438` · 2026-11-18T23:48:22Z (hora de GitHub; sesión J2 `jv-j2d3`, por encargo del orquestador `cobroflash-backend-8a`)

A9: aviso → cicatriz J2 «otra vez tomé de control positivo del ls-remote la rama de un PR ya mergeado (`scrum-1768*`, la punta de main): el merge la había borrado y el control dio 0; lo vi al leer la salida y lo rehíce con una rama viva» — no se pudo comprobar: el control del PASO 0 se teclea a mano en la consola, y ningún guard del repositorio lo lee

**Qué es.** La decisión está tomada: D5 de CRM, «SÍ (documentos adjuntos; el tope de tamaño lo fija J4/Javier)» (SCRUM-1012 c.16226), reetiquetada a J2 con `esperando-alter` (SCRUM-1005 c.17173). Este tramo es sólo DISEÑO: ni `prisma/schema.prisma`, ni `src/`, ni `public/`, ni ninguna base. Lo que queda: las preguntas ✅/❌ del final.

**Tanda:** suite entera no corrida: cambio solo de documentos; CI la corre. Guards de docs y esquema en local: 1294, 267, 273, 525d, 854, 222, 475, 1310b → 0 fallos (222: 2 casos saltados por gate). Decisión del orquestador `cobroflash-backend-8a`, por mensaje, el 18-nov.

**PASO 0** (18-nov, 23:45Z): `git log origin/main --grep=SCRUM-1005` → 0 commits · `git ls-remote origin 'refs/heads/scrum-1005*'` → 0 ramas (control positivo con una rama viva, `scrum-paso0-dinero`: 1) · `gh pr list --search 1005` → sólo #1005, que es SCRUM-668 · `docs/master/SCRUM-1005.md` no existía.

### 1 · El cambio de esquema: menos del que dice el ticket

**Medido en las dos bases** (DEV `yaqu_dev_javier` y STAGING `railway`, mismas 9 columnas, `information_schema.columns`): `entity_type`, `kind` y `mime` son **TEXT libres**, sin enum ni CHECK. Así que:

| lo que pide el ticket | ¿hace falta ALTER? | dónde vive la regla |
|---|---|---|
| `entityType` admite `customer` | **NO** | código (lista de valores de la ruta) |
| `kind` admite `document` | **NO** en la base · sí en el máster (abajo) | código |
| `mime` acepta `application/pdf` | **NO** | código (lista de formatos de la ruta) |
| nombre del fichero | **SÍ** → `file_name TEXT NULL` | — |
| tope por cliente sin leer los bytes | **SÍ** → `size_bytes INTEGER NULL` | — |
| subida idempotente sin leer los bytes | **SÍ** → `sha256 TEXT NULL` | — |
| `customer_id` con clave ajena | **NO, a propósito** | ver abajo |

El ticket dice «`entityType` = `quote_request | job`», copiado del comentario del esquema. Lo que se escribe de verdad es `quote_request` (`attachment.service.ts:21`) y `albaran` (`albaranes.routes.ts:1188`); `job` no lo escribe nadie. La etiqueta `esperando-alter` es cierta sólo por las tres columnas de arriba, no por los valores nuevos.

**Sin clave ajena a `customers`:** la tabla es polimórfica (`entity_type` + `entity_id`) y así se queda. Una FK con `ON DELETE CASCADE` borraría los documentos en la FUSIÓN de clientes en vez de moverlos al principal (`fusionClientes.ts`, SCRUM-1057). El borrado va en el código, en la misma transacción, y lo ata un test (§3).

**El máster:** `kind` NO lo cierran las Partes L, P, N5 ni K1. Lo describe la ficha de MEDIA-1 (`docs/YAQU_MASTER.md:660`: «`kind:'photo'|'audio'`»). Añadir `document` es poco, pero esa línea queda mal si no se cambia. Es la pregunta 7.

**DDL** en `docs/sql/scrum-1005-adjuntos-cliente.sql`, marcado PROPUESTO. Lo sacó el preview de la casa en modo offline: `previewMigracion({ schema, desde })` de `scripts/preview-migracion.mjs`, el mismo mecanismo que `scrum-1072-activity-kind.sql`. `desde` es una copia de `prisma/schema.prisma` (sha256 `89009aafa914817f…`, igual a origin/main), y `schema` es esa copia con 3 líneas en `model Attachment`:

    fileName   String?  @map("file_name")
    sizeBytes  Int?     @map("size_bytes")
    sha256     String?

Resultado: control positivo ok · 1 sentencia `ALTER TABLE "attachments" ADD COLUMN …` ×3 · `sentenciasDestructivas` = **0** · control negativo (actual → actual) = `sin_cambios`. La lista blanca de `_aplicar-sql-dev.mjs` (`revisar`) la da por buena (1 sentencia, forma «ALTER TABLE … ADD COLUMN»). Su control negativo, un `DROP COLUMN`: `ok: false`.

### 2 · El tope, con lo que se pudo medir

Medido de **SOLO LECTURA** (`SET TRANSACTION READ ONLY`, y la base confirmó `transaction_read_only = on`), con las claves `DATABASE_URL_DEV` y `_STAGING` de este árbol. Antes, `comprobar-claves-bd.mjs` situó cada clave: DEV → `yaqu_dev_javier` (DESARROLLO) y STAGING → `railway` (STAGING). Producción NO se midió, y no se puede: está prohibido.

| base | `pg_total_relation_size('attachments')` | filas | bytes de datos | base entera | control (`customers`) |
|---|---|---|---|---|---|
| DEV | 49.152 B (48 kB) | 1 (`quote_request`/`photo`/`image/png`) | 70 B | 11.859.647 B | 29 filas |
| STAGING | 65.536 B (64 kB) | **0** | — | 12.711.615 B | 10 filas |

🔴 **Lo que NO se pudo medir:** el tamaño medio de los adjuntos de hoy. En ninguna de las dos bases hay un solo adjunto real (el de DEV es un fixture de 70 B). La única cifra de tamaño real de la casa es de **fotos**, no de PDF: SCRUM-1060 midió las fotos de gasto ya redimensionadas en el móvil, con una mediana de 0,443 MiB y un máximo de 0,94 MiB (`docs/master/SCRUM-1060.md`). El precedente de tope es el del albarán: **5 MB por foto y 10 por albarán** (`albaranes.routes.ts:588-590`), con un parser JSON de 8 MB por el base64 (`app.ts:181`).

**Motivo del tope:**
- **bytea en Postgres:** cada MB subido es un MB de base y de respaldo, sin R2 (MEDIA-1, máster:662).
- **RGPD:** un contrato o un boletín lleva datos personales del cliente final; el comercio es el responsable. Tres puntos:
  - **Supresión:** hoy `deleteCustomer` (`customerAdmin.ts`) borra el cliente y **NO toca `attachments`**: es lo medido en el código. Con documentos, borrar un cliente dejaría huérfanos sus PDF con sus datos. El PR ③ los borra en la misma transacción.
  - **Conservación:** `docs/legal/PREGUNTAS_ASESOR.md` §E cita el art. 30 CCom (6 años para la «documentación y justificantes concernientes a su negocio»), el art. 17.3.b RGPD y el bloqueo del art. 32 LOPDGDD. Esa sección trata la baja del PROFESIONAL y la lista de SCRUM-244 (RGPD-1). Si un contrato de mantenimiento del cliente entra en ese art. 30, **NO lo afirmo**: es para J4 o el asesor (pregunta 4).
  - **Minimización:** la descripción del ticket pone «DNI del titular» como ejemplo. Ningún texto de la pestaña debería invitar a subir un DNI (art. 5.1.c RGPD; lo revisa J4).

### 3 · Plan de archivos del PR ③ (no se escribe ninguno aquí)

Carril medido con `node scripts/carriles.mjs de` (18-nov):

| fichero | carril | qué |
|---|---|---|
| `prisma/schema.prisma` | sin fila | las 3 líneas de §1 y el comentario de `entityType`/`kind` corregido. Sólo después del ALTER en las tres bases |
| `src/modules/system/app/routes/customersAdmin.routes.ts` | **J2** | `GET /:id/documentos` (lista sin bytes) · `POST /:id/documentos` · `GET /:id/documentos/:docId` (descarga) · `DELETE /:id/documentos/:docId`. Todas bajo `mountAdmin` (`requireAuth`), y el `where` lleva `merchantId` y `entityType: 'customer'` (regla 2) |
| `src/modules/system/customerAdmin.ts` | **J2** | la lógica (tope, idempotencia por `sha256`), y `deleteCustomer` borra los documentos en su transacción. Va aquí y NO en un `domain/` nuevo, porque `src/modules/system/domain/documentosCliente.ts` (`--nueva`) sale **S1** |
| `public/dashboard/js/customerDetailView.js` | **J2** | la pestaña, con el mismo patrón que «Trabajos» y «WhatsApp» (`tituloPestana`) |
| `src/modules/system/domain/fusionClientes.ts` | **S1** ⚠️ | la fusión tiene que MOVER los documentos del fusionado al principal. Es de otro carril: se avisa a S1 o se abre ticket `equipo-luis` |
| `src/modules/quoteRequests/app/routes/attachments.routes.ts` | **S1** | **no se toca.** Sirve con `Content-Type` = `mime` y sin `Content-Disposition`; para documentos, la descarga propia de J2 lleva `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` y el nombre saneado |
| `src/app.ts` | **S1** (contenedor) | **no se toca:** el parser global es `express.json` 2 MB y no lee `application/pdf`. La subida va como cuerpo binario con `express.raw({ type: <lista de formatos>, limit })` en la propia ruta. Un test con un fichero mayor de 2 MB lo demuestra |
| (el test del ticket, aún sin escribir: se nombrará con su ruta al traerlo, no antes) | test del ticket | ROJO primero contra main. Casos: tenancy (el comercio B recibe 404 con el id de A), tope por fichero y por cliente con bordes derivados de la constante, formato rechazado (`image/svg+xml`, `text/html`), idempotencia, borrar el cliente se lleva sus documentos, la descarga con `nosniff`. Mutaciones al catálogo (`MUTACIONES_QUE_ME_TUMBAN`): quitar `merchantId` del `where` y quitar el borrado de `deleteCustomer` |
| `docs/microcopy/` | — | la ficha de los textos firmados |

**Textos que harán falta, todos con firma del fundador (regla 39); no se redactan aquí:**
1. el nombre de la pestaña (con el contador, como las otras);
2. el botón de subir;
3. el estado vacío;
4. «subiendo» y «subido»;
5. el error de formato;
6. el error de tamaño por fichero;
7. el error de tope por cliente (número y MB);
8. el enlace de ver/descargar;
9. la confirmación de borrar un documento;
10. la línea nueva en la confirmación de BORRAR UN CLIENTE: que se lleva sus documentos;
11. las etiquetas `aria-label`.

### 4 · Preguntas ✅/❌ al fundador (con mi recomendación)

1. **Tope por fichero: 5 MB.** ✅ recomiendo, porque es el mismo número que la foto del albarán: un solo tope en el producto. ❌ = 10 MB, para PDF escaneados de varias páginas. No está medido cuánto pesa un PDF real de un oficio.
2. **Tope por cliente: 20 documentos y 50 MB.** ✅ recomiendo.
3. **¿Solo PDF?** Recomiendo **PDF + JPEG + PNG + WebP**: los formatos de la foto del albarán más el PDF, porque el boletín llega muchas veces como foto. Nunca SVG, HTML ni Office: un SVG servido desde el propio dominio puede ejecutar código. ✅/❌
4. **¿Se borran con el cliente?** ✅ recomiendo SÍ, en la misma transacción del borrado duro. Y en la fusión se MUEVEN al principal. La duda de conservación del art. 30 CCom sobre documentos del cliente final va a J4 o al asesor antes de construir, no después.
5. **¿Tope por comercio?** No lo pide el ticket, pero con bytea es lo que protege la base. Propongo 500 MB por comercio. 🔴 Es una cifra SIN medir de coste: decisión de coste, del fundador. ✅/❌
6. **¿Aplicas el ALTER de `docs/sql/scrum-1005-adjuntos-cliente.sql` en las tres bases?** Son 3 columnas anulables, 0 destructivas. ✅/❌
7. **Cambio de máster:** que la línea de MEDIA-1 (`docs/YAQU_MASTER.md:660`) diga `kind:'photo'|'audio'|'document'` y añada `entityType 'customer'`. ✅/❌

## SCRUM-1005b · J2 · ②-dev + esquema + servidor + tests (sin pestaña)

**Medido contra:** `origin/main` = `6cabd3d42c1e0c7ba531a91ab94471c17c288949` · 2026-11-19T18:02:48Z (hora de GitHub; sesión J2 `jv-j2d9`, por encargo del orquestador `cobroflash-backend-c7`). A las 18:13:53Z main iba 9 commits por delante, y ninguno toca los ficheros de este tramo (`git diff --stat HEAD origin/main` sobre ellos: vacío).

A9: comprobación → `tests/scrum525d-anclas-que-apuntan.test.mjs`
(Las 3 líneas nuevas de `prisma/schema.prisma` corrieron 3 líneas un ancla de `docs/legal/AUDITORIA_CAMINO_EMISION.md` sobre `model VfSubmission`; ese guard la cazó y se corrigió en sitio, caso ①: sólo se movió. Las coordenadas del esquema SIN testigo que caigan por debajo de `model Attachment` también se han movido 3 líneas y ningún guard lo ve: no las he barrido.)

Mutaciones: catálogo → `tests/scrum1005b-documentos-cliente.test.mjs`

**Qué es.** La parte ③ del orden A5 SIN la pestaña: las decisiones son de SCRUM-1005 c.22140 (10 MB por fichero, 100 MB por cliente, `application/pdf`/`image/jpeg`/`image/png`, borrado con el cliente) y el ② de staging y producción, de c.22170. La pestaña y sus textos van en 1005c, después de la firma (regla 39).

**PASO 0** (18:02Z): `git ls-remote` de `scrum-0*1005*` → 0 ramas; `git log origin/main --grep=SCRUM-1005` → sólo los 4 commits de 1005a (#3245, mergeado); `gh pr list --search 1005` → #1005 (es SCRUM-668) y #3245. `node_modules` PROPIO (`npm run topologia`: «directorio propio»).

### ②-dev · el ALTER en la base de desarrollo

`node scripts/aplicar-sql-dev.mjs --file docs/sql/scrum-1005-adjuntos-cliente.sql`: primero sin `--go` (destino `yaqu_dev_javier` DESARROLLO ✅; 1 sentencia, forma `ALTER TABLE … ADD COLUMN`, de la lista blanca), después con `--go`. Sonda de SOLO LECTURA (`transaction_read_only = on`), dos controles de tipo distinto (A5) y positivo sembrado con dos columnas que ya existían (`entity_type`, `mime`):

| | `current_database()` | `information_schema.columns` (las 3) | `pg_attribute` (las 3) | columnas de `attachments` |
|---|---|---|---|---|
| antes | `yaqu_dev_javier` | 0 filas | 0 filas | 9 |
| después | `yaqu_dev_javier` | 3 filas: `file_name text YES` · `sha256 text YES` · `size_bytes integer YES` | 3 filas, las tres anulables | 12 |

Evidencias, sin secretos: `docs/master/evidencias/SCRUM-1005/1005b-dev-antes.txt` y `docs/master/evidencias/SCRUM-1005/1005b-dev-despues.txt`.

### El plan de §3, fila a fila

| fichero | hecho |
|---|---|
| `prisma/schema.prisma` | ✅ las 3 líneas opcionales de §1 y el comentario de `entityType`/`kind`/`mime`; nada más. Cliente regenerado desde ESTE árbol (`node node_modules/prisma/build/index.js generate`: «Generated Prisma Client (v6.18.0) to .\node_modules\@prisma\client») y `_prisma-client-guard.mjs` → ✔. El cliente del checkout compartido no lleva `sizeBytes` (0 apariciones): no se tocó |
| `src/modules/system/app/routes/customersAdmin.routes.ts` | ✅ `GET /:id/documentos` (lista sin bytes) · `POST /:id/documentos` (cuerpo binario con `express.raw`, tope = `DOC_MAX_BYTES`) · `GET /:id/documentos/:docId` (`Content-Disposition: attachment` con nombre saneado en ASCII y `filename*` UTF-8, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`) · `DELETE /:id/documentos/:docId`. Bajo `mountAdmin`, como todo el router |
| `src/modules/system/customerAdmin.ts` | ✅ constantes exportadas (`DOC_MAX_BYTES`, `DOCS_MAX_BYTES_POR_CLIENTE`, `DOC_MIME_ADMITIDOS`), `whereDocumentosDe` (con `merchantId`, `entityType: 'customer'`, `kind: 'document'`), firma de los primeros bytes de cada formato (un HTML que dice ser PDF da 415), idempotencia por `sha256` dentro del mismo cliente, tope por cliente con `aggregate._sum.sizeBytes` (sin leer bytea) bajo `pg_advisory_xact_lock` por cliente (espacio 1753; los de la casa van de 1748 a 1752). `deleteCustomer` llama a `borrarClienteYSusDocumentos`: borra TODOS los adjuntos `entityType: 'customer'` del cliente en la misma transacción, y sólo si el cliente se borró |
| `docs/sql/deriva-prod.sql` | ✅ regenerado con `node scripts/generar-sql-deriva.mjs` (536 → 539 columnas), consecuencia mecánica del esquema que pide `tests/scrum222-deriva-arranque.test.mjs` |
| `docs/legal/AUDITORIA_CAMINO_EMISION.md` | ✅ una coordenada movida 3 líneas (ver A9), corregida en sitio |
| `public/dashboard/js/customerDetailView.js` | ❌ NO: es 1005c, después de la firma de los textos |
| `src/modules/system/domain/fusionClientes.ts` | ❌ NO: es S1. Aviso a Luis en el comentario de Jira |
| `src/modules/quoteRequests/app/routes/attachments.routes.ts`, `src/app.ts` | ❌ NO se tocan (S1). Ver «Lo que queda» |

**Códigos que contesta el servidor** (ninguna frase): `FORMATO_NO_ADMITIDO` (415) · `FICHERO_DEMASIADO_GRANDE` (413) · `TOPE_DEL_CLIENTE` (409) · `FICHERO_VACIO` (400) · `NOMBRE_NO_VALIDO` (400) · `CUERPO_ILEGIBLE` (400) · y los de la casa `invalid_id`, `not_found`, `internal_error`. El nombre del fichero llega en la cabecera `X-Nombre-Fichero`, con `encodeURIComponent`.

### Tests

`tests/scrum1005b-documentos-cliente.test.mjs`, ruta REAL de `dist/` con la base doblada (`_envio-doblado.mjs`), 14 casos:
- **Rojo primero**, contra el `dist/` compilado del `src/` de main: 12 de 14 caen. Los 2 que pasan en main son los de «el comercio B recibe 404» y «borrar un cliente ajeno no toca sus documentos»: en main pasan porque la ruta no existe; el control del banco (caso 1, que cae en main) es lo que impide leerlos como verdes vacíos.
- **Verde:** 14 de 14.
- Bordes derivados de las constantes: `DOC_MAX_BYTES` entra y `+1` no; el cliente lleno hasta `DOCS_MAX_BYTES_POR_CLIENTE` admite justo lo que falta y no un byte más; 2 MB + 1 entra (el parser global de 2 MB no lo lee).

**Mutaciones** (las dos del encargo, en `MUTACIONES_QUE_ME_TUMBAN`), rojo visto con un driver propio de una vez (aplicar → compilar → correr el test → restaurar; árbol igual después: mismo `git diff --stat`), NO con `aplicarUna` del meta-guard:
- quitar `merchantId` de `whereDocumentosDe` → caen 4 de 14, entre ellos «una fila de OTRO comercio que casa por número no se ve…»;
- quitar el borrado de adjuntos de `borrarClienteYSusDocumentos` → cae 1 de 14: «borrar el cliente se lleva sus documentos, y sólo los suyos».

**Tanda dirigida** (26 ficheros: el mío, los de clientes 576, 580, 1014, 1057, 1138, 1291, 1403, 1456, 1571, 1571b, 1571c, y los guards 222, 267, 273, 391, 475-schema-vs-sql, 525d, 700, 710b, 836, 854, 1294, 1310b, 1328, 1387): 287 tests, primera pasada 277 pass · 3 fail · 7 skipped (gate). Los 3 rojos eran míos y están arreglados arriba: 222 (deriva), 525d (ancla), 854 (faltaba este tramo). `tsc -p .` CON tipos: salida 0. `censo:mudez -- --escribir` (719): sin fichas nuevas, `_guard-texto.mjs` idéntico. La suite entera, ver la entrega.

### Lo que queda (no es de este tramo)

1. **Los 11 textos de §3** para la firma del fundador, sin redactar: van como lista en el comentario de Jira de esta entrega; la pestaña (1005c) espera a esa firma.
2. **Aviso a Luis (S1), fusión:** `fusionClientes.ts` no mueve los adjuntos `entityType: 'customer'` del fusionado al principal; al borrarse el fusionado, hoy se quedarían colgando de un id que ya no existe.
3. **Aviso a Luis (S1), `GET /admin/attachments/:id`:** sirve CUALQUIER adjunto del comercio por id, con su `mime` y sin `Content-Disposition` ni `nosniff`. Un documento del cliente también sale por ahí, en línea. Los formatos admitidos son sólo PDF/JPEG/PNG con su firma comprobada, así que no hay SVG ni HTML que ejecutar, pero la puerta de la descarga como adjunto se puede rodear.
4. **Pregunta al fundador:** las 4 rutas van sin `requireRole`, al nivel de la agenda de sitios (el operario en la obra es quien necesita el boletín). Si el técnico NO debe ver o borrar documentos del cliente, es una línea por ruta.
5. **Pregunta 7 de 1005a** (la línea de MEDIA-1 del máster con `kind 'document'` y `entityType 'customer'`): sigue sin contestar; el código no la necesita, porque `kind` no es un estado cerrado.

### SCRUM-1005b · relevo J2 (`jv-j2dd`): los guards de declaración y el `requireRole` del borrado

**Medido contra:** `origin/main` = `b0b7cf9970e7b4202f547a11e1d09add4ffca971` · 2026-11-20T07:03:43Z (hora de GitHub; sesión J2 `jv-j2dd`, por encargo del orquestador `cobroflash-backend-c7`). Rama `scrum-1005b-documentos-cliente-servidor` @ `87c1a2a26` + `git merge origin/main` (0 conflictos).

A9: comprobación → `tests/scrum1005b-documentos-cliente.test.mjs`

Mutaciones: catálogo → `tests/scrum1005b-documentos-cliente.test.mjs`

**Por qué:** #3262 cayó en el obligatorio (run 44587006217, c.22201) con 8 fallos, todos guards que piden DECLARAR o CONECTAR piezas nuevas. c.22201 nombraba cinco guards; el octavo fallo, que no nombraba, es `tests/scrum55-admin-fail-closed.test.mjs` (las 4 rutas sin rol declarado). Rojo visto en local en los seis antes de tocar nada (7 casos en 1185/243/337/365/497 + 1 en 55); después, 73/73 con el test de 1005b. Ningún guard relajado (regla 41): cada uno, declarado donde él lo pide o arreglado en el código.

| guard | qué pedía | dónde quedó |
|---|---|---|
| `scrum1185` | `GET` y `POST /admin/customers/:id/documentos`, sin consumir | `scripts/_sin-consumir-declarados.json`, carril J2, ticket SCRUM-1005, motivo «la consume la pestaña de SCRUM-1005c»; se mueven a `retiradas` en ese PR |
| `scrum497` (casos SCRUM-1547) | `attachment.fileName` personal sin clasificar; `attachment.sha256` texto sin declarar | `fileName` → `SIN_DECIDIR` de `tests/scrum497-dato-personal-no-sobrevive.test.mjs` con su pregunta (¿se redacta en la baja del profesional o se va la fila entera?, decide el fundador); el trinquete sube de 91 a 92, con la cadena de su mensaje ampliada. `sha256` → `NO_PERSONALES` de `tests/_censo-datos-personales.mjs` (huella de los bytes, no se invierte a una persona) |
| `scrum243` | 2 lecturas «sin red» en `customerAdmin.ts` (`findFirst` y `aggregate` de `subirDocumento`) | **arreglado en el código, no en el censo:** el `where` con el comercio se construía FUERA del callback de `$transaction`, y el analizador mira la función que lee. Ahora se construye dentro. Mismo filtro; 2 → 0 |
| `scrum337` | 2 sitios de borrado nuevos (`attachment.deleteMany#1` en `borrarDocumento`, `#2` en `deleteCustomer`) | `BORRADOS_DECLARADOS`, con la pregunta del guard contestada: ninguno se dispara al vencer la prueba ni por inactividad (acción manual de un admin); `trialExpired` sigue siendo cierto |
| `scrum365` | escrituras abiertas (`POST` y `DELETE` de documentos) con lectura protegida en el fichero | `DELETE /:id/documentos/:docId` lleva `requireRole('admin')` (c.22192); `GET`, `POST` y `GET /:docId` declarados en `TECNICO_ALLOWED` de `src/core/http/adminRouteDeclarations.ts` con la cita de c.22192 |
| `scrum55` | las 4 rutas sin rol declarado (fail-closed) | lo mismo que 365: 1 con `requireRole`, 3 en `TECNICO_ALLOWED` |

⚠️ **Carril:** `src/core/http/adminRouteDeclarations.ts` es S1 (`carriles.mjs`). Escribí en él las tres líneas de permisos que exige el guard de S1 para MIS rutas, con la decisión del fundador citada (c.22192); no toqué nada más del fichero. Se dice en el commit y en la entrega.

**Test:** `tests/scrum1005b-documentos-cliente.test.mjs` suma el caso «el técnico ve y sube, pero NO borra»: por la ruta real, el técnico recibe 200 en la lista, 201 al subir y 403 al borrar, el documento sigue; el admin, 204 (positivo del mismo camino). 15/15. Mutación nueva al catálogo: quitar `requireRole('admin')` del DELETE. Las tres del catálogo, pasadas con `aplicarUna` de `scripts/meta-guard-mutaciones.mjs` (línea base limpia de la casa): las tres VIVAS (tumban el test); `git status` después, sólo mis cambios.

## SCRUM-1005d · J2 · la pestaña «Documentos» de la ficha del cliente (relevo jv-j2df → jv-j2dh)

**Medido contra:** `origin/main` = `dff849bc78e0a8c1f1e32e5e18e2e17296c63ae5` · 2026-11-20T16:32:15Z (hora de GitHub; sesión J2 `jv-j2dh`, por encargo del orquestador `cobroflash-backend-c7`). Parte del commit local de `jv-j2df` `aedd87f21887bcfd7d6da59998f5857bbccc339e` (padre `0142551fb`), traído con `git merge` y no con `--ff-only`: main había avanzado #3275 (solo docs de SCRUM-1771, 8 ficheros, ninguno de este tramo).

A9: comprobación → `tests/scrum757-la-declaracion-que-nadie-lee.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, antes de tocar `customerDetailView.js`)

Mutaciones: catálogo → `tests/scrum1005d-pestana-documentos.test.mjs`

Mutaciones: catálogo → `tests/scrum1005b-documentos-cliente.test.mjs`

**Literales:** los 14 de SCRUM-1005 c.22192, byte a byte (comparados por punto de código con `docs/master/evidencias/SCRUM-1005/1005c-textos-propuestos.md`, la columna A que cita c.22192: `🗑` es U+1F5D1 sin selector de variante y `…` es U+2026, igual en la vista, la ficha y el test). Ficha: `docs/microcopy/2026-11-20-SCRUM-1005-documentos-del-cliente.md`. La fila 10 está firmada y NO se aplica (no existe diálogo de borrar cliente): en la ficha va como nota, no como cita. La fila 13 es «sin texto». `CUERPO_ILEGIBLE` → el genérico del panel. `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` no se toca: está congelado desde SCRUM-709. Ningún literal faltó ni se inventó.

**Permisos (c.22192):** ver y subir, todo el equipo; borrar, solo admin (botón y confirmación solo si `appUserRole === 'admin'`; el `DELETE` ya lleva `requireRole('admin')` desde 1005b).

**Lo que hizo jv-j2df (commit aedd87f):** la pestaña en `public/dashboard/js/customerDetailView.js` (bloque marcado `SCRUM-1005d · INICIO/FIN`, sin `style=` ni `on*=` en cadenas, clases de «Sitios»), `limites` en bytes en `GET /admin/customers/:id/documentos` (`customersAdmin.routes.ts`) para que `{mb}` salga de las constantes, la ficha de microcopy y los tests (`tests/scrum1005d-pestana-documentos.test.mjs` nuevo; `tests/scrum1005b-documentos-cliente.test.mjs` con el caso de `limites`, visto en rojo antes).

**Lo que hice yo (jv-j2dh):**

1. **Dos declaraciones de mutación de j2df estaban CIEGAS.** Las cuatro decían `fichero: VISTA` (un identificador): el lector estático de la casa (`lecturaDeDeclaraciones`) las dejaba en `incompletas`, y `scrum757` caía nombrando a `scrum1005d` (rojo visto en local reintroduciendo el identificador). Ahora es la ruta literal. Además, el `cae` de la del literal («los 14 textos son los de c.22192») no era subcadena de ningún nombre de test, y el ancla del `confirm` tenía 8 espacios donde el código tiene 4: `aplicarUna` la dio CIEGA («el ancla no está… caducó»). Las dos, corregidas.
2. **Mutación nueva** en el catálogo de 1005b: «`limites` desaparece del GET» (`return res.json({ documentos });`).
3. **Las 8 mutaciones** (4 de 1005d + 4 de 1005b), con `correr` + `aplicarUna` de `scripts/meta-guard-mutaciones.mjs` sobre la línea base limpia (25 y 16 pasados, 0 caídos, 0 saltados): las 8 `ok:true` (tumban su test). `git status` después: `src/` y `public/` sin diff.
4. **`scrum1185`:** rojo visto (11 casos, 2 caen). ② GET y POST de documentos ya tienen consumidor → a `retiradas` de `scripts/_sin-consumir-declarados.json` con su motivo. ① traía 4 piezas ciegas nuevas: 3 `ciega-llamada-opaca` porque la pestaña llamaba con la ruta en una variable → **arreglado en el código** (la ruta escrita en cada `apiRequest`; `base` queda solo para el enlace de descarga, con su comentario). La cuarta, `ciega-lector-cuerpo · POST /admin/customers/:id/documentos`, es un límite de la sonda (el cuerpo es el fichero en binario y el nombre va en `X-Nombre-Fichero`): declarada en `declaradas`, carril J2, SCRUM-1005, como las de «Sitios». Después, 11/11.
5. **`scrum700`** (92 > 91 ficheros con filtro de comentarios propio): el test nuevo quitaba el origen de la URL con `/^https?:\/\/[^/]+/`, que el censo cuenta como filtro. No es un filtro de comentarios, así que `soloEjecutable` no aplica: se cambia por `new URL(…).pathname + search`. Vuelve a 91; el trinquete no se toca.
6. **Aviso ① de j2df (import de `medirTexto`):** se queda el import desde `tests/scrum1773-trinquete-style-en-innerhtml.test.mjs` con el recuento declarado: **25 casos en `scrum1005d` = 18 propios + 7 de 1773** que se ejecutan al importarlo. Extraer `medirTexto` a un módulo aparte obligaba a mover `RX_STYLE` y `NODOS_CADENA`, que son el `de:` de las mutaciones ① y ② del propio 1773: era tocar el guard de J3 más allá del import (el encargo dice PARA). 8 tests de la casa ya importan otro `.test.mjs`.

**Verde, con recuento:**

- `scrum1005d` 25/25 + `scrum1005b` 16/16 = 41/41 (`tsc -p .` con tipos: salida 0, sin `--noCheck`).
- Lote dirigido, 36 ficheros (1773, 836, 700, 710b, 719, 1294, 267, 273, 525d, 854, 391, 1185, 1387, 514, 1145, 1005d, 1005b y los 21 que nombran `customerDetailView`): 371 tests = 367 pass + 2 fail + 2 saltados; los 2 rojos eran `scrum700` (arreglado, punto 5) y `scrum854` ② (faltaba este tramo). Re-medido después: 700 + 1005d + 1005b + 1185 = 57/57.

**Lo que NO he medido:** yaqu.app (la pestaña no está desplegada: entra con el merge; la verifica CIERRES en staging, otra sesión); el obligatorio de CI de la punta; si el `🗑` de Jira lleva selector de variante (comparé con el fichero de evidencias que cita c.22192, no con los bytes del comentario).
