# SCRUM-955 · lista de partida (A MEDIAS — NO es el expediente)

18-sep-2026 ~16:05Z · origin/main `17b0c86b84fb0544013923314d250d7181d913db` · J1 (`jv-j1`, 3.ª sesión).
Cortado por CIERRE ORDENADO del orquestador (cuenta al 97 % semanal). **Nada de esto está medido
contra el código todavía**: es lo que los DOCUMENTOS y Jira dicen, reunido para no volver a leerlo.
El instrumento que lo mide es `censo-sif1.mjs` (al lado), **escrito y NO corrido**.

## Jira, leído a las ~15:55Z

- SCRUM-955: En curso, asignado a Javier, `area-j1` + `equipo-javier` (comentario 15954 «lo coge J1»).
- SCRUM-143 (Convenio 017): Acción del fundador. Literal de la AEAT: el 017 **exige sociedad
  mercantil**; y «en tanto que no se obtenga la condición de colaborador social NO SE PODRÁ ACTUAR COMO
  TAL EN EL ENTORNO DE PRUEBAS […] remitiendo información de registros de facturación correspondientes
  a terceras personas». Plazo «podría ser de un mes», no garantizado. Decisión del fundador 24-jul:
  SL + 017 (Modelo A); mientras, maquinaria sin bloquearse (Modelo C).
- SCRUM-870: Acción del fundador. `VERIFACTU_PRODUCTOR_NOMBRE` es un marcador que empieza por `<` y
  acaba en `>`; la validación 1287 de la AEAT rechaza `<`, `>`, `"`, `'`, `=` (comentario 15926).
  Plan de la S1: candado + nombre real EN EL MISMO PR, cuando exista la SL.
- SCRUM-523 (declaración responsable), 665 (PDF regenerado), 735 (reloj del proceso), 825: Tareas por
  hacer. SCRUM-524, 534, 142, 612: Acción del fundador.

## Máster (U1.3 y línea 959)

S1-0 🟡 (cert FNMT ✅ 15-jun; falta alta en pruebas AEAT + asesor) · S1-0b ✅ · S1-A ✅ · S1-B ✅ ·
S1-C ✅ · S1-D «✅ DECIDIDO 16-sep: COLABORADOR SOCIAL» (decidida la vía, NO construido) · S1-E 🟡 ·
S1-F ⏳ · S1-G ⏳ · S1-H 🟡. Done de S1-D: ≥10 registros aceptados consecutivos en pruebas.

## Lo que dicen los documentos (lector 1: externos)

- **Externo, del jefe:** SL + su NIF (productor.ts:11-12 «la SL está en constitución») · Convenio 017
  (SCRUM-143) · declaración responsable firmada (DECLARACION_RESPONSABLE.md:3-4, 17 placeholders
  `[…]` entre :23 y :100) · alta en entorno de pruebas (PENDIENTES_FUNDADOR.md:194-195) · asesor:
  **ninguna pregunta de PREGUNTAS_ASESOR.md consta contestada** (grep «contestad|respondid|RESUELT» = 0)
  · revisión S1-F (300-600 €, PREGUNTAS_ASESOR.md:71) · pack gestoría (PACK_GESTORIA.md:4).
- **Preguntas al asesor que esperan código:** 1 (representación; el máster ya la da por decidida y
  PREGUNTAS_ASESOR.md:14-21 y SIF_SPEC_NOTES.md:68,131 no lo reflejan), 2/B2 (productor autónomo vs SL),
  3/B3 + P11.1-4 (sin NIF del cliente: art. 61.d vs F2 — `MODO_SIN_DESTINATARIO`), 4 (rectificativa S/I),
  5 (cláusula de la DR), 8 + P1 (anticipos, SCRUM-142), 12 (requisitos del alta en pruebas), P12 (suplidos),
  P13 (recargo de equivalencia), P16 (qué TipoFactura por tipo interno), 14-16 (exenciones, ISP, no sujeción).
  Forales: 0 preguntas (grep foral|Bizkaia|Gipuzkoa|Araba|Navarra|TicketBAI).
- **Contradicciones:** EMAIL_ASESOR.md:38 dice «12 preguntas» y el documento tiene muchas más; el
  máster decide «colaborador social», que exige el 017, que exige la SL, que no existe.

## Lo que dicen los documentos (lector 2: código pendiente)

- Estado «aceptado con errores» sin sitio donde escribirse: SCRUM-524.md:228-238, opciones (a) campo /
  (b) entidad `VfSubmission` (recomendada) / (c) no representarlo. Pide ALTER.
- Cola `VfSubmission` y cliente SOAP/mTLS: inexistentes (AUDITORIA_CAMINO_EMISION.md:143).
- `Subsanacion` / `RechazoPrevio` / `SinRegistroPrevio`: solo en los XSD.
- Saneamiento 1287: el saneador protege `NumSerieFactura` (`src/core/validation/fiscalInput.ts`), no
  `concept` (`schemas.ts`, `z.string().min(1)`) ni el bloque SistemaInformatico (SCRUM-524.md:139-163).
- SCRUM-735: fecha-hora de la huella del reloj del PROCESO → STOP; SCRUM-524.md:169-180, sin referencia
  horaria externa.
- SCRUM-665: `congelarEmisor` (emisorCongelado.ts:104) con 0 llamadores; enchufarlo cambia la firma
  de `crearFacturaEmitida` en 10 sitios (STOP) y espera: ¿la R1 hereda el emisor de la original?
  (665.md:1077-1089); decisión A/B/C/D (665.md:143-166).
- SCRUM-729: el NIF del cliente no se imprime en el PDF (pdf.service.ts:252).
- SEMAFORO_CALIBRACION §7.2: `ClaveRegimen`/`CalificacionOperacion` (1245/1195) — verificar en el
  export vivo; §8: cuatro preguntas de gravedad para un jefe.
- SCRUM-825 ⓪: ¿se deroga la regla 24 y se generaliza `INVOICING_ES_ENABLED`?
- 524.md mide 14 de 41 validaciones del catálogo AEAT cubiertas: «S1-C ✅ completo» del máster
  (:1038) certifica un alcance más estrecho (el XSD) que la palabra.

## Pistas mías, SIN medir todavía

- `registro.builder.ts` avisa de que `buildRegistroAlta`/`buildRegistroAnulacion` NO los llama
  producción; el XML vivo se genera con plantillas propias en `verifactu.service.ts` (~:758 y ~:853).
  Dos generadores por tipo de registro: C1 del censo lo cuenta.
- `construirCuerpoSoapRegFactu` (registro.builder.ts:597) existe: el CUERPO del mensaje SOAP está
  escrito; falta el sobre, el cliente, la cola y la respuesta.
- La leyenda «Factura verificable en la sede electrónica de la AEAT» se pinta con `isVF = !!params.vfHash`
  (pdf.service.ts:293, :664): depende de tener HUELLA, no de haberse REMITIDO. A5 del censo lo mide.
  Consecuencia para el orden: encender `INVOICING_ES_ENABLED` antes de que exista el envío pintaría la
  leyenda sobre registros que no han ido a ninguna parte → el envío va ANTES que la primera factura real.
- La prueba en el entorno de pruebas COMO COLABORADOR está bloqueada por el 017 (cita de SCRUM-143);
  queda por comprobar, [VALIDAR con la AEAT/asesor], si el cliente SOAP se puede probar antes con el
  certificado del productor sobre SU PROPIO NIF (sin terceros). Si sí, S1-D deja de esperar a la SL.
