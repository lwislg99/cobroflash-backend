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
- Regla 42: «después» en yaqu.app a 390 tras el merge. → **HECHO en SCRUM-1722b** (abajo).

---

# SCRUM-1722b — el parte aprovecha la pantalla ancha · tres rótulos en tono cercano

**Puesto:** S4 · **Rama:** `scrum-1722b-parte-ancho-escritorio` · 12-nov-2026
**Skill UI:** cargada (`yaqu-premium-ui`; DESIGN.md única fuente de tokens)
**Medido contra:** `origin/main` = `03645d4e46cae5e035db5fd51612ecce61377658` · 2026-11-12T14:13:03Z
A9: comprobación → `docs/evidencias/scrum1722b/despues-medidas.json`

La comprobación es el DOM ejecutado: x/y/ancho/alto de cada tarjeta y `position` de las firmas tras bajar 700 px.

## Orden
Feedback del fundador sobre lo desplegado (#3118), en el ticket ~16:05: a pantalla ancha la columna de 720 px queda estrecha y centrada con márgenes enormes («se ve asi»). Ajuste SÓLO de escritorio (≥1024), nada por debajo, sin textos nuevos. Y en el mismo tramo, la firma del fundador de los tres opcionales de tono cercano (SCRUM-1722 c.21708).

## 1 · Verificación en prod de SCRUM-1722 a 390 (regla 42)
Sonda sólo-GET sobre yaqu.app, rol `tecnico` simulado, SIN servir nada local (pasada «antes» de este tramo): partes 18, 14, 12 y el 18 con líneas inyectadas → 4/4 con el diseño de 1722 (tarjetas, recuadros de firma de 112 px), desborde 0, cero errores de página. Medidas: `docs/evidencias/scrum1722b/antes-medidas.json`.

## 2 · Escritorio
| ancho | antes (prod) | después |
|---|---|---|
| 390 | — | **idéntico a prod**: x, y, ancho y alto de las 7 tarjetas iguales en las 4 pasadas, con los textos nuevos dentro |
| 1024 | borrador 594 px · **firmado 362 px** (el contenedor se encogía a su contenido) | una columna a todo el ancho: 728 px en los cuatro |
| 1280 | ídem, márgenes de ~230 px a cada lado | DOS columnas: lo que se apunta 600 px a la izquierda; las **firmas 360 px a la derecha, fijas** (`sticky`, quedan a 76 px del borde tras bajar 700 px). Página 400 px más corta (1998→1581 · 1474→1185) |

- Desde 1200: `grid` de dos columnas; las firmas ocupan una casilla que abarca las filas de la izquierda (`span 40`), así la izquierda se apila sin huecos tenga las tarjetas que tenga. El orden del DOM no cambia: el tabulador recorre la izquierda y luego las firmas.
- De 1024 a 1199, una columna: con dos, la izquierda quedaba en 344 px (medido).
- El pad de firma es una capa fija (`signaturePad.js`), no depende del ancho de la columna.

## 3 · Tres rótulos (firmados, c.21708)
`docs/microcopy/2026-11-12-SCRUM-1722-tono-cercano-del-parte.md`. (a) `TEXTOS.firmar` «Firma aquí, cliente» · (b) clave nueva `TEXTOS.firmarAquiTecnico` «Firma aquí, técnico» en el botón; `firmarTecnico` se queda porque también titula el pad · (c) `TEXTOS.dictado` «Cuéntalo con tu voz»; la pista no cambia. El albarán no se toca.

## Tests
Población: los 106 ficheros que nombran `parteDetailView`, el censo de microcopy, `docs/microcopy` o 1722 → 941 casos · 931 pass · 3 fail · 7 skip (los 7 declaran banco desechable). Los 3 rojos: 2 de SCRUM-1199 = entorno (`express` no está en el `node_modules` de este árbol); 1 de SCRUM-1266b = intermitente bajo carga (aislado, 15/15 dos veces seguidas). Memoria libre 2.130 MB: no se lanzó la suite completa.

## Pendiente
- El «me gusta» del fundador (capturas antes/después a 1280 y después a 390 en `evidencias-s4-12nov-1722b\capturas`).
- Regla 42: tras el merge, la sonda sin servir nada local a 1280 y 390.

# SCRUM-1722c — a 390 el parte se salía por la derecha (regresión de SCRUM-1722)

**Puesto:** S4 · **Rama:** `scrum-1722c-parte-390-no-se-ensancha` · 16-nov-2026
**Skill UI:** cargada (`yaqu-premium-ui`; una declaración de ancho, ningún token ni texto nuevo)
**Medido contra:** `origin/main` = `6ffa662fd03ad6994f08c9816de6f0c7307e14d0` · 2026-11-16T16:06:22Z
A9: comprobación → `docs/evidencias/scrum1722c/antes-salida.txt`

## Qué se vio
En yaqu.app, durante el recorrido del operario simulado (SCRUM-1686, H6), el parte PT-2026-014 —abierto desde
la lista con «Abrir parte» en un trabajo con dirección— medía **451 px en una ventana de 390**. `html, body`
llevan `overflow-x: clip`: la página no se desplaza (`scrollTo(300, 0)` → `scrollX = 0`), así que el borde
derecho de «Salida», «Kilómetros», «Ordenar en líneas» y los dos recuadros de firma queda fuera de la pantalla.
Igual con rol de admin y sin emulación de móvil. El parte PT-2026-011 (sin obra) no se salía.

## Causa (probada en el DOM vivo, no deducida)
`.main` es un flex en columna y `.view-container` se estira a su ancho. SCRUM-1722 centró la hoja del parte con
`*:has(> header.parte-cabecera) { max-width: 720px; margin-inline: auto; }`: con márgenes `auto` el hijo deja de
estirarse y mide lo que mide su contenido. La línea «Obra y referencia» lleva el dato en una sola línea
(`nowrap`), y una dirección larga ensancha la hoja. Vaciando ESE resumen la hoja volvía a 390; vaciando
cualquiera de los otros tres, no. Desde SCRUM-1674 el parte hereda la dirección del trabajo, así que le pasa a
cualquier parte abierto desde un trabajo con una dirección de tamaño normal.
Es la misma causa que encogía el parte firmado (18 px de margen frente a 12 a 390; 362 px a 1280), y que
SCRUM-1722b arregló sólo desde 1024.

## Arreglo
`width: 100%` en esa regla (`public/dashboard/css/styles.css`, bloque S4 · SCRUM-1722). Nada más: sin texto,
sin tocar `parteDetailView.js`, sin esquema.

## Por qué no se cazó el 12-nov (A9)
La sonda del parte medía el desborde con `html.scrollWidth − clientWidth`, que bajo `overflow-x: clip` da 0
aunque la hoja mida 451; y sus cuatro casos eran partes sin obra larga. Dije «desborde 0 en las 8 pasadas» y era
cierto para lo que miraba. En este PR la sonda (`docs/evidencias/scrum1722b/sonda-parte.mjs.txt`):
- mide el borde derecho real del contenido (la cifra vieja se conserva al lado, `desbordeXDelDocumento`);
- lleva dos casos con obra larga, uno real y uno inyectado, como control positivo;
- sale con código 1 si algo desborda o si alguna pasada no miró ninguna caja;
- lee la cookie de QA en sus dos formatos (con el de hoy moría en un timeout de `renderAppView`).

## Medidas
| pasada | CSS | pasadas | con desborde | medida vieja (`html.scrollWidth`) |
|---|---|---|---|---|
| antes | el de yaqu.app | 18 (6 casos × 390, 1024, 1280) | **3**, las tres a 390: +61, +114 y +61 px | 0 en las 18 |
| después | el de esta rama, servido sobre yaqu.app | 18 | **0** | 0 en las 18 |

Además, a 390 la hoja del parte firmado pasa de 378 a 390 px (deja de encogerse). A 1024 y 1280 las 12 pasadas
miden lo mismo antes y después (776 y 1032 px). Salidas y medidas completas: `docs/evidencias/scrum1722c/`.

## Tests
`tests/scrum1722c-la-hoja-del-parte-pide-su-ancho.test.mjs` (6 casos). Rojo primero: sobre el CSS de `main` cae
el caso «toda regla que centra la hoja del parte con márgenes auto le pide `width: 100%`» (1 de 6); con el
arreglo, 6 de 6. Lee el CSS sin comentarios y recorre también las reglas de dentro de `@media`; los píxeles los
mide la sonda.

## Pendiente
- Regla 42: tras el merge, la sonda SIN `PARTE_CSS` contra yaqu.app → 18 pasadas, 0 con desborde.

## El rojo del CI de #3173 y su arreglo (16-nov-2026, ~16:30Z)
El obligatorio cayó con UN fallo: `tests/scrum700-filtros-de-comentario.test.mjs` («más ficheros con filtro propio:
92 > 91»). El test nuevo quitaba los comentarios del CSS con una expresión propia, y la casa tiene un sitio único
para eso (`soloEjecutable`, de `tests/_guard-texto.mjs`).
- Arreglo en el TEST, no en el guard (regla 41): usa `soloEjecutable(css, { almohadillaEsComentario: false })`
  (en CSS la almohadilla abre un id o un color, no un comentario).
- Medido antes de cambiarlo, sobre el `styles.css` de la rama: el texto que sale es el mismo salvo espacios, con
  1.350 llaves de apertura y 1.350 de cierre por los dos caminos. El test lee las mismas reglas.
- Tras el arreglo: `scrum700` + el test nuevo + `scrum1415`, 17 de 17, 0 fallos, 0 saltos.
- Por qué no se vio antes de empujar: `scrum700` recorre el árbol entero y no está entre los vecinos que se
  corrieron ni en los 15 guards de entrada; sólo corre en la tanda completa del CI.
