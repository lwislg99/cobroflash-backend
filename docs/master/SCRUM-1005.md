# SCRUM-1005 · CLIENTES · Pestaña «Documentos adjuntos» en la ficha del cliente

## SCRUM-1005a · J2 · diseño del ALTER, propuesta de tope y plan del PR (sin construir)

**Medido contra:** `origin/main` = `e37a7051f87b195ceeae4852c56a02bc0d218438` · 2026-11-18T23:48:22Z (hora de GitHub; sesión J2 `jv-j2d3`, por encargo del orquestador `cobroflash-backend-8a`)

A9: aviso → cicatriz J2 «otra vez tomé de control positivo del ls-remote la rama de un PR ya mergeado (`scrum-1768*`, la punta de main): el merge la había borrado y el control dio 0; lo vi al leer la salida y lo rehíce con una rama viva» — no se pudo comprobar: el control del PASO 0 se teclea a mano en la consola, y ningún guard del repositorio lo lee

**Qué es.** La decisión está tomada: D5 de CRM, «SÍ (documentos adjuntos; el tope de tamaño lo fija J4/Javier)» (SCRUM-1012 c.16226), reetiquetada a J2 con `esperando-alter` (SCRUM-1005 c.17173). Este tramo es sólo DISEÑO: ni `prisma/schema.prisma`, ni `src/`, ni `public/`, ni ninguna base. Lo que queda: las preguntas ✅/❌ del final.

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
| `tests/scrum1005-documentos-cliente.test.mjs` | test del ticket | ROJO primero contra main. Casos: tenancy (el comercio B recibe 404 con el id de A), tope por fichero y por cliente con bordes derivados de la constante, formato rechazado (`image/svg+xml`, `text/html`), idempotencia, borrar el cliente se lleva sus documentos, la descarga con `nosniff`. Mutaciones al catálogo (`MUTACIONES_QUE_ME_TUMBAN`): quitar `merchantId` del `where` y quitar el borrado de `deleteCustomer` |
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
