# El asistente «Sugerir con IA» deja de nombrar a Claude — SCRUM-1247

**Aprobado por el orquestador por delegación del fundador** el 28-sep-2026 — SCRUM-1247 comentario 17425.

Opción **A** del expediente de J4 (`docs/master/SCRUM-1247.md` §4): sin marca, dice qué sale y que sale fuera.

## Textos aprobados, literales

> Describe el trabajo con tus propias palabras y la IA te sugerirá las líneas del presupuesto usando tu catálogo. Lo que escribas aquí y tu catálogo se envían a nuestro proveedor de IA (lo tienes en la política de privacidad); no incluyas datos de tu cliente que no hagan falta.

> Describe el trabajo y la IA te sugiere las líneas del presupuesto

## Dónde se pinta

| ranura | dónde | texto aprobado | qué sustituye |
|---|---|---|---|
| R1 | `public/dashboard/js/aiQuoteAssistant.js`, `openAiSuggestModal`: el párrafo de ayuda del modal «Sugerir con IA» (lo abren `quotesView` y `homeView`) | «Describe el trabajo con tus propias palabras y la IA te sugerirá las líneas del presupuesto usando tu catálogo. Lo que escribas aquí y tu catálogo se envían a nuestro proveedor de IA (lo tienes en la política de privacidad); no incluyas datos de tu cliente que no hagan falta.» | «Describe el trabajo con tus propias palabras y Claude sugerirá las líneas del presupuesto usando tu catálogo de productos.» |
| R2 | `public/dashboard/js/quotesView.js`, `aiBtn.title`: el tooltip del botón «✨ Sugerir con IA» | «Describe el trabajo y la IA te sugiere las líneas del presupuesto» | «Describe el trabajo y Claude sugiere las líneas del presupuesto» |

## Por qué

El texto viejo decía que escribe Claude (Anthropic). J4 lo midió ejecutándolo: con `GEMINI_API_KEY`
puesta redacta siempre Google, también con las dos claves, y Anthropic solo entra si esa clave falta.
El rótulo le decía al profesional a qué empresa van su presupuesto y los datos de su cliente, y nombraba
a la equivocada. La opción A no nombra la marca, así que no se desfasa si cambia la configuración. El
nombre del encargado queda en la política de privacidad.

## Lo que NO se firma aquí

- **R3**, «Claude redactará un mensaje personalizado…» (`aiQuoteAssistant.js`, `openAiMessageModal`):
  ese modal no lo abre ninguna pantalla. Depende de que SCRUM-1182 decida si se enchufa o se retira, y
  no se toca.
- **L1′ y L2′**, de la política de privacidad publicada: van al fundador, no a esta delegación.
