# SCRUM-915 · Dirección de diseño (boceto en texto, Sesión 4, 17-sep-2026) — AÚN SIN PROTOTIPO

Punto de partida para el prototipo navegable. Nada construido; nada aprobado.

## Fuentes que manda
DESIGN.md (tokens: brand #16a34a, ink #0f1c17, body #3f4a45, muted #6b756f, bg #f6f7f5, border #e7e9e5; Inter; radios 8/12/16/22/full; sombras Reposo/Elevado/Flotante/Foco; Una Sola Voz; Regla del Importe) · Parte AB del máster (AB3: `.quote-line`, `.quote-total-kpi` sticky <768, hoja de ajustes con `.modal-overlay`, `overflowMenu`, fichas de plantilla máx 3, borde discontinuo SÓLO para «+ Añadir línea») · ticket SCRUM-915 (5 decisiones) · `inventario-hoy.md` · SCRUM-906 fase 1 (`docs/master/SCRUM-906.md`: no describe cómo son los editores de Holded/PresupuestAPP por dentro; la S0 lo iba a pasar — no inventar nada de la competencia).

## Entregable
`docs/prototipos/SCRUM-915/editor-presupuesto.html`: un solo fichero, vanilla, tokens de DESIGN.md en `:root`, sin dependencias. Pestañas «Prototipo» e «Inventario» (antes → después por lista). Interruptor «Presupuesto | Justificante». Textos nuevos marcados (clase `.propuesto`, subrayado ámbar) y con leyenda; todo texto que ya existe se reutiliza LITERAL. Medido con puppeteer-core + Chromium local (`%LOCALAPPDATA%/ms-playwright/chromium-1223`) a 390 y 1280 px: sin scroll horizontal, targets ≥44 px, contraste AA; capturas en `docs/prototipos/SCRUM-915/capturas/`.

## Escritorio (≥1024 px): la HOJA
- Riel izquierdo (~260 px): pasos ① Para quién → ② Qué trabajo es → ③ Importes → ④ Condiciones → ⑤ Enviar, con estado (hecho/actual/pendiente), clicables; debajo KPI total, CTA, «Opciones», «💾 Guardar como plantilla», «Limpiar formulario», «✓ Guardado automáticamente».
- La hoja (papel blanco, proporción documento) ES el editor: cabecera con datos de empresa + «PRESUPUESTO», nº «se asigna al generar», fecha y «Válido hasta»; bloque «Para» (combobox cliente con «+ Nuevo cliente»); tabla de líneas editable en sitio (concepto/cant./precio/ficha IVA/total, «⋯» con Ajustes/Subir/Bajar/Eliminar, autocompletado); totales abajo a la derecha (suma, descuento, base, IVA, TOTAL Display); pie «Condiciones» (forma de cobro en fichas, tramos, formas de pago con la nota del 0,9 %, validez con 7/14/30).
- ② con la hoja sin líneas: dentro de la propia hoja un COMPOSITOR de IA grande («Descripción del trabajo», 🎤 si hay voz, «✨ Generar sugerencias»); debajo fichas de plantilla, «Tus conceptos más usados» y «Escribir a mano». Sugerencias con checkbox y aviso de «supuestos» (que hoy se pierde al insertar: mantenerlo visible en la línea).
- Una Sola Voz: mientras no hay líneas el verde lo lleva «✨ Generar sugerencias»; con cliente + línea válida lo pasa a «Generar presupuesto».
- ⑤: hoja de revisión = modal de hoy (WhatsApp primaria, email, PDF, «Seguir editando»; variante pendiente de aprobación).

## Móvil (390 px): POR PASOS
Barra superior «Paso N de 5 · <nombre>» con puntos; una sección por pantalla; barra inferior fija con el total y «Continuar» (último paso: la hoja completa en lectura + envío).

## «Opciones» (hoja inferior en móvil, modal en escritorio)
IVA por defecto · IVA del presupuesto · Dirección de la obra (+ Personalizada) · Datos del cliente en el documento (4 + Razón social/Nombre comercial) · Incluir descripción en el PDF.

## Justificante (mismo editor)
Pasos ① ② ③ ④ Emitir; sin Condiciones/Envío, sin descuento global ni pactados, ajustes sólo «IVA %», Opciones sólo «IVA por defecto»; CTA accionPrimaria(); al emitir, aviso y a la ficha.

## Defectos de hoy que el diseño debe resolver (del inventario)
Vista previa no interactiva y que miente (pie de 30 días fijo, sin Dto. por línea, sin validez); totales DESPUÉS de condiciones; «Limpiar» que no limpia todo y sin confirmar; Generar dos veces crea dos presupuestos; «supuestos» de la IA perdidos; plantilla que pierde descripción/Dto./suplido/coste; «Dto. %» e «IVA del presupuesto» sin oyente; tecla N que abre la Cotización rápida encima; 4 marcadores visibles.

## ⛔ Límites
Ninguna cifra cambia (cuenta 887/888). Textos nuevos: se proponen y se PARA. Sin framework. IA: la gratis actual (SCRUM-912). El orquestador publica el prototipo y el fundador lo aprueba ANTES de construir (construye la S2).

---

## v2 (17-sep-2026) — tras la opinión del fundador (SCRUM-915 comentario 15790)
«Mola, pero sigue siendo un poco lioso… La IA es una opción, no lo pongas lo primero… la vista previa ahora parece
rota, no se va creando. Molaba más a un lado, pero moderno y pulido.»

- Escritorio en DOS columnas: izquierda, pasos con SOLO el actual abierto (los hechos, una línea con «Cambiar»; los
  pendientes, sólo el título); derecha, el DOCUMENTO VIVO fijo con aspecto de PDF que resalta la zona que se edita.
- Presupuesto: Cliente → Conceptos → Condiciones → Revisar y enviar. Justificante: Cliente → Conceptos → Revisar y emitir.
- Conceptos: UNA línea lista para escribir + «+ Añadir línea»; «📋 Usar plantilla», «✨ Sugerir con IA» y «+ Añadir
  descuento» como secundarias discretas; «Tus conceptos más usados» dentro del desplegable del concepto; la ficha de
  IVA sólo aparece si la línea no va con lo de siempre.
- Condiciones ya elegidas: tres filas resumen (cobro, formas de pago, validez), cada una con «Cambiar».
- Opciones y «⋯» (Guardar como plantilla, Limpiar formulario) arriba del editor.
- Móvil: los mismos pasos, barra inferior con el total, «Ver documento» y «Continuar».
