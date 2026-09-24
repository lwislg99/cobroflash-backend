# SCRUM-1089 · La skill de VeriFactu existe duplicada, y las dos copias difieren

**Fecha:** 23-sep-2026 · **Carril:** facturación (excepción del día: J5 en carril fiscal, ver
`docs/equipo/orquestador.md` §11bis — el área normal de J5 sigue siendo Competencia y producto)
**Gate:** sin gate; es medición, no toca código del camino de emisión
**Medido contra:** `origin/main` = `d739ffdc5fe4a8bb13a7f1e520071b76e7a02cbf` · 2026-09-23T08:47:04Z

## Qué es, y qué NO es

Este ticket **mide**; no arregla. El encargo (SCRUM-1089) pide, en orden, (1) cuál copia carga de
verdad una sesión, (2) qué dice cada una que la otra no, (3) desde cuándo divergen y por qué, (4) si
hay más skills en la misma situación — y prohíbe explícitamente borrar cualquiera de las dos copias
o fusionar el contenido a ojo. Este documento es esa medición, completa, y una propuesta sin
ejecutar.

## 1. Cuál carga de verdad (ejercitada, no leída)

Invoqué la skill `yaqu-verifactu-sif` con la herramienta `Skill` de esta misma sesión de Claude
Code. La respuesta declaró expresamente su origen:

```
Base directory for this skill: C:\Users\Javier Pereira\cobroflash-backend\.claude\skills\yaqu-verifactu-sif
```

Carga **`.claude/skills/`**, no `.agents/skills/`. Dos confirmaciones independientes, no leídas de
un documento:

- `scripts/censo-afirmaciones-de-skills.mjs` (el censo de afirmaciones falsas en skills, SCRUM-939,
  que SÍ se ejecuta en cada tanda vía `tests/scrum939b-trinquete-de-las-skills.test.mjs`) lee de
  `DIR = path.join(RAIZ, '.claude', 'skills')` — la propia tooling del repo ya trata
  `.claude/skills/` como el árbol operativo.
- `AGENTS.md` (§"Lo único específico de Codex") lo declara por escrito: `.agents/skills/` es el
  **"espejo de skills para Codex"** — un espejo, no una segunda fuente. El dueño es
  `.claude/skills/`.

## 2. Qué dice cada una que la otra no

`.agents/skills/yaqu-verifactu-sif/SKILL.md` (2.899 B) es una foto de `.claude/`'s tal y como
estaba el 29-jun-2026. **No afirma nada sobre VeriFactu que `.claude/` no cubra ya** (corregido o
igual): es un subconjunto anterior, no una fuente independiente con criterio propio. Lo que
`.agents/` sigue afirmando, sin marcar, y que `.claude/` ya corrigió en SCRUM-538
(20-ago-2026, decidido por el fundador):

| en `.agents/` (obsoleto, sin marcar) | en `.claude/` (corregido) |
| --- | --- |
| «Flujo de control AEAT: respetar `TiempoEsperaEnvio`… sin respuesta → reenviar» | 🔴 NO CONSTRUIDO — no hay envío ni respuesta que esperar (auditoría, eslabones 8 y 9) |
| «FSM `VfSubmission`: `pending → sent → accepted`… `manual_review`» | 🔴 NO CONSTRUIDO — la entidad no existe en `prisma/schema.prisma` |
| «`SIF_ENABLED` off = seguro: la cola pausa…» | 🔴 NO CONSTRUIDO — no hay cola que pausar |
| QA: «Rechazo forzado → retry con backoff → `manual_review` al 5º intento» | 🔴 NO CONSTRUIDO — no es casilla que falte marcar, es una que nadie puede marcar |
| QA: «Evidencias de pruebas AEAT → `docs/VERIFACTU_EVIDENCIAS.md`» | ese fichero no existe; cítese `docs/EVIDENCIAS_E2E.md` |
| (sin el aviso) | caja del árbitro: «EL ÁRBITRO ES EL CÓDIGO» (SCRUM-538 punto 2) |

Ninguna línea de `.agents/` afirma algo sobre VeriFactu que `.claude/` no cubra ya. No hay una
fusión que decidir: es aplicar a la copia un parche que el fundador ya firmó y que nunca llegó al
espejo.

## 3. Desde cuándo divergen, y por qué (`git log --follow` de cada ruta)

- Nacieron IDÉNTICAS el 12-jun-2026 (`a40fcf45`).
- El espejo se creó el 29-jun-2026 (`4964d26d`, «añadir skills yaqu… config Codex… AGENTS.md») —
  copia manual, de una sola vez.
- `.claude/skills/yaqu-verifactu-sif/SKILL.md` recibió 3 commits más, los tres de SCRUM-538
  (20-ago-2026: `aa37bfe0`, `d12118e3`, `b75a608d`).
- `.agents/skills/yaqu-verifactu-sif/SKILL.md` no se ha vuelto a tocar desde el 29-jun-2026.

**Mecanismo:** el espejo se copió una vez a mano y nunca se volvió a sincronizar. No hay proceso
(script, hook, CI) que lo mantenga al día — a diferencia de `impeccable`, que SÍ está gobernado por
hash en `skills-lock.json`.

## 4. Censo completo de las dos carpetas (`este defecto rara vez viene solo`)

`.claude/skills/` (9): `cerebro-yaqu`, `impeccable`, `verifactu`, `yaqu-fase-b`, `yaqu-premium-ui`,
`yaqu-release-check`, `yaqu-sprint`, `yaqu-verifactu-sif`, `yaqu-wa-templates`.
`.agents/skills/` (5): `impeccable`, `yaqu-premium-ui`, `yaqu-release-check`, `yaqu-sprint`,
`yaqu-verifactu-sif`.

De las 5 que existen en ambos lados (bytes exactos contra `origin/main`):

| skill | `.agents/` | `.claude/` | ¿igual? |
| --- | --- | --- | --- |
| `impeccable` | 22.275 B | 22.275 B | igual (gobernada por hash, `skills-lock.json`) |
| `yaqu-premium-ui` | 2.500 B | 2.500 B | igual |
| `yaqu-sprint` | 2.257 B | 2.257 B | igual |
| `yaqu-release-check` | 2.114 B | 3.379 B | **DIFIERE** |
| `yaqu-verifactu-sif` | 2.899 B | 6.213 B | **DIFIERE** — este ticket |

**`yaqu-release-check` tiene el MISMO defecto, con el MISMO mecanismo:** nació igual el 11-jun-2026
(`b028bad6`), se copió al espejo el mismo 29-jun-2026 (`4964d26d`), y `.claude/` recibió 3
correcciones más que el espejo no vio — una de ellas, otra vez, `aa37bfe0` (SCRUM-538, la misma
corrección de «dejar de describir un envío a la AEAT que no existe»).

Las 4 skills de `.claude/skills/` sin espejo (`cerebro-yaqu`, `verifactu`, `yaqu-fase-b`,
`yaqu-wa-templates`) no están duplicadas-y-divergentes: nunca se copiaron. Es un hueco distinto
(Codex no las tiene, en vez de tenerlas mal) — anotado, no investigado más en este ticket.

## Propuesta (sin ejecutar — pide DECISIÓN de un jefe)

No se ha tocado ningún fichero de skill ni de configuración. Propuesta para un ticket de arreglo:

1. **Sincronizar el espejo con la fuente** en los dos pares que divergen (`yaqu-verifactu-sif`,
   `yaqu-release-check`): sustituir `.agents/skills/<x>/SKILL.md` por el contenido de
   `.claude/skills/<x>/SKILL.md`, byte a byte. No es fusión — `.claude/` ya es superconjunto
   corregido de `.agents/` (punto 2), y la corrección la firmó el fundador en SCRUM-538 — pero
   toca contenido fiscal y el propio ticket pide sign-off explícito antes de escribirlo.
2. **Guard nuevo, solo lectura** (no toca el camino de emisión → no es STOP, regla 38): comparar
   por hash `.claude/skills/<x>/SKILL.md` contra `.agents/skills/<x>/SKILL.md` para toda skill
   `yaqu-*` presente en ambos lados (excluyendo `impeccable`, ya gobernada por hash propio en
   `skills-lock.json`), y caer si divergen — para que este defecto no vuelva a congelarse 86 días
   sin que nadie lo note.

## Suelo

Ninguno: los cuatro puntos del encargo se midieron por completo — ejercitando la skill (no leyendo
sobre ella), diffando el contenido íntegro de las dos copias, leyendo `git log --follow` de las dos
rutas, y censando las dos carpetas enteras. Nada queda en «probablemente».

# APÉNDICE · SCRUM-1089 ejecuta la sincronización decidida por Javier (comentario 16600)

**Fecha:** 23-sep-2026 · **Carril:** facturación (excepción del día: J5 en carril fiscal, ver
`docs/equipo/orquestador.md` §11bis — el área normal de J5 sigue siendo Competencia y producto)
**Gate:** sin gate; sincroniza dos documentos de skill y añade un guard de solo lectura, no toca
el camino de emisión
**Medido contra:** `origin/main` = `d8d724e1f3f41d1ce50b785cbfb275b76bd7b729` · 2026-09-23T10:49:58Z

## Decisión que ejecuta este apéndice

Javier confirmó, en el comentario 16600 de este ticket, que `D:\MILLONARIO\cobroFlash\...`
—la ruta que `.codex/hooks.json` señala como consumidor de `.agents/skills/`— es la máquina de
Luis. Eso cambia la medición de la primera parte del ticket (nadie EN ESTE REPOSITORIO lee el
espejo) sin cambiarla de sentido: el espejo sí tiene un lector, y ese lector llevaba desde el
29-jun-2026 leyendo, sin ninguna marca, un envío a la AEAT, una FSM VfSubmission y una cola que
pausa — ninguno de los tres construido. Decisión: **sincronizar, no retirar** el espejo.

## Qué se copió, y qué no

Byte a byte, `.claude/skills/<skill>/SKILL.md` → `.agents/skills/<skill>/SKILL.md`, en los dos
pares que la medición original encontró divergentes:

| skill | antes (`.agents/`) | después | verificación |
| --- | --- | --- | --- |
| `yaqu-verifactu-sif` | 2.899 B | igual a `.claude/` (6.213 B) | `cmp` sin diferencias |
| `yaqu-release-check` | 2.114 B | igual a `.claude/` (3.379 B) | `cmp` sin diferencias |

Sin fusión a ojo: la copia se hizo con `cp` desde Bash (no PowerShell, que añade BOM/CRLF), y se
confirmó con `cmp` que las dos copias de cada skill son ahora el mismo fichero byte a byte. No se
ha escrito ni una palabra nueva en ninguna de las dos skills: el contenido es exactamente el que
ya tenía `.claude/` y que el fundador firmó en SCRUM-538 (20-ago-2026).

Al copiar no apareció nada en `.agents/` que no estuviera ya en `.claude/` o en la medición
original de este ticket (punto 2, primera parte): las dos divergencias eran subconjunto
desactualizado, nunca una fuente independiente con criterio propio.

## El diff completo (lo que `.agents/` GANA al sincronizarse)

### yaqu-verifactu-sif/SKILL.md

````diff
--- .agents/skills/yaqu-verifactu-sif/SKILL.md (antes de este ticket)
+++ .claude/skills/yaqu-verifactu-sif/SKILL.md (fuente; ahora también en .agents/)
@@ -1,49 +1,90 @@
----
-name: yaqu-verifactu-sif
-description: Obligatoria al tocar CUALQUIER cosa de VeriFactu/SIF (huella, QR, registros, cola VfSubmission, envío AEAT, R1/anulación). Impone la spec de docs/SIF_SPEC_NOTES.md, la modalidad VERI*FACTU del master (S1-B) y las reglas fiscales duras (reglas 7, 17, 29).
----
-
-# yaqu-verifactu-sif — Guardarraíles del SIF
-
-> Derivada del master U1.3 (SIF-1 v2) + `docs/SIF_SPEC_NOTES.md` (S1-0b). Si chocan,
-> gana el master. Creada en S1-0b (12-jun-2026).
-
-## Antes de tocar código SIF (obligatorio)
-
-1. Leer `docs/SIF_SPEC_NOTES.md` (endpoints, XSD, flujo de control, decisión sin-XAdES).
-2. Leer U1.3 del master: las 8 obligatorias S1-A..S1-H y su orden.
-3. Si existe, leer `docs/AUDITORIA_RRSIF.md` (diff spec↔código de S1-A).
-
-## Reglas duras
-
-- **Modalidad VERI*FACTU (remisión) — S1-B.** NO implementar firma XAdES ni registro de
-  eventos (`EventosSIF`): son del modo no-VERI*FACTU. Permanencia en la modalidad el año natural.
-- **Una factura emitida JAMÁS se edita ni borra** (regla 29): corrección = R1 vinculada;
-  duplicado = anulación CON su registro. El código nunca ofrece editar/borrar emitidas.
-- **Huella encadenada intocable:** cualquier cambio en el cálculo (campos, orden, formato)
-  exige re-validar contra `SuministroInformacion.xsd` y la Orden HAC/1177/2024, y NUNCA
-  rompe la cadena de huellas ya persistida.
-- **Flujo de control AEAT:** respetar `TiempoEsperaEnvio` de cada respuesta (mín. 60 s);
-  máx 1.000 registros/envío; sin respuesta → reenviar los mismos registros.
-- **FSM `VfSubmission` (Parte L):** `pending → sent → accepted` · `sent → rejected(error)
-  → pending(retry, attempts++)` · `attempts≥5 → manual_review`. `accepted` es terminal.
-- **`SIF_ENABLED` off = seguro:** la cola pausa, la emisión local sigue; al reanudar se
-  remite lo pendiente. Jamás bloquear la emisión por un fallo de remisión (runbook R7).
-- **Cero claims** hasta SIF-1 8/8 (regla 7): nada de VeriFactu en UI/copy de venta;
-  la pregunta del cliente se responde SOLO con el guion H2.
-- **Stop conditions AA1.4:** envío a PRODUCCIÓN AEAT, declaración responsable (S1-E) y
-  todo lo legal/fiscal de cara al público → OK del fundador SIEMPRE.
-
-## Stack (decidido en S1-0b — no re-litigar sin cambio de master)
-
-- mTLS nativo de Node (`https.Agent` con cert/pfx) contra
-  `prewww1.aeat.es/.../VerifactuSOAP` (pruebas) y `www1.agenciatributaria.gob.es/...` (prod).
-- SOAP 1.1 document con plantillas XML propias; respuesta con `fast-xml-parser`.
-- Sin `node-soap`, sin librerías de firma.
-
-## QA mínimo por cambio (alimenta QA_MASTER §7)
-
-- [ ] Registros alta/anulación/R1 validan contra los XSD del espejo.
-- [ ] Rechazo forzado → retry con backoff → `manual_review` al 5º intento.
-- [ ] `SIF_ENABLED=off` no rompe la emisión local.
-- [ ] Evidencias de pruebas AEAT → `docs/VERIFACTU_EVIDENCIAS.md`.
+---
+name: yaqu-verifactu-sif
+description: Obligatoria antes de tocar código de VeriFactu/SIF. Contiene guardarraíles de PROCESO, no el estado del producto: la lectura previa exigida (docs/SIF_SPEC_NOTES.md, U1.3 del máster, docs/AUDITORIA_RRSIF.md), las reglas fiscales duras (reglas 7, 17, 29), la modalidad VERI*FACTU decidida en S1-B, las stop conditions AA1.4 y un checklist de QA mínimo. Para saber qué está construido y qué no, la auditoría docs/legal/AUDITORIA_CAMINO_EMISION.md.
+---
+
+# yaqu-verifactu-sif — Guardarraíles del SIF
+
+> Derivada del master U1.3 (SIF-1 v2) + `docs/SIF_SPEC_NOTES.md` (S1-0b).
+> Creada en S1-0b (12-jun-2026).
+>
+> 🔴 **EL ÁRBITRO ESTÁ SIN DECIDIR, y hasta que se decida NO es el máster.** Esta línea decía
+> «si chocan, gana el máster», y la skill `verifactu` decía lo mismo: las dos se cargan ante la
+> misma tarea, se desmienten en cuatro puntos y las dos mandaban al mismo sitio a desempatar.
+>
+> **El máster no puede arbitrar sobre el estado de VeriFactu**, y no es una opinión: el
+> inventario de **SCRUM-528** midió **61 afirmaciones** en el repo y encontró **19 FALSAS**, y
+> la zona con más falsas era el propio máster — incluido el guion H2, que la regla 26 declara
+> la única respuesta autorizada ante un cliente. Mandar a desempatar allí es mandar a la fuente
+> menos fiable de las tres.
+>
+> ✅ **DECIDIDO POR EL FUNDADOR EL 20-ago-2026 (SCRUM-538, punto 2): EL ÁRBITRO ES EL CÓDIGO.**
+> Y el alcance va escrito así, que no se estira:
+>   · sobre un **HECHO MEDIBLE** —«¿está construido?», «¿existe este fichero?», «¿este flag está
+>     encendido?»— **gana el CÓDIGO, sin preguntar**. No caduca y no puede mentir.
+>   · si el choque **NO** es sobre un hecho medible —posicionamiento, prioridad, criterio de
+>     producto— **la sesión PARA Y PREGUNTA**. El código no opina sobre eso, y elegir por cuenta
+>     propia ahí es inventarse una decisión que no se ha tomado.
+>
+> Es el arbitraje que ya aplica `_guard-afirmacion-fiscal.mjs`: para «¿existe el envío a la
+> AEAT?» no lee un documento, lo deriva del código.
+
+## Antes de tocar código SIF (obligatorio)
+
+1. Leer `docs/SIF_SPEC_NOTES.md` (endpoints, XSD, flujo de control, decisión sin-XAdES).
+2. Leer U1.3 del master: las 8 obligatorias S1-A..S1-H y su orden.
+3. Si existe, leer `docs/AUDITORIA_RRSIF.md` (diff spec↔código de S1-A).
+
+## Reglas duras
+
+- **Modalidad VERI*FACTU (remisión) — S1-B.** NO implementar firma XAdES ni registro de
+  eventos (`EventosSIF`): son del modo no-VERI*FACTU. Permanencia en la modalidad el año natural.
+- **Una factura emitida JAMÁS se edita ni borra** (regla 29): corrección = R1 vinculada;
+  duplicado = anulación CON su registro. El código nunca ofrece editar/borrar emitidas.
+- **Huella encadenada intocable:** cualquier cambio en el cálculo (campos, orden, formato)
+  exige re-validar contra `SuministroInformacion.xsd` y la Orden HAC/1177/2024, y NUNCA
+  rompe la cadena de huellas ya persistida.
+- 🔴 **NO CONSTRUIDO · flujo de control con la AEAT.** No hay envío ni respuesta que esperar
+  (auditoría `docs/legal/AUDITORIA_CAMINO_EMISION.md`, eslabones 8 y 9). Lo que esta regla
+  decía —esperar el `TiempoEsperaEnvio` de cada respuesta, mín. 60 s, y reenviar los mismos
+  registros si no llega ninguna— describe una conversación que ningún código mantiene:
+  `TiempoEsperaEnvio` sólo aparece dentro del XSD de la AEAT, no en código nuestro. Queda
+  escrito en vez de borrado para que se vea que se comprobó, no que se olvidó.
+  ⚠️ **De las tres reglas que había aquí, UNA sí rige hoy**, y no es de envío sino de
+  documento: el tope de **1.000 registros** lo impone `MAX_REGISTROS_POR_ENVIO` al construir
+  el XML (`registro.builder.ts` y `verifactu.service.ts`), que corta con un error antes de
+  generar un fichero que el XSD rechazaría.
+- 🔴 **NO CONSTRUIDO · FSM `VfSubmission`.** La entidad no existe: `VfSubmission` no está en
+  `prisma/schema.prisma` (medido). No hay cola, ni estados, ni contador de intentos, así que
+  `pending → sent → accepted`, los reintentos y `manual_review` son un diseño pendiente y no
+  un comportamiento. Gemela de la afirmación A2 del máster, que el inventario SCRUM-528 ya
+  marcó falsa.
+- 🔴 **NO CONSTRUIDO · `SIF_ENABLED` no pausa ninguna cola.** La bandera existe y se lee, pero
+  hoy lo único que hace es viajar en el sobre del registro de auditoría (`flagsFiscales`, en
+  `audit.service.ts`): no hay cola que pausar ni nada pendiente que remitir al reanudar.
+  ✅ **Lo que sí sigue vigente es la REGLA de diseño:** jamás bloquear la emisión por un fallo
+  de remisión (runbook R7).
+- **Cero claims** hasta SIF-1 8/8 (regla 7): nada de VeriFactu en UI/copy de venta;
+  la pregunta del cliente se responde SOLO con el guion H2.
+- **Stop conditions AA1.4:** envío a PRODUCCIÓN AEAT, declaración responsable (S1-E) y
+  todo lo legal/fiscal de cara al público → OK del fundador SIEMPRE.
+
+## Stack (decidido en S1-0b — no re-litigar sin cambio de master)
+
+- mTLS nativo de Node (`https.Agent` con cert/pfx) contra
+  `prewww1.aeat.es/.../VerifactuSOAP` (pruebas) y `www1.agenciatributaria.gob.es/...` (prod).
+- SOAP 1.1 document con plantillas XML propias; respuesta con `fast-xml-parser`.
+- Sin `node-soap`, sin librerías de firma.
+
+## QA mínimo por cambio (alimenta QA_MASTER §7)
+
+- [ ] Registros alta/anulación/R1 validan contra los XSD del espejo.
+- 🔴 **NO CONSTRUIDO** — «rechazo forzado → retry con backoff → `manual_review` al 5º
+  intento»: no hay envío, ni reintentos, ni ese estado (auditoría, eslabones 8 y 9). No es
+  una casilla que falte marcar: es una casilla que **nadie puede marcar**. Se deja anotada
+  para que no vuelva a añadirse como si fuera trabajo pendiente de QA.
+- [ ] `SIF_ENABLED=off` no rompe la emisión local.
+- 🔴 **NO CONSTRUIDO** — «evidencias de pruebas AEAT»: no hay pruebas contra la AEAT porque no
+  hay envío, y el documento que se citaba, `docs/VERIFACTU_EVIDENCIAS.md`, **no existe**
+  (comprobado el 20-ago-2026). Cítese `docs/EVIDENCIAS_E2E.md`, que sí existe, cuando lo que
+  se quiera adjuntar sean evidencias E2E.
````

### yaqu-release-check/SKILL.md

````diff
--- .agents/skills/yaqu-release-check/SKILL.md (antes de este ticket)
+++ .claude/skills/yaqu-release-check/SKILL.md (fuente; ahora también en .agents/)
@@ -1,34 +1,57 @@
----
-name: yaqu-release-check
-description: Cierre de sprint de YaQu (protocolo AA1.7) — QA del sprint, docs actualizados, done/evidencias en la Parte U y actualización del master. Usar cuando un sprint del registry está listo para cerrarse o el usuario invoque /yaqu-release-check.
----
-
-# /yaqu-release-check — Cierre de sprint (AA1.7)
-
-> Derivado de `docs/YAQU_MASTER.md` Parte AA (regla 35). Si esta skill y el master
-> divergen, gana el master.
-
-## Checklist de cierre (todo debe estar ✅ antes de declarar el sprint cerrado)
-
-1. **QA del sprint.** Ejecutar los checks de `docs/QA_MASTER.md` que apliquen al sprint
-   (la Parte Q define los bloques; el E2E crítico es release blocker). `npm test` en verde.
-2. **Verificación en producción.** Los flujos tocados verificados en **yaqu.app**
-   (no localhost), idealmente desde móvil si el sprint toca landing o WhatsApp.
-3. **Docs actualizados.** Los docs operativos afectados reflejan la realidad:
-   `docs/RUNBOOKS.md` · `docs/QA_MASTER.md` (añadir los checks nuevos del sprint — la
-   Parte Q crece por sprint) · `docs/BUGS.md` (bugs del sprint cerrados o registrados) ·
-   `docs/MIGRATIONS_PENDING.md` si hubo db push · `docs/WHATSAPP_TEMPLATES.md` si se
-   tocaron plantillas.
-4. **Done + evidencias en U.** En `docs/YAQU_MASTER.md` Parte U: marcar el done de la fila
-   con motivo/evidencias (capturas, IDs, docs de evidencia que pida la tarea, p. ej.
-   `EVIDENCIAS_E2E.md`, `VERIFACTU_EVIDENCIAS.md`). **✅ con motivo; nunca borrar filas
-   ni reescribir historia.**
-5. **Master actualizado.** Si el sprint reveló necesidad de cambios de spec → propuesta
-   de cambio de master al fundador (nunca editarlo de tapadillo). AGENTS.md y `.Codex/*`
-   se regeneran del master si la Parte AA cambió (regla 35).
-6. **Flags.** Estado final de los flags del sprint documentado (tabla P): qué quedó ON/OFF
-   y por qué. Cambios de flag global = stop condition (OK del fundador).
-
-## Resultado
-Resumen final al fundador: qué se cerró, evidencias, qué queda pendiente (humano o
-bloqueado), y cuál es el siguiente sprint según la cola U.
+---
+name: yaqu-release-check
+description: Cierre de sprint de YaQu (protocolo AA1.7) — QA del sprint, docs actualizados, done/evidencias en la Parte U y actualización del master. Usar cuando un sprint del registry está listo para cerrarse o el usuario invoque /yaqu-release-check.
+---
+
+# /yaqu-release-check — Cierre de sprint (AA1.7)
+
+> Derivado de `docs/YAQU_MASTER.md` Parte AA (regla 35). Si esta skill y el master
+> divergen, gana el master.
+
+## Checklist de cierre (todo debe estar ✅ antes de declarar el sprint cerrado)
+
+1. **QA del sprint.** Ejecutar los checks de `docs/QA_MASTER.md` que apliquen al sprint
+   (la Parte Q define los bloques; el E2E crítico es release blocker). `npm test` en verde.
+
+   **1-bis. Evidencia de la tanda gateada (SCRUM-161) — 🔴 HOY NO BLOQUEA:**
+
+   ```bash
+   node scripts/verificar-evidencia-tanda.mjs
+   ```
+
+   Comprueba que `npm run test:staging:gated` corrió **contra este mismo commit**, hace menos
+   de 24 h, **en verde** (los tres hijos a exit 0) y **entera** (no un fichero suelto). La
+   evidencia es un recibo que escribe el propio runner, no una respuesta que se teclea.
+
+   **Está APAGADO a propósito** (`ACTIVO = false` en `scripts/_evidencia-tanda.mjs`): la tanda
+   todavía no está verde, y exigir evidencia hoy obligaría a adjuntar una tanda ROJA — o
+   bloquea a todo el mundo, o enseña a adjuntar rojos. Mientras esté apagado **imprime el
+   veredicto y sale 0**: léelo igualmente, porque dice exactamente lo que exigirá el día que se
+   encienda. Se enciende cuando la tanda esté verde o cada rojo tenga ticket y cuarentena
+   (SCRUM-160); es cambiar una línea.
+
+   ⚠️ **Alcance, para no leerlo por más de lo que es:** es un guard contra el **OLVIDO, no
+   contra la mala fe** — nada impide borrar o editar el recibo a mano. Y **NO sustituye a un
+   CI** de los gateados (que no existe: `DATABASE_URL_TESTS` no entra en GitHub Actions,
+   regla 9). Sustituye al descuido, que es el fallo que de verdad ocurre.
+
+2. **Verificación en producción.** Los flujos tocados verificados en **yaqu.app**
+   (no localhost), idealmente desde móvil si el sprint toca landing o WhatsApp.
+3. **Docs actualizados.** Los docs operativos afectados reflejan la realidad:
+   `docs/RUNBOOKS.md` · `docs/QA_MASTER.md` (añadir los checks nuevos del sprint — la
+   Parte Q crece por sprint) · `docs/BUGS.md` (bugs del sprint cerrados o registrados) ·
+   `docs/MIGRATIONS_PENDING.md` si hubo db push · `docs/WHATSAPP_TEMPLATES.md` si se
+   tocaron plantillas.
+4. **Done + evidencias en U.** En `docs/YAQU_MASTER.md` Parte U: marcar el done de la fila
+   con motivo/evidencias (capturas, IDs, docs de evidencia que pida la tarea, p. ej.
+   `EVIDENCIAS_E2E.md`). **✅ con motivo; nunca borrar filas
+   ni reescribir historia.**
+5. **Master actualizado.** Si el sprint reveló necesidad de cambios de spec → propuesta
+   de cambio de master al fundador (nunca editarlo de tapadillo). CLAUDE.md y `.claude/*`
+   se regeneran del master si la Parte AA cambió (regla 35).
+6. **Flags.** Estado final de los flags del sprint documentado (tabla P): qué quedó ON/OFF
+   y por qué. Cambios de flag global = stop condition (OK del fundador).
+
+## Resultado
+Resumen final al fundador: qué se cerró, evidencias, qué queda pendiente (humano o
+bloqueado), y cuál es el siguiente sprint según la cola U.
````

## Guard nuevo, de solo lectura

`scripts/_guard-espejo-skills.mjs` + `tests/scrum1089b-espejo-skills-agentes.test.mjs`: compara por
sha256 `.claude/skills/<x>/SKILL.md` contra `.agents/skills/<x>/SKILL.md` para toda skill con
`SKILL.md` en las dos carpetas (población derivada del árbol, no de una lista escrita a mano),
excluyendo `impeccable` (ya gobernada por hash propio en `skills-lock.json` — un segundo árbitro
sobre la misma pareja sería redundante y podría discrepar algún día). Cae si diverge.

No es STOP (regla 38): solo lee las dos carpetas, no toca el camino de emisión ni el contenido de
ninguna skill.

Verificado en rojo antes de darlo por bueno (A23 #8): el propio test siembra una divergencia de un
byte en una COPIA temporal del espejo (nunca en el árbol real — helper `tests/_temporal.mjs`,
fuera del repo) y comprueba que el guard la nombra; después confirma que el original no se tocó.
Dos SUELOs declarados: sin una de las dos carpetas, o con población vacía (todo excluido), el
censo se declara CIEGO en vez de dar un verde que no vio nada.

```
✔ SCRUM-1089b · SUELO: la población ve los 4 pares espejados conocidos, y no a impeccable
✔ SCRUM-1089b · EN VERDE: el árbol real está sincronizado byte a byte tras este ticket
✔ SCRUM-1089b · EL QUE DECIDE: una divergencia sembrada en una COPIA del espejo lo tumba
✔ SCRUM-1089b · SUELO ciego: sin una de las dos carpetas, no hay falso verde
✔ SCRUM-1089b · SUELO ciego: población vacía (todo excluido) tampoco es un verde silencioso
tests 5, pass 5, fail 0
```

## Comprobación adicional pedida por el encargo: la copia de .claude/ es la de HOY

El encargo avisaba de que hoy se aplicaba SCRUM-534n (opción B) a la Parte L y pedía comprobar que
`.claude/skills/yaqu-verifactu-sif` no arrastrara lo viejo. Medido, no asumido:

- Al empezar este apéndice, SCRUM-534n **NO estaba en `origin/main`**: vivía solo en
  `origin/scrum-534n-parte-l-opcion-b` (`970f3bf1`, no era ancestro de `main`). El aviso del
  encargo iba por delante de la medición real en ese momento.
- Se mergeó a `main` **durante esta misma sesión** (PR #1717), y ya está incluido en el sha de
  este ancla (`d8d724e1`).
- No hace falta ningún cambio en la skill por eso: `.claude/skills/yaqu-verifactu-sif` ya decía,
  desde SCRUM-538, que `VfSubmission` **no existe** en el esquema y que su FSM es diseño
  pendiente, no comportamiento — exactamente lo que SCRUM-534n acaba de hacer explícito en la
  Parte L (`Invoice.vfEstado` real; `VfSubmission` retirado del máster como nombre de estado).
  Las dos fuentes dicen lo mismo con palabras distintas; no hay un tercer sitio desincronizado.

## Suelo

Ninguno en la sincronización: los dos pares divergentes de la medición original son los dos que
se copiaron, verificados con `cmp` byte a byte. El guard nuevo declara los suyos arriba. La duda
que sí queda, dicha y no resuelta aquí: `.agents/skills/` sigue con 4 skills sin espejo
(`cerebro-yaqu`, `verifactu`, `yaqu-fase-b`, `yaqu-wa-templates`) — la medición original ya lo
anotó como "hueco distinto" y este apéndice no lo investiga más.
