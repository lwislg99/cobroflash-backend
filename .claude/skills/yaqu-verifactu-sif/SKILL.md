---
name: yaqu-verifactu-sif
description: Obligatoria antes de tocar código de VeriFactu/SIF. Contiene guardarraíles de PROCESO, no el estado del producto: la lectura previa exigida (docs/SIF_SPEC_NOTES.md, U1.3 del máster, docs/AUDITORIA_RRSIF.md), las reglas fiscales duras (reglas 7, 17, 29), la modalidad VERI*FACTU decidida en S1-B, las stop conditions AA1.4 y un checklist de QA mínimo. Para saber qué está construido y qué no, la auditoría docs/legal/AUDITORIA_CAMINO_EMISION.md.
---

# yaqu-verifactu-sif — Guardarraíles del SIF

> Derivada del master U1.3 (SIF-1 v2) + `docs/SIF_SPEC_NOTES.md` (S1-0b).
> Creada en S1-0b (12-jun-2026).
>
> 🔴 **EL ÁRBITRO ESTÁ SIN DECIDIR, y hasta que se decida NO es el máster.** Esta línea decía
> «si chocan, gana el máster», y la skill `verifactu` decía lo mismo: las dos se cargan ante la
> misma tarea, se desmienten en cuatro puntos y las dos mandaban al mismo sitio a desempatar.
>
> **El máster no puede arbitrar sobre el estado de VeriFactu**, y no es una opinión: el
> inventario de **SCRUM-528** midió **61 afirmaciones** en el repo y encontró **19 FALSAS**, y
> la zona con más falsas era el propio máster — incluido el guion H2, que la regla 26 declara
> la única respuesta autorizada ante un cliente. Mandar a desempatar allí es mandar a la fuente
> menos fiable de las tres.
>
> **Mientras no haya decisión del fundador**, para un hecho medible —qué está construido, qué
> existe— gana **el CÓDIGO**, que es el arbitraje que él mismo fijó y el que ya aplica
> `_guard-afirmacion-fiscal.mjs`. Si el choque no es sobre un hecho medible, se PARA y se
> pregunta; no se elige por cuenta propia.
>
> Candidatos medidos para la decisión, con lo que aporta cada uno:
>   · `docs/legal/AUDITORIA_CAMINO_EMISION.md` (SCRUM-525) — qué existe HOY, con fichero y
>     línea. Es lo más cercano a un árbitro, pero es una foto con fecha: caduca al construir.
>   · el CÓDIGO — no caduca nunca y no puede mentir, pero no responde preguntas de proceso
>     ni de decisión (modalidad, carriles, plazos).
>   · `docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md` (SCRUM-528) — dice qué NO creerse,
>     que no es lo mismo que decir qué es cierto.
> **Decide el fundador (SCRUM-538, punto 2).**

## Antes de tocar código SIF (obligatorio)

1. Leer `docs/SIF_SPEC_NOTES.md` (endpoints, XSD, flujo de control, decisión sin-XAdES).
2. Leer U1.3 del master: las 8 obligatorias S1-A..S1-H y su orden.
3. Si existe, leer `docs/AUDITORIA_RRSIF.md` (diff spec↔código de S1-A).

## Reglas duras

- **Modalidad VERI*FACTU (remisión) — S1-B.** NO implementar firma XAdES ni registro de
  eventos (`EventosSIF`): son del modo no-VERI*FACTU. Permanencia en la modalidad el año natural.
- **Una factura emitida JAMÁS se edita ni borra** (regla 29): corrección = R1 vinculada;
  duplicado = anulación CON su registro. El código nunca ofrece editar/borrar emitidas.
- **Huella encadenada intocable:** cualquier cambio en el cálculo (campos, orden, formato)
  exige re-validar contra `SuministroInformacion.xsd` y la Orden HAC/1177/2024, y NUNCA
  rompe la cadena de huellas ya persistida.
- 🔴 **NO CONSTRUIDO · flujo de control con la AEAT.** No hay envío ni respuesta que esperar
  (auditoría `docs/legal/AUDITORIA_CAMINO_EMISION.md`, eslabones 8 y 9). Lo que esta regla
  decía —esperar el `TiempoEsperaEnvio` de cada respuesta, mín. 60 s, y reenviar los mismos
  registros si no llega ninguna— describe una conversación que ningún código mantiene:
  `TiempoEsperaEnvio` sólo aparece dentro del XSD de la AEAT, no en código nuestro. Queda
  escrito en vez de borrado para que se vea que se comprobó, no que se olvidó.
  ⚠️ **De las tres reglas que había aquí, UNA sí rige hoy**, y no es de envío sino de
  documento: el tope de **1.000 registros** lo impone `MAX_REGISTROS_POR_ENVIO` al construir
  el XML (`registro.builder.ts` y `verifactu.service.ts`), que corta con un error antes de
  generar un fichero que el XSD rechazaría.
- 🔴 **NO CONSTRUIDO · FSM `VfSubmission`.** La entidad no existe: `VfSubmission` no está en
  `prisma/schema.prisma` (medido). No hay cola, ni estados, ni contador de intentos, así que
  `pending → sent → accepted`, los reintentos y `manual_review` son un diseño pendiente y no
  un comportamiento. Gemela de la afirmación A2 del máster, que el inventario SCRUM-528 ya
  marcó falsa.
- 🔴 **NO CONSTRUIDO · `SIF_ENABLED` no pausa ninguna cola.** La bandera existe y se lee, pero
  hoy lo único que hace es viajar en el sobre del registro de auditoría (`flagsFiscales`, en
  `audit.service.ts`): no hay cola que pausar ni nada pendiente que remitir al reanudar.
  ✅ **Lo que sí sigue vigente es la REGLA de diseño:** jamás bloquear la emisión por un fallo
  de remisión (runbook R7).
- **Cero claims** hasta SIF-1 8/8 (regla 7): nada de "VeriFactu" en UI/copy de venta;
  la pregunta del cliente se responde SOLO con el guion H2.
- **Stop conditions AA1.4:** envío a PRODUCCIÓN AEAT, declaración responsable (S1-E) y
  todo lo legal/fiscal de cara al público → OK del fundador SIEMPRE.

## Stack (decidido en S1-0b — no re-litigar sin cambio de master)

- mTLS nativo de Node (`https.Agent` con cert/pfx) contra
  `prewww1.aeat.es/.../VerifactuSOAP` (pruebas) y `www1.agenciatributaria.gob.es/...` (prod).
- SOAP 1.1 document con plantillas XML propias; respuesta con `fast-xml-parser`.
- Sin `node-soap`, sin librerías de firma.

## QA mínimo por cambio (alimenta QA_MASTER §7)

- [ ] Registros alta/anulación/R1 validan contra los XSD del espejo.
- 🔴 **NO CONSTRUIDO** — «rechazo forzado → retry con backoff → `manual_review` al 5º
  intento»: no hay envío, ni reintentos, ni ese estado (auditoría, eslabones 8 y 9). No es
  una casilla que falte marcar: es una casilla que **nadie puede marcar**. Se deja anotada
  para que no vuelva a añadirse como si fuera trabajo pendiente de QA.
- [ ] `SIF_ENABLED=off` no rompe la emisión local.
- 🔴 **NO CONSTRUIDO** — «evidencias de pruebas AEAT»: no hay pruebas contra la AEAT porque no
  hay envío, y el documento que se citaba, `docs/VERIFACTU_EVIDENCIAS.md`, **no existe**
  (comprobado el 20-ago-2026). Cítese `docs/EVIDENCIAS_E2E.md`, que sí existe, cuando lo que
  se quiera adjuntar sean evidencias E2E.
