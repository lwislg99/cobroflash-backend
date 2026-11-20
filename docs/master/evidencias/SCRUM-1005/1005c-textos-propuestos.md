# SCRUM-1005c · Textos PROPUESTOS de la pestaña «Documentos» (sin firmar)

> jv-j2db (J2) · 19-nov-2026 · medido sobre origin/main `4958072c9d8ae3ff9f72d99444c370d8b493cb2e` y la rama de 1005b
> `scrum-1005b-documentos-cliente-servidor` @ `87c1a2a266a671991112a9b2379cfb9886dfa0e5` (aún no en main).
> **Nada de esto está aplicado.** Son propuestas para la firma del fundador (regla 39). Se aplican en 1005c, byte a
> byte, cuando haya firma; entonces se registran en `docs/microcopy/` con su línea de aprobación. Este fichero no es
> registro: el tramo de `docs/master/SCRUM-1005.md` lo escribe 1005c con la firma.

Las cifras NO van escritas en el literal: `{mb}` sale de la constante de 1005b
(`src/modules/system/customerAdmin.ts:466-467` en la rama de 1005b: `DOC_MAX_BYTES = 10 * 1024 * 1024`,
`DOCS_MAX_BYTES_POR_CLIENTE = 100 * 1024 * 1024`), dividida entre `1024 * 1024`. Hoy darían 10 y 100.
`{n}` es un contador; `{nombre}` es el `fileName` saneado que guarda el servidor.

| nº | dónde sale | código del servidor | **A (recomendado)** | B (alternativo) | de dónde sale su forma |
|---|---|---|---|---|---|
| 1 | título de la pestaña, con contador | — | `Documentos ({n})` | `Adjuntos ({n})` | A: misma forma que `Trabajos (n)` y `WhatsApp (n)`, `customerDetailView.js:16,24-25` y `:52,62-63`; nombre del ticket y de la decisión c.22140. B: «Documentos adjuntos» de Contasimple (descripción del ticket). Si la lista se pagina, `({n}+)` como WhatsApp. |
| 2 | botón de subir | — | `+ Subir documento` | `📎 Adjuntar documento` | A: `+ Nuevo sitio`, `customerDetailView.js:113` (firmado, SCRUM-1145 c.20592). B: el clip «Adjuntar archivos» de Contasimple (descripción del ticket); emoji delante como `🗑 Eliminar` (`:127`, firmado). |
| 3 | estado vacío | — | `Todavía no hay documentos guardados para este cliente.` | `Sin documentos` | A: `Todavía no hay sitios guardados para este cliente.`, `customerDetailView.js:112` (firmado, c.20592). B: `Sin trabajos` / `Sin mensajes de WhatsApp`, `:17` y `:53`. |
| 4 | subiendo · subido | — (201) | `Subiendo…` · `Documento guardado.` | `Subiendo {nombre}…` · `Guardado` | `Subiendo…`: `estadoFirma.js:58`. «Guardado»: el verbo de `Guardar`, `customerDetailView.js:128` (firmado). |
| 5 | error de formato | `FORMATO_NO_ADMITIDO` (415) | `Solo se pueden subir documentos PDF, JPG o PNG.` | `Ese tipo de fichero no se admite: sube un PDF, JPG o PNG.` | Tipos de c.22140. Forma «puede/pueden + límite»: `albaranDetailView.js:934` («Cada foto puede ocupar como máximo 5 MB.»). |
| 6 | error de tamaño por fichero | `FICHERO_DEMASIADO_GRANDE` (413) | `Cada documento puede ocupar como máximo {mb} MB.` | `Este documento pasa de {mb} MB.` | A: calco de `albaranDetailView.js:934`. `{mb}` ← `DOC_MAX_BYTES`. Se puede comprobar en el navegador ANTES de leer el fichero, como hace el albarán. |
| 7 | error de tope por cliente | `TOPE_DEL_CLIENTE` (409) | `Este cliente ya tiene {mb} MB en documentos, el máximo. Borra alguno para subir otro.` | `Este cliente ha llegado al máximo de {mb} MB en documentos.` | Tope de c.22140. `{mb}` ← `DOCS_MAX_BYTES_POR_CLIENTE`. ⚠️ La segunda frase de A solo vale si quien la lee puede borrar (ver el final). |
| 8 | enlace de cada documento | — (descarga) | `Descargar` | `Ver →` | A: el servidor de 1005b contesta `Content-Disposition: attachment`, así que el navegador DESCARGA, no abre; «Descargar» como el `title` de `customerDetailView.js:475`. B: `Ver →`, `:767` y `:801` — ⚠️ prometería abrirlo, y no se abre. |
| 9 | borrar un documento: botón + confirmación | — (204/200) | botón `🗑 Eliminar` · confirmación `¿Borrar el documento "{nombre}"? Esta acción no se puede deshacer.` | confirmación `¿Eliminar este documento?` | Botón: `customerDetailView.js:127` (firmado, c.20598). A: `templatesView.js:143`. B: `expensesView.js:477`. Los sitios se borran SIN confirmación (c.20592) porque se conserva lo que los usaba; un documento borrado no se recupera, por eso aquí sí. |
| 10 | línea nueva en la confirmación de borrar un cliente | — | `También se borrarán sus documentos.` | `Se borrarán también sus {n} documentos.` | Forma de la confirmación de fusión: `customerDetailView.js:229` («Esta acción no se puede deshacer. …»). 🔴 **Medido: hoy NINGUNA pantalla borra clientes** — `git grep` de `DELETE` hacia `/admin/customers/:id` en `public/` da 0 (control positivo: `expensesView.js` da 1). La ruta existe solo para admin (`customersAdmin.routes.ts:665`, `requireRole('admin')`). Este texto no tiene diálogo donde ir hasta que exista ese botón. |
| 11 | `aria-label` | — | entrada de fichero: `Elegir un documento para subir` · descargar: `Descargar {nombre}` · borrar: `Borrar {nombre}` | `Subir documento` · `Descargar documento` · `Eliminar documento` | Forma «acción + objeto»: `customerDetailView.js:985` (`{n} fotos más`, firmado SCRUM-1061) y `:950` (`ariaFotos`). A nombra el documento en cada fila, para que el lector de pantalla distinga una fila de otra. |
| 12 | fichero vacío | `FICHERO_VACIO` (400) | `Ese fichero está vacío: elige otro.` | `El documento no tiene contenido.` | La pantalla SÍ puede producirlo: un fichero de 0 bytes se puede elegir. Se puede cazar antes de enviar (`file.size === 0`), como el tamaño del albarán (`albaranDetailView.js:934`). Ojo: el servidor mira el formato antes que el vacío (`customerAdmin.ts:555-556` de 1005b), así que un PDF vacío sale como 415, no como 400. |
| 13 | nombre no válido | `NOMBRE_NO_VALIDO` (400) | **sin texto** (no hace falta si la pantalla manda siempre `file.name`) | `No se pudo leer el nombre del documento. Cámbiale el nombre y vuelve a subirlo.` | `sanearNombreDocumento` (`customerAdmin.ts:500-509` de 1005b) solo da `null` si el nombre llega vacío o queda en `''`, `.` o `..` tras quitar caracteres de control y `"<>:|?*`. Un nombre así no lo produce un navegador: **leído en el código, no intentado**. B solo si Javier quiere un texto de reserva. |

## Lo que falta en la lista de 11 (lo vi al redactar)

- **Error al cargar la lista.** La pestaña «Sitios» tiene `No se pudieron cargar los sitios guardados. Inténtalo de nuevo.`
  (`customerDetailView.js:129`, firmado). Propuesta A: `No se pudieron cargar los documentos. Inténtalo de nuevo.`
- **`CUERPO_ILEGIBLE`** existe en el servidor de 1005b y no está en los 13; la pantalla no debería producirlo (manda
  binario). Propuesta: el mismo texto genérico de error, sin literal propio.
- **«Documentos» ya se usa** como cabecera de columna dentro de la pestaña «Trabajos» (`customerDetailView.js:19`) y
  como nombre de un pack en el máster (`YAQU_MASTER.md:1818`). No choca con N5 (no hay literal cerrado con esa
  palabra), pero en la misma ficha habría una pestaña y una columna con el mismo nombre y distinto contenido.
  Si eso molesta, B («Adjuntos») lo evita.

## Si Javier decide «borrar, solo admin» (la recomendación del orquestador en c.22184)

1. El botón `🗑 Eliminar` y su confirmación (fila 9) se pintan solo para el admin; para el técnico, la fila 9 no hace falta.
2. La fila 7 cambia: para el técnico, B («ha llegado al máximo de {mb} MB»), sin «Borra alguno», que le pediría algo que no puede hacer.
3. La fila 10 no depende de eso: hoy no la usa ninguna pantalla (borrar un cliente ya es solo admin y solo por API).

## Lo que NO he medido

- No he comprobado si `Subiendo…` (`estadoFirma.js:58`), `Ver →` y los textos de `templatesView.js:143` y `expensesView.js:477` llevan firma: los cito por su FORMA, no como texto firmado.
- No he leído `DESIGN.md` entero (solo un grep de tono) ni `docs/MICROCOPY_APROBADA_SIN_APLICAR.md`.
- Las líneas de 1005b son de su rama, no de main: si cambian antes de entrar, las citas se mueven.
