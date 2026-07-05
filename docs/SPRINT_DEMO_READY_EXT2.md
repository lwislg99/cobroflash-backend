# SPRINT DEMO-READY · EXTENSIÓN 2 (Olas 7-9)
### Continuación de SPRINT_DEMO_READY.md + _EXT.md — Olas 1-6 completadas ✅

> **📌 ESTADO DE EJECUCIÓN (lo mantiene Claude Code):**
> **A7.1 ✅ (5-jul, `8044eb6`):** `voiceInput.js` con el plan aprobado (gate estático flag+API+https+
> no-iOS-PWA → humo con watchdog 3 s en el 1er tap → errores en caliente humanos; interim gris,
> final appendeado, siempre editable). Montado en "Sugerir con IA" (formulario) y botón "🎤 Dictar
> el trabajo" en Cotización rápida (vuelca líneas al QQ). `/admin/me` expone `voiceEnabled`
> (`VOICE_QUOTE_ENABLED`, flag de la tabla P, OFF — activación fundador en PENDIENTES). CSS AB6
> (target 44 px, pulso con reduced-motion). `docs/VOZ_MATRIX.md`: degradación verificada en headless
> (API existe, servicio no arranca → humo la retira con toast); camino feliz = 3 móviles reales del
> fundador. Evidencias: `docs/evidencias/ext2/a71-*` (390 flag OFF = cero cambio; 390+1280 flag ON =
> micro en modal y QQ). Con el flag OFF producción queda EXACTAMENTE igual que antes.
> **A7.2 🟡 parte 1 (`d77778f`):** prompt de dictado (muletillas/sinónimos de obra/qty habladas/
> precio dictado/anti-invención) + `scripts/voice-eval.mjs` (10 transcripciones aprobadas, gate
> ≥8/10 con ≥80 % líneas o exit 1; modo remoto contra el endpoint desplegado — la API key vive solo
> en Railway). Falta: correr el eval contra prod y commitear resultados (parte 2).

**Criterio de esta extensión (importante):** NO se abre backlog U2 (gate 25 pagantes,
regla 13). Todo lo de aquí es (a) trabajo F1 legítimo de la cola U1 que aún no se había
ejecutado, (b) endurecimiento de lo ya construido, o (c) pulido de demo. Nada nuevo
inventado fuera del master.

**Mismas reglas de siempre:** una tarea = un commit = verificación en yaqu.app + evidencias
Playwright (390px y 1280px) en docs/evidencias/. Prisma aditivo. Flags nuevas OFF.
Prohibido: claims fiscales fuera del guion H2, tocar `INVOICING_ES_ENABLED`, U2 sin gate.

---

## OLA 7 — VOZ-1: cotización por VOZ (U1 #5 — el WOW que faltaba)

> Es LA escena del vídeo de 60s ("dictas el presupuesto en la furgoneta") y la respuesta a
> la objeción "no tengo tiempo de aprender" → "la primera la hacemos juntos DICTANDO".
> Es F1 puro (U1.5), no salta ningún gate. Spec completa en master U1.5.

**A7.1 `[CC]` — VZ-1 Captura de voz.**
`public/dashboard/js/voiceInput.js` (webkitSpeechRecognition, lang del locale) en Quick
Quote y en el formulario de presupuesto. Transcript SIEMPRE a textarea editable (la voz
propone, el humano corrige). Detección de soporte: sin soporte (Safari iOS errático →
probar de verdad) se oculta el micro y queda el textarea — degradación silenciosa, jamás
un botón roto. Matriz de compatibilidad en `docs/VOZ_MATRIX.md` (Chrome Android x2,
desktop, Safari iOS; micro/permisos/https/ruido).

**A7.2 `[CC]` — VZ-2 Pipe texto→líneas + evaluación.**
Texto dictado → endpoint `ai/suggest-quote` con prompt ajustado a habla coloquial de obra
("ponme dos puntos de luz y la manguera esa de 20") → líneas propuestas con match contra
el catálogo del merchant. Y el gate de calidad del master es obligatorio:
`scripts/voice-eval.mjs` con 10 transcripciones fijas → **≥8/10 con ≥80% de líneas
correctas**, resultados commiteados en el repo. Si no pasa, se itera el prompt, no se
enseña en demo.

**A7.3 `[CC]` — VZ-3 Telemetría + rollback.**
Evento `quote_created_via='voice'|'text'` (la columna ya existe de V0-3). Rollback limpio:
si la IA se apaga (flag), el dictado sigue sirviendo como texto plano.

**A7.4 `[CC]` — Voz en la demo.**
Integrarla en el guion: chip/escena en la maqueta A4.7 SOLO si pasa el eval de A7.2 (la
maqueta solo enseña lo real). Añadir al seed 1-2 transcripciones de ejemplo para ensayo.

✅ **Gate Ola 7:** dictas "cambio de termo de 80 litros y desplazamiento" en un Android
real y salen las líneas correctas con precios del catálogo. Eval ≥8/10 en repo.

---

## OLA 8 — Bot de WhatsApp nivel profesional (endurecer BOT-1, sin abrir BOT-2)

> El bot ya funciona E2E. Esta ola lo lleva de "funciona" a "da gusto usarlo", SIN tocar
> el límite del master (K1): nada de IA conversacional (eso es BOT-2, gateado K2), nada
> de precios/plazos/fiscal, texto libre → reenseñar menú → 2ª vez handoff.

**A8.1 `[CC]` — Pulido conversacional dentro de K1.**
Revisión completa de todos los copys del bot (tono cercano-profesional, brand YaQu, sin
jerga técnica), emojis con criterio, formato de listas Meta impecable, mensajes de error
humanos. Tabla de todos los mensajes del bot en docs (fuente única) para revisarlos de
una pasada.

**A8.2 `[CC]` — Robustez de sesión y bordes.**
- Expiración de `BotSession` limpia (retomar tras días = menú fresco, no estado zombi).
- Doble tap del mismo botón / botones de mensajes viejos → respuesta idempotente digna.
- Cliente con varios presupuestos vivos → lista clara y elegir.
- Mensajes no soportados (audio, imagen, ubicación) → respuesta amable + menú (sin crash).
- Concurrencia: dos webhooks del mismo user casi simultáneos no duplican respuesta.

**A8.3 `[CC]` — Handoff premium.**
Cuando el bot pasa a humano ("Hablar con [Negocio]"): mensaje al cliente con expectativa
("Le aviso ahora mismo, te responde en breve") + WhatsApp al profesional con CONTEXTO
(quién, qué presupuesto, último paso del flujo) + bot mudo 24h para ese número (ya specd)
+ registro para que el pro vea en el BO los handoffs pendientes.

**A8.4 `[CC]` — Suite de pruebas del bot.**
Script de test del flujo completo contra el webhook (simulando payloads reales de Meta):
menú → ver presupuestos → pagar pendiente → pedir presupuesto → handoff → opt-out "BAJA".
Corre en local/CI sin gastar mensajes reales. Es la red de seguridad para tocar el bot
sin miedo en el futuro.

✅ **Gate Ola 8:** un tercero (no tú) usa el bot desde su móvil sin instrucciones y no
encuentra ningún callejón sin salida. La suite de pruebas pasa en verde.

---

## OLA 9 — GTM-1 etapa 2 + QA total pre-demo (cerrar el círculo)

**A9.1 `[CC]` — Atribución UTM en el registro (de GTM-1, U1.7).**
Capturar `utm_source/medium/campaign` (+ referrer) al aterrizar en la landing → persistir
→ escribir en `acquisitionSource` del merchant al registrarse (columna ya existe de V0-3).
Con 20 demos en marcha, saber QUÉ canal trae cada alta vale oro y cuesta poco.

**A9.2 `[CC]` — Vista funnel en el BO owner.**
Completar la vista de V0-3: registros por fuente, activados (1er presupuesto), 1er cobro.
Solo lectura, solo owner. Es tu cuadro de mando de la campaña de demos.

**A9.3 `[CC]` — Fair-use WhatsApp visible (de PRECIOS-1, parte no-Stripe).**
Contador de plantillas/mes del merchant visible en Configuración con la política W2
(soft 300/mes: aviso, nunca corte). El código de topes de A3.2 ya cuenta; esto lo hace
transparente al usuario — y en demo responde a "¿y si mando muchos?".

**A9.4 `[CC]` — Accesibilidad y detalle fino del flujo cliente.**
Pasada AB6 (checklist visual del master) sobre las páginas del CLIENTE final (firma, /pay,
recibo, reseña): foco visible, contraste AA, targets táctiles ≥44px, textos de error
humanos, `prefers-reduced-motion` respetado. El cliente final es quien más variedad de
móviles trae — y quien firma y paga.

**A9.5 `[CC]` — QA total de regresión + evidencias finales.**
Gran barrido Playwright de TODO (BO completo + flujo cliente + landing + bot vía suite
A8.4): evidencias fechadas en docs/evidencias/pre-demo/, lista de hallazgos, fix de P0/P1.
Actualizar QA_MASTER.md con el estado. Este es el cierre del sprint: después de esto,
SOLO quedan tareas del fundador (Carril 0, ensayo, calle).

✅ **Gate Ola 9:** checklist DEMO-READY completa al 100% en lo que depende de código.
Zero known P0/P1. El repo cuenta la historia con evidencias.

---

## LO QUE NO ENTRA (y por qué — para que Claude Code no se lo invente)
- **BOT-2 / IA conversacional en el bot** → gate K2 (BOT-1 estable 30 días + >50 conv/mes).
- **PERFIL-1, MANT-1, MEDIA-1 (fotos), JOB-1, DASH-PREMIUM-1, ONBOARD-2** → U2, gate 25
  pagantes (regla 13). Se re-priorizan con datos reales, no antes.
- **Facturación/VeriFactu** → SIF-1 sigue su curso con asesor/AEAT (tareas humanas).
- **Cualquier rediseño total** → prohibido por el master (AB: pulido pantalla a pantalla).

## ORDEN RECOMENDADO
Ola 7 completa (es el mayor WOW pendiente) → Ola 8 → Ola 9 (A9.5 SIEMPRE lo último).
Si el fundador activa mientras tanto flags/WABA/Stripe (PENDIENTES_FUNDADOR), verificar
esas activaciones tiene prioridad sobre la ola en curso.

## PENDIENTES DEL FUNDADOR (recordatorio, nada de esto es de Claude Code)
Rotar `WHATSAPP_ACCESS_TOKEN` (expuesto) · FASE B WABA producción (SIM/Meta) · webhook
Connect en Stripe + `STRIPE_CONNECT_WEBHOOK_SECRET` + flags · `EMAIL_FROM` en Railway ·
Stripe precios LIVE (V0-4) · bug-bash 3 dispositivos (V0-5) · asesor (SIF/legal) ·
vídeo 60s + calle (V0-6) · ensayo del guion 90s ×3.
