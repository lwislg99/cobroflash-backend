# SCRUM-1659 · PILOTO-1 · ALBARANES a nivel profesional: recorrido AB6 de las tres pantallas + primer arreglo (la lista)

**Medido contra:** `origin/main` = `d7fb55ea19b825a26f89bf5b4765c2557eeb3a71` · 2026-11-10T16:44:56Z

A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

**Skill UI:** cargada (yaqu-premium-ui) antes de juzgar y de tocar `public/`; DESIGN.md y Parte AB (AB1-AB7) leídos.

Puesto: S2. Rama `scrum-1659-albaranes-lista-pestanas`. Carriles medidos con `scripts/carriles.mjs de`:
lista `albaranesView.js` → **S2** · ficha `albaranDetailView.js` → **S4** · página pública de firma
(`albaranPublic.routes.ts` / `albaranPublicVista.ts`) → **S1**. El recorrido de las tres es de S2; los
arreglos de ficha y pública van en tickets con el área de su dueño.

## ① El recorrido (yaqu.app, cuenta QA, build `d7fb55ea1`, 390 y 1280 px)

**El albarán de muestra lo creé yo** (QA en producción autorizada): `AB260006` (#51), valorado, en el
Trabajo #76 —la cuenta QA sólo tiene Trabajos de fixture (#76-78), así que cliente y obra son los de
fixture—, con 3 líneas de material + 2 h de mano de obra: tubo multicapa 20 mm 12 m × 3,85 · codo
multicapa a presión 8 ud × 2,40 · grifo monomando 1 ud × 64,90 · mano de obra oficial fontanero
2 h × 35,00 → base 200,30 · IVA 42,06 · total **242,36 €** (`POST /admin/jobs/76/albaranes` → 201,
16:48:38Z; guion `evidencias/scrum1659/crear-albaran-1659.mjs`). **Ningún envío de WhatsApp.**

**La página pública** sólo se abre con el token que escribe el envío «para firmar» (sale un WhatsApp
al cliente QA). No lo mandé: medí la página SERVIDA por yaqu.app del #46 (`AB260001`, emitido, con
token, 0 líneas) y le inserté en el navegador las líneas del AB260006 pintadas por
`renderLineasAlbaran` de `dist/` —la misma función que usa la ruta— (`publica-lineas-1659.mjs`). El
correo de la cuenta QA que pinta el aviso de privacidad va tapado en las capturas (repo público).

Las sondas sólo hacen GET (control positivo del interceptor antes de medir: `comun.mjs` de sondas-s2).
Población: 6 pantallas (3 × 2 anchos) en `recorrido-informe.json`; `noGet 0` y `errores 0` en las seis.

| pantalla | defecto (medido) | P | carril | dónde |
|---|---|---|---|---|
| lista | a 390 la 4.ª pestaña «Firmados» acaba en x=460 con la tarjeta en 378: la fila pide 447 px en 364 y no desplaza (`overflow-x: visible`); asoman 24 px («Fir», sin contador) | P1 | S2 | **arreglado aquí** |
| lista | a 390 el buscador mide 34 px y el filtro de facturación 36 (AB6: 44) | P2 | S2 | **arreglado aquí** |
| lista | seis `style.cssText` en la vista (regla 4) | P2 | S2 | **arreglado aquí** |
| lista | cero importes en la lista (AB4: «importes en Tinta ≥700»); `GET /admin/albaranes` no trae total. Y la columna «Emisión» de un BORRADOR enseña `createdAt` | P1 | S1 (dato) → S2 | ticket |
| ficha | un albarán valorado de 242,36 € no enseña ni sus líneas ni su total: sólo «Pendiente de facturar · 4 líneas» (0 importes, 0 filas de línea, medido en DOM) | P0 | S4 | ticket |
| ficha | la fila de acciones va pegada al borde (Emitir en x=13 con la tarjeta en 12; el título en 35) y el estado «BORRADOR» es un rótulo suelto, no una píldora de estado | P1 | S4 | ticket |
| ficha | la primaria de pantalla usa la variante pequeña (`btn-primary btn-sm`, 12,5 px, #047857), contra la frontera de DESIGN §5 (SCRUM-412); la divisoria de «Pendiente de facturar» corta a media anchura a 1280 | P2 | S4 | ticket |
| pública | a 390 la tabla de líneas se sale de la tarjeta («IMPORTE» cortado al borde) y el concepto se parte en 3 líneas | P1 | S1 | ticket |
| pública | «✍️ Firma aquí» en #cdd2cb sobre #f7f8f6 (≈1,5:1; AA 4,5) y «Borrar» de 29 px de alto | P1 | S1 | ticket |
| pública | cabeceras mezcladas («Concepto / Cant. / Unidad» frente a «PRECIO UD. / IMPORTE»), Base → Total sin la línea de IVA (42,06 € sin explicar), y «¿En calidad de qué firma?» arranca vacío | P2 | S1 | ticket |

Leído en el código y NO medido (no lo cuento como defecto): el estado vacío de la lista lleva un emoji
📄 y no enseña la acción primaria (AB4); la carga es un «Cargando…» sin esqueleto.

## ② El arreglo: la LISTA, una sola pantalla (regla 4)

Era la pantalla de mi carril con más defectos medidos. Cambios:

- `albaranesView.js`: la tarjeta lleva `alb-lista` (acota las reglas de móvil); los seis
  `style.cssText` pasan, tal cual, a `.alb-titulo`, `.alb-subtitulo`, `.alb-aviso`, `.alb-aviso-detalle`,
  `.alb-buscador`, `.alb-sel-cobro`; al pulsar una pestaña medio asomada, `scrollIntoView({inline:
  'nearest'})` la trae entera. El literal `'alert error'` se conserva (lo vigila `scrum301`).
- `styles.css`, dentro de `@media (max-width: 640px)` y SÓLO bajo `.alb-lista`: la fila de pestañas
  desplaza en X (`overflow-x: auto`, `overflow-y: hidden`, sin barra), las pestañas no se encogen ni
  se parten, y `.data-card-toolbar > .input` a 44 px. La regla compartida `.data-card-tabs` NO cambia:
  Facturas, Presupuestos y Clientes no están medidas.
- `overflow-y: hidden` lo pidió la medida: al desplazar en X el eje Y pasa a `auto` y el
  `margin-bottom: -1px` del subrayado dejaba 1 px de desplazamiento vertical (52 en 51).
- Ni un texto nuevo, ni un token nuevo.

**Test:** `tests/scrum1659-albaranes-lista-movil.test.mjs` (5 casos, sin gate; reglas en su @media,
acotado, y la vista pintando las clases en el banco). Rojo sin el arreglo: 3 de 5, en el commit
`4e45fed1991f10cbe93f95ae6742b587d5e143a8`; y otra vez con la vista y el CSS de `origin/main` sobre el
test final (mutación `1dd08cfc37819002635a8127a4c4701be37623a8`, revertida en
`5495a0701b9cfa538aa26e5a858f11788cc6e070`, árbol idéntico al del arreglo). Verde 5/5 con él.
**Trinquete** `scrum713c`: 334 → 328, lo dijo el propio guard («HAN BAJADO … 328 frente al techo 334»).
Vecinos corridos: 21 ficheros de albaranes y trinquetes, 214/214; guards de filtro y mudez, 82/82.

**En pantalla** (yaqu.app con `albaranesView.js` y `styles.css` servidos desde el árbol; testigo de
que el fichero servido es el del árbol, `verif-1659.mjs`):

| | antes | después |
|---|---|---|
| 390 · fila de pestañas | `overflow-x: visible`, 447 en 364 | `auto`, desplaza |
| 390 · «Firmados» tras arrastrar la fila al final | derecha 460, tarjeta 378 → NO entra | derecha 357 → entra entera |
| 390 · buscador / filtro | 34 / 36 px | 44 / 44 px |
| 390 · pulsar «Firmados» | filtra (2 firmados) | filtra (2 firmados) |
| 1280 · todo lo anterior | sin desborde, 34 / 36 | idéntico (el escritorio no cambia) |
| estilos en línea en la vista | 5 (`style=` en DOM) | 1 (`display:none` del vacío, por `style.display`) |

Capturas: `evidencias/scrum1659/lista-antes-390.png` · `lista-despues-390.png` ·
`pestanas-antes-last.png` · `pestanas-despues-last.png` · y las de 1280.

## Textos (regla 39)

Este arreglo no estrena ninguno. Los que piden los tickets (rótulo de la columna de importe, cabeceras
de la tabla pública, línea de IVA, opción guía del selector de calidad) se PROPONEN, sin aplicar, en la
lista única del comentario de SCRUM-1659.
