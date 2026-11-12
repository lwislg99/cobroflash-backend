# SCRUM-1722 — el parte del operario, bonito y que se entienda

**Puesto:** S4 · **Rama:** `scrum-1722-parte-del-operario-bonito` · 12-nov-2026
**Skill UI:** cargada (`yaqu-premium-ui`; DESIGN.md única fuente de tokens)
**Medido contra:** `origin/main` = `591e85cfd08376c077c8522a67c9cc874b844ead` · 2026-11-12T12:20:00Z
A9: comprobación → `tests/scrum902-botones-del-parte-con-estilo.test.mjs`

**Dónde y cómo:** yaqu.app, como operario con rol `tecnico` simulado en el front sobre la cuenta QA (merchant 46), partes 18 (PT-2026-010, borrador vacío: el que miró el fundador), 14 y 12 (firmados) y el 18 con dos líneas inyectadas sólo en la respuesta GET. Sonda sólo-GET con control positivo: `D:\MILLONARIO\cobroFlash\evidencias-s4-12nov-1722\sonda-parte.mjs`; el «después» sirve el JS y el CSS de esta rama sobre yaqu.app.

## Orden (literal del fundador, en la descripción del ticket)
«esto sigue feísimo parece algo técnico y debería ser bonito y casual que se entienda … no ves que está super feo y difícil de entender?»

## Qué se midió (antes, 390) y qué se hizo
| # | Defecto medido | Arreglo |
|---|---|---|
| ① | «Ordenar en líneas», «Firmar aquí mismo», «Firma del técnico» (y «Ahora», «Añadir línea») = pastilla blanca con borde fino, igual que una casilla | Acciones secundarias con RELLENO neutro (`--neutral-100`) y su dibujo; la casilla sigue blanca con contorno. Regla de lectura: contorno = se escribe · relleno = se pulsa |
| ② | Títulos de paso 14 px/700 junto a rótulos 12,5 px/600 | Títulos de paso 1,125 rem/700 Tinta (`.parte-paso-titulo` y los de horas, firmas y datos); rótulos sin tocar |
| ③ | La firma era una caja con una pastilla dentro | Recuadro alto (112 px) con raya de firma y lápiz; «Falta la firma de…» encima como rótulo del recuadro; firmado = constancia en Verde Tinte con su marca. La del cliente con líneas sigue siendo la única voz verde; vacío (SCRUM-1676) y técnico, recuadro blanco de raya discontinua |
| ④ | Horas, dictado y firmas sin tarjeta; a 1280 todo a lo ancho | Cada paso en su tarjeta (borde 1 px + Reposo, radio lg, 16/20 px); la página a 720 px como máximo |

Sin un solo texto nuevo: todos los literales pintados son los que ya estaban, firmados. Los estilos en línea del parte (cabecera, bloque, dictado, firmas) pasan a clases. CSS en un bloque propio `S4 · SCRUM-1722` dentro de `styles.css` (contenedor de S2), después de las reglas del parte.

## Medidas (después)
- Desborde horizontal 0 en las 8 pasadas (4 partes × 390/1280); cero errores de página; cero no-GET salvo los dos cortados a propósito.
- Objetivos táctiles del parte ≥ 44 px a 390 (el único de 36 px es un botón sin texto del armazón, fuera del parte).
- Tests: los 157 ficheros que tocan el parte o `styles.css`, en verde. SCRUM-902 cayó con la primera versión (clase nueva en el botón de firma = su positivo desaparecía); se arregló el código, no el guard: la zona se pinta por `data-*`.

## Pendiente
- El «me gusta» del fundador sobre las capturas (`evidencias-s4-12nov-1722\capturas\antes-*` / `despues-*`).
- Iconos por máscara CSS (lista, más, reloj, lápiz, marca): DESIGN.md no tiene token de iconografía → propuesta de cambio si se reutilizan fuera del parte.
- Tamaños 1,375 rem (número del parte) y 1,125 rem (título de paso) no están en la escala de DESIGN.md (Headline 1,25 · Title 1): propuesta de escalón móvil.
- Regla 42: «después» en yaqu.app a 390 tras el merge.
