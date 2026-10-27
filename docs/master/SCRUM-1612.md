# SCRUM-1612 · SIF-1 · subsanar un registro «aceptado con errores» y el aviso del art. 16.4

## J1 · SCRUM-1612 · diseño (nada construido)

**Medido contra:** `origin/main` = `793a790dcef24f6139ed2e87fba80031efae0011` · 2026-10-26T23:36:36Z (hora de GitHub; sesión J1 `jv-j1cv`, por encargo del orquestador `cobroflash-backend-8b`. Al escribir, main = `c09dd883ebfaf0f5e2213fb31f623ca547871a01`, sin cambios en `src/modules/fiscal`, `src/modules/invoicing/domain`, `prisma` ni `docs/legal/fuentes`. Detalle y tablas en Jira, SCRUM-1612 c.20979)

A9: aviso → cicatriz J1 «Medí mi contexto con `ls -t */*.jsonl`, que coge la transcripción más reciente de TODAS las carpetas: leí 198k de otra sesión (j6cz); lo cacé porque la ruta impresa no era la mía, y la cifra buena era 115k» — no se pudo comprobar: la medición del contexto se hace en la consola, y ningún guard del repositorio la ve

Sólo docs. Cero líneas de `src/`, `prisma/` y tests. Nada contra la AEAT.

**① Qué admite subsanación.** `docs/legal/fuentes/aeat-errores.properties` (sha256 `152fec33…`) tiene 248 códigos en tres bloques con cabecera literal: L1, rechazo del envío completo (44); L47, rechazo de la factura (194); L244, «producen la aceptación del registro […] (posteriormente deben ser subsanados)» (10: `2000`–`2009`, L245-254). Sólo el tercero es «aceptado con errores» (`sif.cola.ts:128-129`: `accepted` + `subsanar`). El sistema corrige 2000, 2002, 2003 y 2005-2008, que son defectos nuestros (cinco de ellos tocan la cadena). El profesional corrige 2001 (NIF del cliente). 2004 y 2009 están eximidos según el PDF de validaciones §4.3.1, que cito por `docs/legal/SEMAFORO_CALIBRACION.md:239-249`; el PDF no lo he leído.

**② Cómo se reenvía.** El art. 16 de la Orden HAC/1177/2024 (BOE consolidado, bloque `a1-8`, leído el 26-oct a las 23:35Z) **no regula la subsanación**. «Subsan» sale 2 veces en toda la Orden, las dos en la lista L17 del anexo (`RechazoPrevio` N/S/X; prohíbe alta con `Subsanacion=N` + `RechazoPrevio=S`). Diseño: una **alta nueva** de la misma factura con `Subsanacion=S` y `RechazoPrevio=N`, en una fila nueva de `vf_submissions`. No se tocan ni la factura ni el envío original (regla 29). NO VERIFICADO: si la subsanación lleva huella propia y encadena.

**③ Cola.** Hay tres piezas que son camino de emisión (STOP, regla 40). La primera es `encolarRemision.ts:57-61`, que hoy rehúsa una segunda alta de la misma factura. Las otras dos son el builder (0 `Subsanacion`/`RechazoPrevio` en `src/*.ts`) y la cadena (`ultimaHuellaDeLaCadena`). No son emisión ni la marca de `sif.cola.ts`, ni la cabecera `RemisionVoluntaria/Incidencia` del 16.4 (`SuministroInformacion.xsd:19-23`, sin escribir), ni la lectura para el aviso. `procesarObligado` sigue con 0 llamadas.

**④ Aviso 16.4.** Una franja fija en el panel mientras falte algo por remitir (lo exige el 16.4: «mientras quede alguno de estos por remitir»). Tres literales SIN FIRMA en c.20979 (regla 39); recomiendo L1. No se ve nada antes de SIF-1 8/8 (regla 7).

**⑤ Para el fundador:** F1-F6 en c.20979. Construir: NO HECHO, espera esas respuestas y el GO con el diff delante.

**Medido así:** el catálogo, el art. 16, `sif.cola.ts:128/131`, `encolarRemision.ts:57-61` y el XSD (L19-23, 109-110, 851) los comprobé a mano. El resto lo leyó un subagente y va marcado así en c.20979. **Mi error, además de la cicatriz:** en c.20979 el párrafo «Mi error» habla del subagente, y el error real del día es la medición de contexto de arriba. Lo corrijo aquí y no en Jira, para no abrir un segundo comentario.

## J1 · SCRUM-1612b · F3: el aviso del 2001 antes de emitir (solo medición y literales)

**Medido contra:** `origin/main` = `840ca85b8c9ff76d25bdd286aab07439345698fa` · 2026-10-26T23:47:15Z (hora de GitHub; sesión J1 `jv-j1cw`, por encargo del orquestador `cobroflash-backend-8b`. Al escribir, main = `5df4e330ef8f99872987498feae4a874bf044490`, sin cambios en `public/dashboard/js`, `src/core/validation` ni `docs/legal`. Detalle y tablas en Jira, SCRUM-1612 c.20986)

A9: aviso → cicatriz J1 «En el comentario de Jira de 1612b (c.20986) cité cuatro números de línea sacados de un rango de `sed` sin contarlos, y al corregirlo a la vista puse la hora de la corrección a ojo (23:49Z; Jira dice 23:48:38Z)» — no se pudo comprobar: el texto de un comentario de Jira no pasa por ningún guard del repositorio

Decisión que lo abre: F3 del fundador en c.20983 (el 2001 se avisa ANTES de emitir y no bloquea; el texto, aparte y con firma).

**① Qué sabe el programa.** Solo la forma y la letra o dígito de control: `src/core/validation/nifEspanol.ts:107` (DNI L111, NIE L116, CIF L122; vacío = válido, L109). Su propia cabecera (L24-25) dice que no comprueba la existencia. **El censo no lo sabe.** El 2001 es «no está identificado en el censo» (`aeat-errores.properties:246`). En el repositorio hay 0 consultas de NIF a la AEAT; control positivo: el mismo barrido sí ve el 2001. Además, la ficha (`schemas.ts:604`) ya rechaza un NIF mal formado al guardarlo, así que un aviso de forma al emitir cazará poco.

**② Dónde.** La decisión, en `public/dashboard/js/facturaPreEmision.js` (J1). Sus dos pantallas de emitir son de S2, del equipo de Luis: `jobDetailView.js:3376`, que es su único llamador, y `quotesView.js:5579`, que no revisa nada. Pintarlo cruza de equipo.

**③ Literales SIN FIRMA (regla 39):** N1, N2 y N3, en c.20986. Recomiendo N1. Ninguno dice Hacienda, AEAT ni censo. «Ese NIF/CIF no es válido. Compruébalo.» no sirve: es provisional del asesor (`SCRUM-575.md:85`).

**④ Emisión.** Un aviso de pantalla que no bloquea no toca el camino de emisión. Una comprobación en el servidor dentro de `POST /admin/invoices` o del sellado sí lo tocaría: STOP (regla 40).

**⑤ Para el fundador:** G1-G4 en c.20986. Construir: NO HECHO; espera esas respuestas y la firma.

**De paso:** la hoja de facturar parcial bloquea hoy un NIF mal tecleado con «No hemos podido guardar el NIF…» (`jobDetailView.js:3429`), un mensaje que no dice el motivo. Es de S2: va como G4, no se ha tocado.

**NO medido:** ninguna base; los 9 escritores de `customer` uno a uno; si `POST /admin/albaranes/:id/emitir` emite factura; el guard que enumera `REVISION_ESTADOS`; el servicio de NIF de la AEAT. Suite entera local: NO CORRIDA.
