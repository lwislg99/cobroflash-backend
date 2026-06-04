---
name: YaQu
description: SaaS WhatsApp-first para cobrar antes de empezar — claridad de fintech, calidez de oficio.
colors:
  brand: "#16a34a"
  brand-bright: "#22c55e"
  brand-ink: "#052e16"
  brand-tint: "#ecfdf5"
  ink: "#0f1c17"
  body: "#3f4a45"
  muted: "#6b756f"
  bg: "#f6f7f5"
  surface: "#ffffff"
  border: "#e7e9e5"
  positive: "#16a34a"
  danger: "#dc2626"
  warning: "#b45309"
  info: "#2563eb"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(1.9rem, 4vw, 2.75rem)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.04em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "#15803d"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "11px 13px"
---

# Design System: YaQu

## 1. Overview

**Creative North Star: "El recibo de confianza"**

YaQu se siente como el momento en que un buen profesional te entrega un presupuesto claro y te da la mano: serio porque hay dinero de por medio, pero cercano porque lo entiendes a la primera. Tomamos la **claridad y jerarquía impecable de Stripe** (una acción principal por pantalla, tipografía que manda, alineación perfecta, aire que respira) y la **calidez y confianza de pago de Wise/Mercado Pago** (verde vivo pero contenido, neutros con un punto cálido, copy humano). Es un producto luminoso, nunca oscuro.

Rechaza explícitamente el aspecto de **plantilla genérica / Bootstrap / "hecho por IA"**: nada de cards grises planas idénticas, sombras duras, azul Bootstrap ni espaciados a ojo. Rechaza la **saturación**: el degradado verde→cian es un acento de marca (logo, momento WOW), jamás un fondo omnipresente. Y rechaza lo **frío e impersonal**: los neutros llevan una pizca de verde/calidez, no gris azulado de oficina.

Está pensado para el **pulgar en una obra y a pleno sol**: una columna, targets generosos, lo importante arriba, contraste alto. Densidad media-baja: preferimos una pantalla que respira a una llena de datos.

**Key Characteristics:**
- Claridad de fintech: una acción principal, jerarquía tipográfica fuerte.
- Verde de marca contenido (acento, no fondo).
- Neutros cálidos, superficies blancas, luz.
- Sombras suaves y estratificadas (profundidad sutil, nunca dura).
- Mobile-first real, accesible (AA), legible a pleno sol.

## 2. Colors

Una paleta luminosa anclada en un verde de confianza, sobre neutros cálidos casi imperceptibles.

### Primary
- **Verde Confianza** (#16a34a): color de acción — botones primarios, enlaces, foco, acentos de estado positivo. Sobre blanco con texto blanco para CTAs. Es el único color que "manda".
- **Verde Vivo** (#22c55e): solo para el degradado de marca (logo, momentos de celebración) y micro-acentos. No es color de texto ni de fondo de página.
- **Verde Tinta** (#052e16): texto sobre superficies verde claro y sobre el degradado de marca.

### Secondary
- **Verde Tinte** (#ecfdf5): fondos de realce suaves (badges positivos, banners de éxito, hover de acento).

### Neutral
- **Tinta** (#0f1c17): titulares y cifras importantes. Casi negro con una gota de verde — cálido, nunca el negro puro ni el slate azulado.
- **Cuerpo** (#3f4a45): texto de párrafo. Cumple ≥4.5:1 sobre blanco y sobre el fondo cálido.
- **Apagado** (#6b756f): metadatos, ayudas, placeholders (en superficies blancas mantiene 4.5:1).
- **Fondo** (#f6f7f5): lienzo de la app — blanco cálido, no gris frío.
- **Superficie** (#ffffff): cards, inputs, modales.
- **Borde** (#e7e9e5): divisores y contornos de 1px. Cálido y discreto.

### Semantic
- **Peligro** (#dc2626) · **Aviso** (#b45309, ámbar para "pendiente de aprobación") · **Info** (#2563eb, badges de conteo).

### Named Rules
**La Regla de Una Sola Voz.** El verde de marca ocupa ≤10% de cualquier pantalla. Su escasez es lo que lo hace premium: si todo es verde, nada destaca. Una pantalla = un botón verde primario.

**La Regla del Neutro Cálido.** Prohibido el gris azulado de oficina como fondo. Los neutros tienden a verde/tierra. Si un gris se ve "de hospital", está mal.

## 3. Typography

**Display & Body Font:** Inter (con system-ui, -apple-system, sans-serif de fallback).
**Character:** Una sola familia, humanista y neutra, que va de cifras potentes a cuerpo legible sin cambiar de voz. Inter con `font-feature-settings: "cv11","ss01"` para cifras y minúsculas más nítidas; titulares con tracking negativo para densidad de marca.

### Hierarchy
- **Display** (800, clamp(1.9rem→2.75rem), 1.08, -0.02em): héroes de landing, números grandes de cobro.
- **Headline** (700, 1.25rem, 1.2, -0.01em): títulos de sección y de card.
- **Title** (600, 1rem, 1.35): subtítulos, nombres en listas.
- **Body** (400, 0.9375rem/15px, 1.55): párrafos y celdas. Línea máx. 65–75ch.
- **Label** (600, 0.75rem, 0.04em, MAYÚSCULAS): etiquetas de KPI, encabezados de tabla, secciones del sidebar.

### Named Rules
**La Regla del Importe.** Las cifras de dinero siempre en Tinta (#0f1c17), peso ≥700, tabular. El dinero nunca se pinta en gris apagado.

## 4. Elevation

Sistema **estratificado pero suave**: las superficies descansan planas con un borde de 1px cálido; la sombra aparece como respuesta a estado (hover, modal, dropdown) o para separar lo flotante. Nunca sombras duras de alto contraste — eso "huele a 2014".

### Shadow Vocabulary
- **Reposo** (`box-shadow: 0 1px 2px rgba(16,24,40,.04)`): cards en estado normal, casi imperceptible; el borde hace el trabajo.
- **Elevado** (`box-shadow: 0 4px 12px -2px rgba(16,24,40,.08), 0 2px 6px -2px rgba(16,24,40,.05)`): hover de cards interactivas, KPIs, acciones rápidas.
- **Flotante** (`box-shadow: 0 18px 40px -12px rgba(16,24,40,.18)`): modales, dropdowns, popovers.
- **Foco** (`box-shadow: 0 0 0 3px rgba(34,197,94,.30)`): anillo de foco accesible en inputs y botones.

### Named Rules
**La Regla Plano-por-Defecto.** Las superficies son planas en reposo (borde 1px + sombra Reposo). La sombra Elevado solo aparece al hover. Si una card "levita" sin que la toques, la sombra es demasiado.

## 5. Components

### Buttons
- **Shape:** pastilla (radius full, 9999px). Altura cómoda al pulgar (≥44px en móvil).
- **Primary:** fondo Verde Confianza (#16a34a), texto blanco, peso 700, padding 12px 20px. Hover #15803d + leve `translateY(-1px)`.
- **Secondary:** superficie blanca, texto Tinta, borde 1px Borde. Hover fondo Fondo (#f6f7f5).
- **Ghost:** sin fondo ni borde; texto Apagado→Tinta al hover. Para acciones terciarias.
- **Danger:** fondo Peligro (#dc2626), texto blanco. Solo acciones destructivas.
- **Focus:** anillo Foco visible siempre (`:focus-visible`).

### Cards / Containers
- **Corner Style:** 16px (lg) para cards de contenido; 12px (md) para piezas internas.
- **Background:** Superficie (#fff).
- **Shadow Strategy:** Reposo por defecto, Elevado al hover si es interactiva (ver Elevation).
- **Border:** 1px Borde (#e7e9e5) — el borde, no la sombra, define la card en reposo.
- **Internal Padding:** 20px (lg) en bloques; las tablas van edge-to-edge dentro de la card.

### Inputs / Fields
- **Style:** fondo blanco, borde 1px Borde, radius 12px (md), padding 11px 13px, texto Tinta.
- **Focus:** borde Verde Confianza + anillo Foco. Sin glow difuso.
- **Error:** borde Peligro + texto de ayuda en Peligro.
- **Label:** estilo Label (12px, 600) en Apagado encima del campo.

### Status pills
- **Aceptado:** texto/borde Verde Confianza sobre Verde Tinte.
- **Pendiente de aprobación:** ámbar (#b45309) sobre #fff7ed con borde.
- **Rechazado:** Peligro sobre #fef2f2. **Borrador:** Apagado sobre Fondo.
- Forma pastilla, 11–12px, peso 700, MAYÚSCULAS, tracking 0.02em.

### Navigation (sidebar)
- Fondo Tinta muy oscuro, texto blanco a baja opacidad; item activo con realce verde sutil y barra/acento. Badges de conteo (info/aviso) alineados a la derecha. En móvil: off-canvas con overlay.

### Signature: KPI / cifra de cobro
- Card con Label arriba (MAYÚSCULAS, Apagado) y cifra Display (Tinta, 800, tabular) debajo. Tendencia con flecha ▲▼ en Positivo/Peligro. Es el corazón del Home: debe leerse de un vistazo.

## 6. Do's and Don'ts

### Do:
- **Do** usar un solo botón Verde Confianza por pantalla (Regla de Una Sola Voz).
- **Do** pintar todo importe en Tinta (#0f1c17), peso ≥700 (Regla del Importe).
- **Do** definir cards con borde 1px cálido + sombra Reposo; elevar solo al hover.
- **Do** verificar contraste ≥4.5:1 (cuerpo) y ≥3:1 (texto grande); placeholders también a 4.5:1.
- **Do** targets ≥44px, foco visible, y respetar `prefers-reduced-motion`.
- **Do** mobile-first: una columna, CTA accesible al pulgar, lo importante arriba.

### Don't:
- **Don't** look de plantilla genérica / Bootstrap / "hecho por IA": cards grises planas idénticas, azul Bootstrap, sombras duras, espaciado a ojo.
- **Don't** saturar: nada de degradados llamativos por todas partes ni varios acentos compitiendo. El verde→cian es un acento puntual, no un fondo.
- **Don't** gris azulado de oficina como fondo (Regla del Neutro Cálido); nada de modo oscuro como base.
- **Don't** que parezca un juguete: maneja dinero, cero infantilismo.
- **Don't** pintar dinero ni datos clave en gris claro "por elegancia": es el motivo nº1 de que un diseño se lea mal.
- **Don't** sombras de alto contraste tipo 2014; usar las suaves y estratificadas de Elevation.
