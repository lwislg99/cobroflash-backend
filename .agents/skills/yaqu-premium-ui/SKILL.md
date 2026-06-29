---
name: yaqu-premium-ui
description: Obligatoria ANTES de tocar cualquier UI de YaQu (dashboard, landing, emails, PDFs visuales). Impone DESIGN.md como única fuente de tokens, la Parte AB del master, vanilla sin frameworks, cambios por pantalla/componente y el checklist visual AB6.
---

# yaqu-premium-ui — Guardarraíles de UI premium

> Derivado de `docs/YAQU_MASTER.md` Parte AB (regla 35). **Jerarquía vinculante:**
> `DESIGN.md` + Parte AB **>** esta skill **>** skill oficial `frontend-design` de
> Anthropic. La oficial aporta técnica y ambición estética; esta impone tokens, vanilla
> y dinero-primero. Si chocan, gana la nuestra.

## Antes de tocar UI (obligatorio)
1. Leer `DESIGN.md` — **ÚNICA fuente de tokens**: colores (incl. semánticos y de estado),
   tipografía Inter y su jerarquía, radios, sombras (Reposo/Elevado/Flotante/Foco),
   spacing, status pills. PROHIBIDO inventar colores, fuentes o sombras nuevas.
2. Leer la Parte AB del master (AB1-AB7): principios, inventario de componentes (AB3),
   sensación por pantalla (AB4).
3. Si falta un token (iconografía, skeleton, motion): derivarlo de los existentes y
   **proponerlo como cambio a DESIGN.md** antes de usarlo en más de una pantalla.

## Reglas duras
- **Vanilla**: sin React/Tailwind/bundler/build, sin dependencias pesadas.
- **Una pantalla/componente por cambio. JAMÁS rediseño total de golpe.**
- Reutilizar SIEMPRE el inventario AB3 (botones, cards, pills, modal/drawer, banner,
  inputs con label+error, empty state, skeleton, toast, timeline, selector de pago…).
  Componente nuevo = añadirlo al inventario AB3 (propuesta de master).
- **Cero estilos inline aleatorios**; clases/tokens compartidos (`public/tokens.css`).
- Todo gira alrededor del dinero en juego (AB1): el producto parece caro cuando habla
  del dinero del usuario, no de sus features. Prohibido el aspecto panel-admin genérico.
- Motion sobrio ≤200 ms, siempre con `prefers-reduced-motion`.
- Microcopy: solo el oficial (N5/K1, regla 30); tono DESIGN.md — claro, humano, cero jerga.

## Checklist visual AB6 (QA por cada cambio)
- [ ] Contraste AA · focus visible (anillo Foco) · labels · targets ≥44 px · aria donde aplique
- [ ] Capturas antes/después
- [ ] Matriz Android gama media / iPhone / tablet (V0-5)
- [ ] Estados: empty / error / loading (skeleton si carga >300 ms)
- [ ] Textos largos · importes grandes (9.999,99 €)
- [ ] Merchant sin logo · cliente sin WhatsApp · modo demo con watermark
