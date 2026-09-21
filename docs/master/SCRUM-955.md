# SCRUM-955 — Mapa medido: qué le falta HOY a la factura con VeriFactu (SIF-1) para emitirse de verdad

**21-sep-2026 ~14:00Z** · medido contra `origin/main` = `1dd09882fefa41186e9852c5bb39f20d4aa495d8`,
re-verificado sin cambios de veredicto tras traer `origin/main` = `2631bb9a53905c89537c8461c9cf2ab12de796f8`
a la rama (los 347 commits de diferencia no tocan ningún fichero medido aquí — comprobado con
`git diff --name-only` sobre los 6 ficheros de esta ficha) · J1 (`jv-j1`).
Encargo de Javier, 18-sep-2026 ~15:40Z: *"La factura en formato correcto, Verifactu, es nuestro
cuello de botella y prioridad"*. Con el interruptor fiscal en OFF (SCRUM-612), YaQu ni emite ni
cobra — la factura desbloquea el producto entero, no solo lo fiscal.

Este documento **MIDE, no construye** (regla 38: el camino de emisión se lee, no se modifica).

## 0 · Cómo se midió

- **Instrumento:** `docs/master/evidencias/SCRUM-955/censo-sif1.mjs` — censo por AST sobre los
  **blobs** de `origin/main` (`git cat-file --batch`), nunca el árbol de trabajo. Parsea con el
  `typescript` del propio repo, así que los comentarios no cuentan como hechos. Cada fila lleva su
  **población** y un **control positivo**; si el control da 0 la fila sale CIEGA y el proceso
  termina con código 2 en vez de mentir con un "no existe" que no ha mirado.
- **Comando exacto (reproducible):**
  ```
  node docs/master/evidencias/SCRUM-955/censo-sif1.mjs . origin/main
  ```
  Salida completa capturada el 21-sep-2026 en
  `docs/master/evidencias/SCRUM-955/censo-sif1-salida-2026-09-21.txt`: **25 filas, 0 ciegas,
  `EXIT=0`**.
- **Verificado en ROJO** (no basta con que el censo diga que sí sabe — hay que verlo fallar):
  con `docs/master/evidencias/SCRUM-955/_fabricar-ref-rojo.mjs` + `git` de bajo nivel (índice
  temporal vía `GIT_INDEX_FILE`, sin tocar ninguna rama ni el árbol de trabajo) se construyó un
  **commit local fabricado** (no está en ninguna rama, no se ha empujado) idéntico a `origin/main`
  salvo que `tests/verifactu.test.mjs` pierde el vector oficial de la AEAT. Contra ese commit, la
  fila `A1` sale **CIEGA y el proceso termina con `EXIT=2`**: el mecanismo de control positivo
  detecta de verdad la ausencia del hecho, no es una tautología.
- **Corrección sobre el borrador anterior (commit local `7845a57a`, nunca empujado):** cinco
  veredictos estaban **escritos a mano en el instrumento, antes de medir** (`C1`, `A3`, `C5`, `D5`,
  `C9`). Se han sustituido por lógica que deriva el veredicto de lo contado. El cambio no es
  cosmético: al derivarlos aparecieron dos hallazgos que el texto fijo ocultaba —
  `registro.builder.ts` está huérfano en producción (`C1`) y `sellarAnulacionTrasEmision` SÍ se
  llama desde el producto (`C9`, antes decía literalmente "ver detalle").
- **Tests de huella/XSD tras `npm run build`** (`tsc` en verde): `tests/verifactu.test.mjs` +
  los que tocan `scrum198`, `scrum240`, `registroBuilder`, `scrum145`, `scrum153c`, `scrum215`,
  `scrum216` → **59/59 en verde, 0 fallos, 0 saltos** (TAP a fichero, leído en comando separado).
- **Se añadieron 3 filas** que el borrador anterior había dejado pendientes de medir (`H1`, `H2`,
  `H3` — ver §5, incluye una corrección a un hallazgo propio que resultó ser FALSO hoy).

## 1 · Resultado, fila por fila (25 filas del censo)

| id | requisito | veredicto medido |
|---|---|---|
| A1 | Huella SHA-256, formato oficial + vector AEAT en test | **HECHO** (3 funciones declaradas, vector presente 2×) |
| A2 | Encadenado serializado por merchant (lock Postgres) | **HECHO** (1 lock en alta, 1 en anulación) |
| A3 | Fecha-hora-huso del registro (SCRUM-735) | **CONFIRMADO: reloj y huso LOCAL del proceso** (`new Date()` sin args + getters no-UTC) |
| A4 | QR de cotejo: base de pruebas (prewww2) | **A MEDIAS** — solo la URL de producción está en el código, 0 literales `prewww` |
| A5 | Leyenda VERI\*FACTU en el PDF | **HECHO, pero atada a `isVF = !!params.vfHash`** (la huella), no a la remisión |
| C1 | Generadores de alta/anulación | **2 plantillas de cada tipo; las de `registro.builder.ts` NO se llaman desde `src/` (0 sitios) — huérfanas en producción**, solo las de `verifactu.service.ts` están cableadas |
| C2 | RegistroAnterior completo | **HECHO** (3 plantillas, 4/4 hijos cada una) |
| C3 | Sello persistido = el mismo del XML | **HECHO** (`vfHash`/`vfTimestamp` existen y se usan) |
| C4 | Bloque SistemaInformatico, 9 campos | **HECHO (forma)** — las 3 plantillas llevan los 9 campos |
| C5 | Datos del PRODUCTOR | **DATOS DE PERSONA FÍSICA, no de la SL** (NIF con forma de DNI) — y el NOMBRE contiene `<`/`>`, caracteres que la validación 1287 de la AEAT **rechaza** |
| C6 | F1 vs F2 (NIF cliente) / tipo de rectificativa | **BLOQUEADO por dictamen (P11)** — constante `MODO_SIN_DESTINATARIO = 'SIN_DICTAMEN'` |
| C7 | Letra de control del NIF | **EXISTE** (`src/core/validation/nifEspanol.ts`) |
| C8 | Saneamiento de los 5 caracteres que rechaza la 1287 | **NO EXISTE** un saneador genérico para ese conjunto de campos (6 regex en la zona, ninguno cubre los 5 caracteres) |
| D1 | Cliente de envío a la AEAT (`sif.client.ts`) | **NO EXISTE** — 0 endpoints SOAP de la AEAT en el código, 0 `Agent`/`pfx`, el fichero no está en el árbol |
| D2 | Sobre SOAP (Envelope/Body) | **SOLO EL CUERPO** — 0 plantillas con `<...Envelope`, 0 `ConsultaFactuSistemaFacturacion` |
| D3 | Cola `VfSubmission` | **NO EXISTE** — 0 modelos del esquema casan con vf\|submission\|remisión\|envío\|cola\|queue |
| D4 | Lectura de respuesta / ritmo / subsanación | **NO EXISTE** — los 6 nombres de `RespuestaSuministro.xsd` (`TiempoEsperaEnvio`, `EstadoRegistro`…) aparecen SOLO en los XSD, 0 en `src/` |
| D5 | Qué gobierna `SIF_ENABLED` hoy | **NO GOBIERNA NINGÚN ENVÍO NI COLA** — sus 4 usos son número de factura y flags de auditoría, ninguno toca envío/remisión/cola |
| D6 | Representación ante la AEAT (Anexo I) | **NO EXISTE** en el esquema ni en `src/` — 0 líneas, 0 literales |
| E1 | Declaración responsable publicada/descargable | **NO EXISTE** en código (0 en `src/`, 0 en `public/`) — el documento SÍ existe como borrador (ver G1) |
| C9 | La anulación se sella desde el producto | **HECHO** — `sellarAnulacionTrasEmision` se llama desde 1 sitio real (`invoicesAdmin.routes.ts:884`), no solo existe |
| H1 | Emisor congelado (SCRUM-665 B) | **DECLARADO Y CON ALTER APLICADO, 0 LLAMADORES** — el PDF sigue leyendo el merchant EN VIVO |
| H2 | ClaveRegimen/CalificacionOperacion en la plantilla VIVA | **HECHO** — `verifactu.service.ts` SÍ las emite vía `buildDetallesDesgloseXml` (guard `scrum209`) |
| H3 | `taxId` en `pdf.service.ts` | **6 accesos en tiempo de ejecución, 0 vía dato congelado** — viene del parámetro que pasa el llamador (en vivo, ver H1) |
| G1 | Documentos de S1-E/G/H en el árbol | `DECLARACION_RESPONSABLE.md` y `PACK_GESTORIA.md` **existen** (borrador); `VERIFACTU_EVIDENCIAS.md` **NO existe** |

## 2 · Lo que depende de CÓDIGO (medido, id del censo entre paréntesis)

**Hecho:** huella con formato oficial y vector AEAT en verde (A1) · lock serializado por merchant
(A2) · encadenamiento `RegistroAnterior` completo (C2) · sello persistido = el del XML (C3) ·
bloque `SistemaInformatico` con sus 9 campos (C4) · letra de control del NIF (C7) · la anulación
se sella desde el producto (C9) · `ClaveRegimen`/`CalificacionOperacion` en la plantilla viva (H2).

**A medias:** QR sin base de pruebas parametrizada (A4) · dos generadores de registro, uno
huérfano (C1) · saneamiento 1287 sin cubrir los campos que hacen falta (C8) · cuerpo SOAP sin
sobre ni consulta (D1, D2).

**No existe:** cliente de envío a la AEAT (D1) · cola de remisión `VfSubmission` (D3, pide ALTER)
· lectura de respuesta/ritmo/subsanación (D4) · gobierno real de `SIF_ENABLED` sobre un envío (D5,
consecuencia directa de D3/D4: no hay nada que gobernar) · representación ante la AEAT en el
esquema (D6, pide ALTER) · declaración responsable publicada en producto (E1) · enganche del
emisor congelado (H1, el código YA EXISTE, solo falta llamarlo).

**Dato fiscal roto, no solo pendiente:** el NOMBRE del productor lleva `<Luis Lara Granado>` — con
los propios `<`/`>` dentro del texto, que la validación 1287 de la AEAT rechaza (C5). No es que
falte dato: el que hay **no pasaría** la validación si se enviara hoy.

## 3 · Lo que depende de FUERA (no es código, J1 no lo construye)

- **La SL y su NIF.** `productor.ts:11-12` lo dice explícito: "la SL está en constitución". Bloquea
  a la vez C5 (productor real), D6 (representación) y, por el Convenio 017 (SCRUM-143: exige
  sociedad mercantil para actuar como colaborador social en el entorno de pruebas), el arranque
  mismo de S1-D. Es el bloqueador con más apalancamiento de todo el mapa — aparece en cuatro sitios
  distintos.
- **Alta en el entorno de pruebas de la AEAT + Convenio 017** (S1-0, SCRUM-143): certificado FNMT
  ya conseguido (15-jun); falta el alta y el convenio, y el convenio exige la SL de arriba.
- **Revisión del asesor (S1-F).** Medido: **ninguna pregunta de `PREGUNTAS_ASESOR.md` consta
  contestada** (0 coincidencias de "contestad/respondid/RESUELT"). Bloquea C6 (F1 vs F2), el modo
  de rectificativa, anticipos (SCRUM-142) y la cláusula de la declaración responsable (S1-E).
- **Declaración responsable con datos reales** (S1-E): el documento existe como borrador con
  placeholders; falta el dato de la SL y la revisión del asesor de arriba.
- **Evidencias E2E y paso a producción AEAT** (S1-G): `docs/VERIFACTU_EVIDENCIAS.md` no existe;
  depende de que exista primero el envío (D1-D4).

## 4 · El orden, con STOP marcado

Regla que gobierna casi toda esta lista: **cualquier cambio a `verifactu.service.ts`,
`registro.builder.ts` o `productor.ts` es STOP de un jefe** (regla 38/40 — es el camino de
emisión), aunque el cambio sea pequeño. Se marca en cada paso.

1. **[EXTERNO, ya en marcha]** Avanzar la SL + su NIF. Nada de código depende de J1 aquí; es la
   dependencia de mayor apalancamiento (desbloquea 2, 6 y 7).
2. **[PREGUNTA, no requiere código]** Validar con la AEAT/el asesor si el cliente SOAP de pruebas
   se puede empezar a ejercitar con el certificado del **productor sobre su propio NIF**, sin
   actuar todavía como colaborador social — si la respuesta es sí, D1/D2 se pueden construir y
   probar ESTA SEMANA sin esperar meses a la SL. Sigue **[VALIDAR]**, sin medir: es un hecho de
   fuera, no de código.
3. **[CÓDIGO, STOP]** Construir `sif.client.ts` (D1: mTLS + endpoint SOAP) y completar el sobre
   (D2: Envelope/Body + `ConsultaFactuSistemaFacturacion`). Es código NUEVO que no toca las
   funciones de sellado existentes, pero vive en la zona fiscal: pide GO igualmente.
4. **[CÓDIGO + ALTER, STOP]** Diseñar y crear la cola `VfSubmission` (D3): decisión de forma
   (`docs/master/SCRUM-524.md` §⑤ tiene las opciones) → ALTER aditivo que aplica Javier (J1 no
   toca `schema.prisma`) → código de estados/reintentos (D4) → cablear `SIF_ENABLED` para que
   pause/reanude de verdad (D5, hoy no gobierna nada porque no hay nada que gobernar).
5. **[EXTERNO]** Cerrar con el asesor las preguntas de `PREGUNTAS_ASESOR.md` (0 contestadas hoy),
   empezando por las que bloquean código: F1/F2 sin NIF (C6), modo de rectificativa, anticipos.
6. **[CÓDIGO, STOP, decisión de jefe]** Sustituir los datos del productor por los de la SL (C5,
   D6) en cuanto exista — incluye corregir el NOMBRE con `<`/`>`, que hoy rechazaría la 1287.
7. **[CÓDIGO, STOP, decisión de jefe — ya en la cola como SCRUM-665]** Enganchar el emisor
   congelado (H1): el escritor, el lector y el ALTER YA EXISTEN; falta que Javier elija entre las
   opciones A/B/C/D de `docs/master/SCRUM-665.md` — cambia la firma de `crearFacturaEmitida` en
   los 10 sitios que hoy llaman `sellarTrasEmision` (C9), así que aunque el código esté escrito,
   engancharlo es STOP.
8. **[CÓDIGO, STOP, decisión de jefe — ya en la cola como SCRUM-735]** Decidir si el reloj/huso
   del registro debe dejar de ser el LOCAL del proceso (confirmado en A3) y pasar a uno explícito.
9. **[EXTERNO]** Publicar la declaración responsable con datos reales (S1-E) y armar el pack de
   evidencias E2E (S1-G) — ambos detrás de 1, 5 y 6.
10. **[Solo con 1-9 cerrados]** `INVOICING_ES_ENABLED` a reales (regla 7) — y solo entonces, porque
    hoy la leyenda VERI\*FACTU del PDF depende de la huella (`isVF`), no de la remisión (A5):
    encenderlo antes de que exista el envío pintaría la leyenda sobre facturas que nunca se
    remitieron a nadie.

## 5 · Las 3 cosas de esta semana

1. **Pedir a Javier la decisión de SCRUM-665 (H1).** Es la de menor coste de las STOP: el código
   (escritor + lector) y el ALTER ya están aplicados en las tres bases; solo falta elegir cómo
   engancharlo. Protege la regla 29 en cuanto haya facturas reales — sin esto, el PDF de una
   factura YA EMITIDA sigue cambiando si el merchant edita su perfil.
2. **Hacer la pregunta del punto 2 del orden** (¿se puede probar el cliente SOAP con el
   certificado del productor sobre su propio NIF, sin esperar a la SL?) — si la respuesta es sí,
   desbloquea empezar D1/D2 esta misma semana en paralelo a la SL, que es el camino más largo.
3. **Insistir en el avance de la SL + su NIF.** Aparece como bloqueador en C5, D6, el Convenio 017
   (SCRUM-143) y, en cascada, en casi todo S1-D. Es el único ítem de este mapa que bloquea a la vez
   código y trámite externo.

## 6 · Corrección de hallazgos propios (A9 — lo que mi traspaso anterior daba por cierto y no lo era)

- **FALSO hoy:** mi traspaso del 18-sep decía "faltan `ClaveRegimen`/`CalificacionOperacion` en las
  plantillas vivas de `verifactu.service.ts`". Medido con AST (H2): la plantilla viva SÍ las emite,
  vía `buildDetallesDesgloseXml` (compartida con `registro.builder.ts`, único constructor desde
  SCRUM-209, con guard `tests/scrum209-un-solo-desglose.test.mjs`). Era un hallazgo de una lectura
  anterior, sin medir por AST, y quedó desactualizado: no se cita más como pendiente.
- **Confirmado y ampliado:** "dos generadores del registro de alta/anulación" seguía siendo cierto,
  pero medirlo con AST reveló algo que la nota de traspaso no decía: los de `registro.builder.ts`
  tienen **0 llamadores desde `src/`** — código muerto en producción, no solo redundante (C1).
- **Nuevo, no estaba en ningún traspaso:** el emisor congelado (SCRUM-665 B) tiene su ALTER
  aplicado y su código escrito, con 0 llamadores (H1) — el mismo patrón de "declarado pero no
  enganchado" que ya se había visto en el cliente congelado (SCRUM-729).

## 7 · Qué NO medí (A9, declarado)

- No comprobé si `docs/legal/PREGUNTAS_ASESOR.md` sigue teniendo el mismo contenido que cuando se
  escribió `lista-de-partida.md` (18-sep); solo repetí el mismo grep (0 contestadas) sobre
  `origin/main` de hoy.
- No verifiqué en rojo el resto de controles positivos del censo, solo el de `A1` (vector AEAT).
  Los otros 24 dieron `>0` en la corrida sobre `origin/main`, que es la comprobación que pide la
  tarea, pero no fabriqué un ref negativo para cada uno.
- No abrí `docs/legal/AUDITORIA_CAMINO_EMISION.md` ni `docs/AUDITORIA_RRSIF.md` completos línea a
  línea; me apoyé en las citas que ya trae `SIF_SPEC_NOTES.md`, la skill `yaqu-verifactu-sif` y
  `lista-de-partida.md` (18-sep, sin medir contra código en su momento, señalado como tal ahí).
- No he tocado `prisma/schema.prisma` en ningún momento (ni para D3 ni para D6): quedan como
  "pide ALTER" sin diseño de columnas, que no es tarea de este ticket.
- El valor real del NIF del productor **no se ha copiado a ningún expediente** (es de una persona
  física) — solo su FORMA (persona física/DNI), igual que en el censo.

## 8 · Reproducir esta medición

```
cd cobroflash-jv1
node docs/master/evidencias/SCRUM-955/censo-sif1.mjs . origin/main
```

Debe dar `FILAS=25 · CIEGAS=0 · EXIT=0`. Para ver el mecanismo fallar de verdad:
`docs/master/evidencias/SCRUM-955/_fabricar-ref-rojo.mjs` construye el commit fabricado descrito
en §0 (instrucciones de uso en su cabecera).
