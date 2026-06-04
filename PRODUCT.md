# Product

## Register

product

> Superficie primaria = **product** (dashboard que el profesional usa a diario). El sitio público `public/index.html` y las páginas del cliente (`/pay/quote/*`, `/cliente/*`) son superficies **brand** y se tratan con criterio de marketing/conversión, pero comparten el mismo design system.

## Users

Profesionales de servicios en LATAM y España: fontaneros, electricistas, reformistas, pintores, cerrajeros, climatización. Suelen ser autónomos o pequeñas empresas, **no técnicos**, trabajando **desde el móvil y en obra** (a menudo con prisa, una mano ocupada, conexión irregular). Su cliente final también recibe enlaces y los abre en el móvil.

Trabajo a resolver: cotizar rápido, que el cliente acepte/firme sin fricción, y cobrar antes de empezar — todo girando en torno a WhatsApp.

## Product Purpose

YaQu convierte el ciclo cotización → WhatsApp → firma digital → factura → cobro en algo que se hace en segundos desde el móvil. Existe para que el profesional **cierre más trabajos y cobre por adelantado sin perseguir pagos ni pelear con papeleo**. Éxito = el usuario envía su primera cotización en minutos y vuelve cada semana porque cobrar es fácil.

## Brand Personality

**Profesional, fiable, cercano.** Serio porque maneja dinero (debe inspirar la confianza de un producto financiero), pero humano y directo porque su usuario no es de oficina. Voz clara y sin jerga, en español de LATAM/ES. La sensación objetivo es **"esto es de fiar y lo entiendo a la primera"**.

## Anti-references

- **Look de plantilla genérica / Bootstrap por defecto / "hecho por IA"**: nada de cards grises planas idénticas, sombras duras por defecto, botones azul Bootstrap, espaciados inconsistentes.
- **Saturación visual**: nada de degradados llamativos por todas partes, múltiples acentos compitiendo, ni ruido. El degradado verde→cian se usa con mucha mesura (logo/momentos clave), no de fondo en todo.
- **Aspecto de juguete o poco serio**: maneja dinero; cero infantilismo.
- **Frío / corporativo impersonal**: serio pero con calidez; nada de gris azulado distante.
- **Modo oscuro** como base: la marca es clara y luminosa.

## Design Principles

1. **Confianza primero.** Cada pantalla donde hay dinero (cotización, pago, factura) debe sentirse tan segura como una app de banco: jerarquía nítida, importes legibles, cero ambigüedad.
2. **Claridad estilo Stripe.** Una sola acción principal por pantalla, jerarquía tipográfica fuerte, alineación impecable, espacio que respira. Si algo no ayuda a la tarea, fuera.
3. **Mobile-first de verdad.** Se diseña para el pulgar en una obra: targets grandes, una columna, lo importante arriba, nada que dependa de hover.
4. **Cálido, no frío.** Neutros con un punto cálido, copy humano y directo, microdetalles que dan gusto — sin caer en lo recargado.
5. **Una identidad coherente.** Dashboard, landing y páginas del cliente comparten tokens, ritmo y voz: que se note que es el mismo producto y que está cuidado.

## Accessibility & Inclusion

Objetivo **WCAG 2.1 AA**: contraste de texto ≥4.5:1 (≥3:1 para texto grande), foco visible, targets táctiles ≥44px, respeto a `prefers-reduced-motion`. Pensado para usuarios no técnicos y pantallas a pleno sol: legibilidad y tamaños generosos por encima de la sutileza.
