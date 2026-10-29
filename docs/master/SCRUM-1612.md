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

## J1 · SCRUM-1612c · lo que decidió el fundador sobre 1612 y 1612b (solo docs)

**Medido contra:** `origin/main` = `1608087e64aaa4b08c2877ee3119cc2fad97e02e` · 2026-10-27T16:49:20Z

A9: sin fallo que generalice — es la transcripción al registro de dos comentarios de Jira; no hay código ni medición nueva

Sesión J1 `jv-j1de`, por encargo del orquestador `cobroflash-backend-8b`. Pone al día este registro con las decisiones que están en Jira y que los tramos de arriba no recogen. **No cambia nada de lo escrito arriba**: lo que queda sustituido se dice aquí.

**① Decisiones sobre F1-F6 (SCRUM-1612 c.20983, transcritas por el orquestador, no por el fundador):**
- **F4:** se construye DESPUÉS, cuando la remisión a la AEAT corra (hoy `procesarObligado` tiene 0 llamadas) y haya certificado para probar. Los dos NO VERIFICADO del ② de arriba se cierran en el entorno de pruebas.
- **F1:** implícita en el diseño (alta nueva con `Subsanacion=S`/`RechazoPrevio=N`, fila nueva, sin tocar la factura ni el envío original); se confirma al construir.
- **F2 ✅:** los errores del sistema (2000, 2002, 2003 y 2005-2008) los subsana YaQu sin pedir nada al profesional, tras arreglar el defecto y con revisión de una persona del equipo.
- **F3:** sustituida por c.20988 (②).
- **F5:** L1 firmado, con «facturas» (③).
- **F6:** el GO de las tres piezas STOP de ③ (`encolarRemision`, el builder y la cadena) se pide cuando toque, con el diff delante.

**② F3 rectificada (c.20988): el aviso del 2001 ANTES de emitir NO se construye.** Lo que midió 1612b: antes de emitir el programa sólo ve la forma del NIF, no el censo, y la ficha del cliente ya rechaza un NIF mal formado. El 2001 se avisa cuando la AEAT lo marca en su respuesta, con la remisión ya en marcha (F4), y su texto se trae para firma entonces. Quedan sin usar los literales N1-N3 y las preguntas G1-G4 del tramo 1612b: su «⑤ Para el fundador» ya no espera respuesta.

**③ L1 del aviso del art. 16.4, firmado (c.20983, F5).** Literal copiado del texto de c.20983 tal como lo devolvió Jira a esta sesión (no de una ficha):

> «No hemos podido enviar 3 facturas a la Agencia Tributaria por una incidencia. Lo reintentamos cada hora y te avisamos cuando estén todas enviadas.»

El singular **no lo firmó el fundador**: lo adaptó el orquestador desde L1, y el comentario dice que el fundador lo puede cambiar allí:

> «No hemos podido enviar 1 factura a la Agencia Tributaria por una incidencia. Lo reintentamos cada hora y te avisamos cuando esté enviada.»

Nada de esto se ha escrito en `src/` ni en `public/`: el aviso sólo existe con la remisión encendida (regla 7), y construirlo es F4. Cuando se construya, el literal se copia de c.20983 y se registra en `docs/microcopy/` (A7).

**Estado:** el ticket sigue abierto, a la espera de la remisión (SCRUM-1296, fase 2). Construir: NO HECHO.
