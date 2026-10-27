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
> ✅ **DECIDIDO POR EL FUNDADOR EL 20-ago-2026 (SCRUM-538, punto 2): EL ÁRBITRO ES EL CÓDIGO.**
> Y el alcance va escrito así, que no se estira:
>   · sobre un **HECHO MEDIBLE** —«¿está construido?», «¿existe este fichero?», «¿este flag está
>     encendido?»— **gana el CÓDIGO, sin preguntar**. No caduca y no puede mentir.
>   · si el choque **NO** es sobre un hecho medible —posicionamiento, prioridad, criterio de
>     producto— **la sesión PARA Y PREGUNTA**. El código no opina sobre eso, y elegir por cuenta
>     propia ahí es inventarse una decisión que no se ha tomado.
>
> Es el arbitraje que ya aplica `_guard-afirmacion-fiscal.mjs`: para «¿existe el envío a la
> AEAT?» no lee un documento, lo deriva del código.

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
  [Corregido el 13-oct-2026, SCRUM-1500h, con la revisión del fundador que pide la regla 10 (SCRUM-1500 c.18993): aquí decía «`TiempoEsperaEnvio` sólo aparece dentro del XSD de la AEAT, no en código nuestro», y es falso: lo nombran tres ficheros de `src/modules/fiscal/verifactu/` —`sif.client.ts` lo lee de la respuesta, `sif.cola.ts` fija su suelo de 60 s y `sif.procesador.ts` lo usa como espera por obligado— (SCRUM-1500g, Jira c.18986). «Ningún código mantiene esa conversación» sigue siendo cierto sólo como «nada se ejecuta»: `procesarObligado` y `enviarSobre` tienen 0 llamadas en `src/` (SCRUM-1500d, Jira c.18919). NO medido: ninguna base de datos (ni si la tabla existe en producción, staging o dev, ni cuántas filas tiene) ni el valor de `SIF_ENABLED` en Railway.] Queda
  escrito en vez de borrado para que se vea que se comprobó, no que se olvidó.
  ⚠️ **De las tres reglas que había aquí, UNA sí rige hoy**, y no es de envío sino de
  documento: el tope de **1.000 registros** lo impone `MAX_REGISTROS_POR_ENVIO` al construir
  el XML (`registro.builder.ts` y `verifactu.service.ts`), que corta con un error antes de
  generar un fichero que el XSD rechazaría.
- 🔴 **NO CONSTRUIDO · FSM `VfSubmission`.** [Corregido el 8-oct-2026, SCRUM-1500f, con la revisión del fundador que pide la regla 10 (SCRUM-1500 c.18970): aquí decía «La entidad no existe: `VfSubmission` no está en `prisma/schema.prisma` (medido). No hay cola, ni estados, ni contador de intentos, así que `pending → sent → accepted`, los reintentos y `manual_review` son un diseño pendiente y no un comportamiento», y es falso desde el 30-sep-2026 (SCRUM-1296).]
  Medido en SCRUM-1500d (Jira c.18919): **hay una tabla que la emisión llena y que ningún proceso vacía.** El esquema tiene el modelo, sellar una factura deja su alta en `pending`, y el único código que la sacaría de ahí (`procesarObligado`) existe, tiene tests y no lo llama ni lo carga nadie: ni un cron, ni una ruta, ni el arranque. No es «no hay nada» ni «una cola que alguien vacía».
  El enum del esquema y `ESTADOS_VF_SUBMISSION` son la misma lista: `pending`, `sent`, `accepted`, `rejected`, `manual_review`. Hoy sólo se puede escribir `pending`; los otros cuatro salen de `procesarObligado`, que tiene 0 llamadas. No se encola ninguna anulación.
  **NO medido:** ninguna base de datos —ni si la tabla existe en producción, staging o dev, ni cuántas filas tiene— ni el valor de `SIF_ENABLED` en Railway, sólo su valor por defecto en el código.
  Gemela de la afirmación A2 del máster, que el inventario SCRUM-528 ya marcó falsa.
- 🔴 **NO CONSTRUIDO · `SIF_ENABLED` no pausa ninguna cola.** La bandera existe y se lee, pero
  hoy lo único que hace es viajar en el sobre del registro de auditoría (`flagsFiscales`, en
  `audit.service.ts`): [Corregido el 13-oct-2026, SCRUM-1500h, con la revisión del fundador que pide la regla 10 (SCRUM-1500 c.18993): aquí decía «no hay cola que pausar ni nada pendiente que remitir al reanudar», y que lo único que hace la bandera es viajar en el sobre de auditoría; es falso desde el 30-sep-2026 (SCRUM-1296). Medido en SCRUM-1500d (Jira c.18919): hay una tabla que la emisión llena y que ningún proceso vacía — el esquema tiene el modelo, sellar una factura deja su alta en `pending`, y el único código que la sacaría de ahí existe, tiene tests y no lo llama ni lo carga nadie: ni un cron, ni una ruta, ni el arranque. `procesarObligado` (`sif.procesador.ts`) también lee `SIF_ENABLED`, para dejar la cola en pausa, pero tiene 0 llamadas: hoy la bandera sigue sin pausar nada que esté en marcha, y lo pendiente de remitir son las altas en `pending`. NO medido: ninguna base de datos (ni si la tabla existe en producción, staging o dev, ni cuántas filas tiene) ni el valor de `SIF_ENABLED` en Railway.]
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
  intento»: no hay envío. [Corregido el 13-oct-2026, SCRUM-1500h, con la revisión del fundador que pide la regla 10 (SCRUM-1500 c.18993): aquí seguía «ni reintentos, ni ese estado (auditoría, eslabones 8 y 9)», y es falso desde el 30-sep-2026 (SCRUM-1296): `manual_review` está en el enum del esquema, y el código de reintentos existe (`sif.cola.ts`: `MAX_INTENTOS`, `backoffS` y el paso a `manual_review`) y nada lo ejecuta: el proceso no carga ese fichero y `procesarObligado` tiene 0 llamadas (Jira c.18919); sus tests NO se han corrido hoy. Falta quien lo ejecute. NO medido: ninguna base de datos (ni si la tabla existe en producción, staging o dev, ni cuántas filas tiene) ni el valor de `SIF_ENABLED` en Railway.] No es
  una casilla que falte marcar: es una casilla que **nadie puede marcar**. Se deja anotada
  para que no vuelva a añadirse como si fuera trabajo pendiente de QA.
- [ ] `SIF_ENABLED=off` no rompe la emisión local.
- 🔴 **NO CONSTRUIDO** — «evidencias de pruebas AEAT»: no hay pruebas contra la AEAT porque no
  hay envío, y el documento que se citaba, `docs/VERIFACTU_EVIDENCIAS.md`, **no existe**
  (comprobado el 20-ago-2026). [Fechado el 13-oct-2026, SCRUM-1530: la frase de arriba no se reescribe —dice lo que era cierto el 20-ago-2026— y hoy se parte en tres. ① «No hay pruebas contra la AEAT» dejó de ser cierto el 24-sep-2026: constan envíos hechos A MANO por Javier, desde su navegador y con su certificado, al entorno de PRUEBAS de la AEAT (`preportal.aeat.es` → VERI*FACTU → «Cliente de servicio web»), con sobres que genera `scripts/sobre-soap-prueba-aeat.mjs`. En el repositorio constan tres altas con respuesta `Correcto` (una del 24-sep y dos del 28-sep), dos `AceptadoConErrores` anteriores y un duplicado con error 3000; ninguna respuesta a una anulación ni a una R1. ② «No hay envío» sigue siendo cierto de NUESTRO código: `enviarSobre` y `procesarObligado` tienen 0 llamadas en `src/` (re-medido el 13-oct-2026 sobre `780c8127`), así que esas pruebas no pasaron por `sif.client.ts` ni por la cola: no prueban el transporte. ③ El documento de evidencias que se citaba sigue sin estar. Las evidencias que SÍ hay: `docs/master/SCRUM-1110.md` (apéndice del 24-sep: los siete envíos y sus CSV), `docs/master/SCRUM-1398.md` (las dos sondas del 28-sep, transcritas de Jira SCRUM-1211 c.17334) y `docs/master/SCRUM-1399.md` (qué respuestas constan y cuáles no). CON QUÉ IDENTIDAD: en nombre propio — el `ObligadoEmision` del alta aceptada el 24-sep es el NIF personal de Javier (escrito en ese apéndice) y los registros dicen que entró con su certificado personal de la FNMT; de las dos del 28-sep sólo consta «mismo emisor» y «con su certificado», no el NIF. Que el titular del certificado sea ese NIF NO lo ha comprobado ninguna sesión, ni debe: ningún certificado se abre para esto. Qué valida entonces un `Correcto`: en la misma tanda la AEAT había devuelto antes avisos de CONTENIDO (1239, 2004, 2007), o sea que llegó a leer el registro y no se quedó en la autorización; pero sólo para el caso «obligado = titular». NO dice nada de YaQu remitiendo por un tercero o como colaborador (pide la SL y el Convenio 017: `docs/master/SCRUM-1225.md`), no tiene trascendencia tributaria, NO cierra S1-D (≥10 consecutivos de alta, anulación y R1) y no levanta la regla 7: cero claims. NO medido: ningún certificado, ninguna base de datos, la AEAT (hoy no se ha enviado nada) ni en qué host de pruebas entró cada envío, que no consta.] Cítese `docs/EVIDENCIAS_E2E.md`, que sí existe, cuando lo que
  se quiera adjuntar sean evidencias E2E.
