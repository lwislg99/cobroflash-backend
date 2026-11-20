# SCRUM-1762 · Lavado de cara pantalla a pantalla

## PR-1 · FICHA del trabajo + lo transversal de styles.css (S2 · 20-nov-2026)

**Medido contra:** `origin/main` = `cde9d2f04da5567dc45233cd9356ddcbf5f7cb9e` · 2026-11-20T11:23:11Z (hora del `Date` de yaqu.app; el reloj de esta máquina va adelantado) — el mismo build que sirve yaqu.app hoy
**Fecha:** 20-nov-2026
**Rama:** `scrum-1762b-hallmark-ficha`
**Skill UI:** cargada (`yaqu-premium-ui` + `impeccable`, ANTES de tocar CSS. AB6: sin componente, sin texto y sin color
nuevos; todo sale de tokens que ya existían —`--brand-tint`, `--brand-tint-ink`, `--brand`, `--brand-ink`,
`--neutral-600`, `--danger-ink`, `--ring`—; los 44 px de la barra y el anillo de foco, intactos; iconos dibujados
con máscara en `currentColor`, con su salida para `forced-colors`.)

A9: comprobación → `tests/scrum836-ancla-de-mutacion-viva.test.mjs`

La primera tanda entera cazó cuatro defectos de FORMA míos en el test y el registro nuevos, todos por guards que ya
existían: `soloEjecutable` a pelo sin suelo (`tests/scrum719-el-suelo-de-los-doce.test.mjs`), `fichero` de las
mutaciones como identificador y no como literal (scrum757), `cae` con un nombre parecido y no el título EXACTO del test
(scrum836) y el ancla de medición sin hora (scrum267). Arreglados antes del push; la tanda se repitió entera.

**Orden del fundador (20-nov, cabecera del orquestador -25):** «con esta nueva skill darle otra lavada de cara... y lo
que se pueda mejorar dale». El plano es la auditoría hallmark de S2 de esa mañana
(`sondas-s2\evid-hallmark-20nov\`: `auditoria.json` + `sloplint-static.txt`), no una auditoría nueva.

### Qué se cambia (ropa, no función)
1. **La pestaña ABIERTA de la ficha se ve abierta** (hallazgo de más impacto). Era `btn-secondary` contra
   `btn-ghost`: dos grises. Ahora lleva la receta de «elegido» que ya usaban `#po-lista … [aria-current]` y el selector
   de cliente (`[aria-pressed]`): Verde Tinte + filete de `--brand` + texto `--brand-tint-ink`; el hover no se la quita
   y el foco suma `--ring` al filete.
2. **«+ Nuevo parte» a tamaño de botón normal.** En EN CURSO es la rellena de la ficha (SCRUM-1749, c.22041: sin
   `btn-sm`, y su clase NO se toca: `scrum1749` l.106 sigue exigiéndolo) pero heredaba los 18,66 px del primario
   grande (SCRUM-368) y salía el doble que sus vecinas. Regla acotada a `.detail-page--trabajo [data-abrir-parte]`:
   13,5 px, 44 px de alto, fondo `--brand-tint-ink` (blanco encima 5,48:1, AA por la vía normal). El CTA de la
   cabecera (`data-accion="cta"`) no se toca.
3. **Emojis → iconos del set del menú** (trazo de `.nav-icon`: 24×24, stroke 2, `currentColor`), dibujados por CSS
   con el patrón `--parte-icono` del parte: clases `con-icono con-icono--{hecho,telefono,whatsapp}`. ✅ de «Marcar
   terminado» (cabecera), 📞 y 💬 del bloque Cliente del lateral (`jobRailBlocks.js` pasa el NOMBRE del icono, no el
   emoji).
4. **Transversal (`styles.css`):** `.btn` sin `transition: all` (lista explícita) · `.progress-fill` ya no anima
   `width` (se va también su `reduce-motion`, que quedaba sin objeto) · **foco instantáneo**: los 12 selectores del
   sloplint (regla 15) dejan de transicionar `box-shadow`, que es su anillo de foco · pills a ≥4,5:1:
   `status-pill-draft` 4,25→6,89 (`--neutral-600`) y `status-pill-rejected` 4,41→7,60 (`--danger-ink`); las hermanas
   ya pasaban (accepted 4,57 · pending 6,84 · approval 6,88).

### Declarado (no entra)
- **«▶ Empezar» de la LISTA:** vive en `jobsView.js`, carril de S4, y lo vigila además `guard-lista-trabajos-917`
  por su literal. No es trivial desde S2: queda para S4. El «▶» del CTA de la ficha sale de `jobNextAction.js`, que
  comparte rótulo con esa lista: tampoco se toca para no partir el literal en dos.
- El toast «✅ Trabajo terminado» es texto: no entra en esta ronda.
- Sin tocar (según el encargo): textos (el subtítulo con eco), lo que pide decisión de DESIGN.md (gates 67 y F19), y
  los colores literales masivos (323 del sloplint).

### Huella de función
Idéntica salvo lo encargado, y se declara: el `textContent` de «Marcar terminado» pierde el «✅ » y el de las líneas
de teléfono/WhatsApp del lateral pierde «📞 »/«💬 ». Ninguna petición, ruta, estado ni orden de nodos cambia.

### Tests
- NUEVO `tests/scrum1762b-hallmark-ficha.test.mjs` (5): ① tinta de la pestaña · ② «+ Nuevo parte» · ③ iconos del
  lateral pintando la ficha en el banco · ④ transversal · ④ pills. **Rojo-primero: 5/5 rojos con los fuentes de
  `origin/main`**; verdes con la rama.
- CAMBIA `tests/scrum1680-ficha-terminar-y-cerrar.test.mjs` l.75-78 (busca «Marcar terminado» sin emoji y exige
  `con-icono--hecho`) y l.106 (el control de «no se ofrece» sin emoji, que si no quedaba ciego). Rojo contra main.
  Autorización del orquestador cobroflash-backend-25 (mensaje entre sesiones del 20-nov tarde; Jira caído, la pega él
  al volver), copiada LITERAL:
  «AUTORIZO (delegación c.21978, 20-nov tarde) cambiar exactamente estas exigencias y ninguna más, porque el requisito cambió con la lavada hallmark ordenada por el fundador (emojis→iconos), rojo-primero visto contra main: tests/scrum1680-ficha-terminar-y-cerrar.test.mjs L75-78 → busca «Marcar terminado» SIN emoji y exige la clase con-icono--hecho; L106 → el control «no se ofrece» también sin emoji (el assert viejo quedaba ciego al quitarlo). El literal «Marcar terminado» NO cambia de palabras: solo pierde el ✅, que pasa a icono.»

Mutaciones: catálogo → `tests/scrum1762b-hallmark-ficha.test.mjs`

Las 5 del catálogo, aplicadas una a una sobre la rama: **5/5 ROJO**.

### Capturas (fuera de git, A8)
`D:\MILLONARIO\cobroFlash\capturas\SCRUM-1762\b-ficha\{antes,despues}\` — antes = prod build cde9d2f04 (auditoría de
la mañana) · después = el mismo build con `styles.css`, `jobDetailView.js` y `jobRailBlocks.js` de la rama servidos
en local (sonda `sondas-s2\capturar-1762.mjs`, solo GET), admin a 390 y 1280. Medido después: 0 emojis visibles,
0 px de desborde, «+ Nuevo parte» 13,5 px × 44 px sobre rgb(4,120,87), pestaña abierta sobre rgb(236,253,245).
