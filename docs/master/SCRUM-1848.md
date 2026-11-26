# SCRUM-1848 · Ajustes y Planes a 44 px de toque (AB6)

**Medido contra:** `origin/main` = `e28f3582ec13e3c6102245a33bab02e4e7fa2370` · 2026-11-25T03:17:29Z

**Skill UI:** cargada (`yaqu-premium-ui`, antes de escribir el CSS y después de escribir el test)

Carril J3 (sesión jv-j3de): `settingsView.js` y `plansView.js` son de J3; la cura es un bloque marcado
`/* J3: SCRUM-1848 … */` en `styles.css` (contenedor de S2), sin tocar JS, texto ni clases globales.
Nace de la lista J del censo SCRUM-1845 (`docs/master/SCRUM-1845.md` en la rama
`scrum-1845-censo-tactil-por-carril`, PR #3431) y de la regla del fundador SCRUM-1845 c.22728.

## Qué se ha hecho

- `tests/scrum1848-ajustes-planes-44.test.mjs`: monta Ajustes y Planes con los datos del censo
  (`datosDelCenso`), pulsa CADA pestaña de Ajustes en el banco como el censo (10 estados en total) y mide
  en navegador, con `__areaDeToque`, TODO interactivo pintado a 390, 929 y 1280 px: 456 medidas. Cae si
  queda algo por debajo de 44 que no sea uno de los tres exentos. Controles: botón sembrado de 30 px sale
  corto; los 17 del censo aparecen a cada anchura; los exentos siguen pintados y en ~30 px; ninguna
  medida sin valor. ② comprueba que cada selector del bloque cuelga de un ancla y que cada ancla la escribe
  solo su vista.
- Visto en ROJO antes de la cura (2 de 2: 115 cortos sobre 456 medidas; ② sin bloque), VERDE después
  (2 de 2; quedan 9 cortos, los 9 de los exentos: 3 botones × 3 anchuras).
- Una diferencia con el censo, a propósito: el test monta Ajustes con `freeMonthsEarned: 1` para que se
  pinte «Canjear 1 mes gratis», otra `btn-primary btn-sm` de la tarjeta de referidos que el censo no vio
  (con sus datos, 0 meses, no se pinta). Medido en rojo a 30,6 px y curado con «Copiar link».

## Antes y después (toque en px; antes = censo y rojo de este test, después = verde)

| pantalla | elemento | clase | ¿primaria? | antes | después |
|---|---|---|---|---|---|
| Ajustes (todas las pestañas) | enlace de referidos `#ref-link` | `INPUT.j3e-a636e53` | no aplica | 40,5–41 | 44,5 |
| Ajustes (todas) | «Copiar link» | `btn btn-primary btn-sm` | sí: la de su tarjeta | 30,5–31 | 44,5 |
| Ajustes (todas) | «Canjear 1 mes gratis» (no en el censo) | `btn-primary btn-sm` | sí: la de su fila | 30,6 | 44,6 |
| Ajustes · Facturación | «Añadir condición» | `btn btn-secondary` | no aplica (no es `-sm`) | 36,9 (929/1280) | 44,9–45 |
| Ajustes · Avisos | 3 casillas (`notifyEmail…`) | `INPUT[checkbox]` | no aplica | 17 | 45 |
| Ajustes · Equipo | casilla `showTechPhotoToClient` | `INPUT[checkbox]` | no aplica | 17 | 45 |
| Planes | «presupuestos», «cobros», «gastos» | `A.j3e-4a12b6e` | no aplica | 16 | 45 |
| Planes | «Quiero mi plaza founding…» | `.plan-btn` | no aplica (no es `-sm`) | 39,6–40 | 44,6 |
| Planes | «Mensual», «Anual -17%» | `#toggle-*` | no aplica | 28,6–29 | 44,6 |
| Planes | «Suscribirme — 19,90 €/mes» | `btn-primary plan-btn` | no aplica (no es `-sm`) | 39,7 (929/1280) | 44,7 |

**Exentos por SCRUM-1845 c.22728** (`.btn-sm` que NO son la primaria de su pantalla; DESIGN.md:171), los
tres en la pestaña Marca: «Vista previa» (`btn-ghost btn-sm`), «⬆ Subir logo» (`btn btn-secondary btn-sm`) y
«Sin color (por defecto)» (`btn-secondary btn-sm`). Medidos después: 30,5–30,9. Ninguno lleva `btn-primary`.
«Copiar link» y «Canjear» sí lo llevan y son la acción de su tarjeta: se curan como primarias.

**Cómo:** `.j3e-033e7ec` y `.j3e-3d68052` (filas de la tarjeta de referidos, FUERA de `.settings-panel`:
salen en las nueve pestañas), `.settings-panel` y `.j3e-5521062` (Planes). Las primarias pequeñas pesan
(0,3,0) y ganan a `.btn.btn-sm` (0,2,0). Las casillas, con el patrón de SCRUM-962f (etiqueta a 44 y área de
44 anclada a la izquierda de la casilla, sin agrandarla). Los enlaces de Planes van en una frase:
`display:inline-flex` solo para que les quepa el alto.

**Capturas** (390 y 1280, Planes y Ajustes en Avisos y Facturación), `docs/master/evidencias/SCRUM-1848/`:
`antes-*.png` y `despues-*.png`, hechas con `capturas.mjs` de la misma carpeta.

**`scripts/guard-objetivo-tactil.mjs` no cubre estas pantallas** (lo dice en su línea 223 para
`renderSettingsView`, y `renderPlansView` no está en su lista): no hay sobrante que endurecer y no se añade
cobertura (fuera de alcance).

## Lo que NO está medido

- En `yaqu.app`: nada (la medida es del banco de vistas servido en local con las hojas del índice).
- Ajustes con otros datos (otro plan, sin referidos): solo los del censo más un mes gratis.
- La suite entera: no se corrió (orden del encargo). Corridos: este test, 237, 976, 700, 1294, 267, 854,
  719 y `npm run guards:entrada`.

A9: sin fallo que generalice — el único tropiezo fue leer en Jira los tres comentarios de SCRUM-1845 cuando el encargo pedía solo c.22728, y es de cómo pide una sesión a Jira, sin rastro en el árbol; se lo dije al orquestador en el momento.

# SCRUM-1848b

**Medido contra:** `origin/main` = `52806530524df7011e7dd73a766f4f7e13dafd73` · 2026-11-25T03:57:18Z

**Skill UI:** cargada (`yaqu-premium-ui`, antes de tocar el CSS)

Relevo (sesión jv-j3df, carril J3; bloque J3 de `styles.css`, contenedor S2): fuera las 4 casillas de
Avisos por c.22742. El PR #3436 caía en CI por un solo test, de S2: `tests/scrum962f-editor-cuatro-44.test.mjs`
③ (las reglas de 44 de la familia `.inline-checkbox` solo valen dentro de `.quote-ajustes`). Decisión del
fundador en SCRUM-1848 c.22742, «Quitar Avisos y avisar»: no se toca ningún guard.

- `styles.css`, bloque `J3: SCRUM-1848`: fuera `.settings-panel .inline-checkbox label` y
  `.settings-panel .inline-checkbox input[type="checkbox"]::before`. Cada una era una regla sola: no hubo que
  partir ninguna. Se queda `.settings-panel .inline-checkbox input[type="checkbox"] { position:relative; }`,
  que por sí sola no hace nada (el encargo decía «nada más del bloque»). El comentario del bloque, al día.
- `tests/scrum1848-ajustes-planes-44.test.mjs`: lista `PENDIENTES` (4 ids) con el motivo literal
  «SCRUM-1848 c.22742: bloqueadas por el ③ de scrum962f (S2) hasta que S2 lo acote». ① exige que cada una
  salga UNA vez por anchura y por debajo de 44, y que los cortos pendientes sean exactamente casillas ×
  anchuras (4 × 3 = 12). Si una llega a 44, cae diciendo que sobra en la lista.
- **Corrección a la decisión, medida:** las 4 casillas no son todas de Avisos. Tres sí (`notifyEmailOnPaid`,
  `notifyEmailOnQuoteAccepted`, `notifyEmailWeeklyDigest`); la cuarta, `showTechPhotoToClient`, se pinta en
  la pestaña «Equipo». Las dos reglas quitadas eran las de las cuatro.
- `tests/_veredicto-mudez.json`: mi ficha, renovada con `npm run censo:mudez -- --escribir` (VIVO). En el
  merge con SCRUM-1849 chocaba con la línea vecina: se tomó la de `main` y se regeneró, sin elegir lado (A4).

**Quedan curados** (verde con navegador: 456 medidas, 10 estados, 390/929/1280): 10 de los 17 del censo
—enlace de referidos, «Copiar link», «Añadir condición», 3 enlaces de exportación, «Quiero mi plaza
founding…», «Mensual», «Anual -17%», «Suscribirme…»— más «Canjear 1 mes gratis», todos entre 44,5 y 45.
Cortos: 21 = 9 de los 3 exentos de c.22728 + 12 de las 4 pendientes (17 px).

**Visto en rojo, a mano** (dos ediciones temporales, deshechas; sin guion ni catálogo, así que por A3 no
cuenta como evidencia repetible): con las dos reglas puestas otra vez, caen 1848 ① («#notifyEmailOnPaid ya da
45 px … sobra en la lista») y 962f ③ (el mensaje del CI); con `showTechPhotoToClient` fuera de la lista,
1848 ① cae con sus 3 medidas de 17 px.

**Verdes en local** (árbol fusionado con `52806530`): 1848 (2/2, con navegador), 962f (6/6, ③ incluido),
419 (el de «todo salto declara su motivo», la regla de SCRUM-456: no hay `scrum456-*`), 237, 976, 700, 719,
1294, 267, 854 y 1849: 103 de 103, 0 saltados. `npm run guards:entrada`: salida 0 (16 guards). Los 5 de
árbol entero de SCRUM-1560 (195, 414, 694, 710b, 737): verdes. `tsc -p .` con tipos: salida 0 (1.428
ficheros, «Check time» 4,11 s).

**Lo que NO está medido:** nada en `yaqu.app`; la suite entera (el encargo lo prohíbe); el check obligatorio
de este empujón, hasta que lo mire.

A9: comprobación → `tests/scrum962f-editor-cuatro-44.test.mjs`

# SCRUM-1848c

**Medido contra:** `origin/main` = `2a6675c978794595696f87fb1a7ed3e52f904adb` · 2026-11-25T14:56:14Z

**Skill UI:** cargada (`yaqu-premium-ui`, antes de tocar el test y el CSS)

Relevo corto (sesión jv-j3dg, carril J3; bloque J3 de `styles.css`, contenedor S2): las 4 casillas que 1848b
dejó PENDIENTES en 17 px vuelven a 44. S2 acotó el ③ en SCRUM-1860 (#3452, `60ef0aeb1`): su caso ③b
comprueba que las dos reglas de J3 limitadas a `.settings-panel` PASAN y que una global sigue CAYENDO (aviso
del orquestador S en SCRUM-1848 c.22785; la decisión que se levanta es c.22742).

- `styles.css`, bloque `J3: SCRUM-1848`: vuelven, literales, las dos reglas que quitó `fbb2a4ab8`
  (`.settings-panel .inline-checkbox label { min-height:44px; }` y su `input[type="checkbox"]::before` de
  44×44), debajo del `position:relative`. Comprobado con `grep -cxF` de cada línea quitada en el diff de
  `fbb2a4ab8` contra la hoja: 1 y 1. El comentario del bloque ya no dice PENDIENTES: dice que las curó 1848c
  porque S2 acotó el ③.
- `tests/scrum1848-ajustes-planes-44.test.mjs`: fuera `PENDIENTES`, `pendienteDe` y la aserción «4 × 3 = 12»;
  las casillas se exigen a 44 como todo lo demás, y el control de población «casillas (4)» de `OBJETIVOS`
  sigue. El nombre del caso ① pierde «y las 4 casillas PENDIENTES por c.22742»: `git grep` de ese literal
  fuera de este registro, 0 catálogos que lo citen.
- `tests/_veredicto-mudez.json`: 719 caía con «el fichero cambió desde la medida»; renovada con
  `npm run censo:mudez -- --escribir` (1 ficha medida de 148). La clase no cambia (VIVO → VIVO): sólo la
  huella, `c10e6e923e3d3875` → `e9de3de91ca68fd8`.

**Rojo primero** (test ya sin `PENDIENTES`, hoja de `main`; `node --test` del fichero, salida 1): 2 casos,
1 pass, 1 fail. `medidas 456 · estados 10 · anchuras 390/929/1280 · cortos 21 (exentos 9)`, y ① cae con
«12 objetivos por debajo de 44 px»: exactamente las 4 casillas a cada anchura, caja 16, toque 17.

| casilla | pestaña | @390 | @929 | @1280 |
|---|---|---|---|---|
| `#notifyEmailOnPaid` | Avisos | 17 | 17 | 17 |
| `#notifyEmailOnQuoteAccepted` | Avisos | 17 | 17 | 17 |
| `#notifyEmailWeeklyDigest` | Avisos | 17 | 17 | 17 |
| `#showTechPhotoToClient` | Equipo | 17 | 17 | 17 |

**Verde después** (el mismo comando con las dos reglas, salida 0): 2/2. `medidas 456 · estados 10 · anchuras
390/929/1280 · cortos 9 (exentos 9)`, y `casillas (4): @390 45 · @929 45 · @1280 45` (el mínimo de las cuatro
por anchura: 17 → 45). Lo único corto que queda son los 9 de los 3 exentos de SCRUM-1845 c.22728: «Vista
previa» 30,9 / 30,6 / 30,6 · «⬆ Subir logo» 30,5 / 30,6 / 30,6 · «Sin color (por defecto)» 30,7 / 30,6 /
30,6. Los otros 13 objetivos, igual que en el rojo (44,5 a 45).

`tests/scrum962f-editor-cuatro-44.test.mjs` (S2, sin tocar), con las dos reglas: 7 casos, 7 pass, 0 fail,
0 saltados (③ y ③b incluidos).

**Verdes en local** (árbol = `2a6675c9`, sin merge pendiente; `main` no se había movido al cerrar): 419, 237,
976, 700, 719, 1294, 267 y 854 en un solo `node --test` a TAP: 93 de 93, 0 saltados; los casos contados por
línea anclada suman los 93 declarados, y el mismo contador sobre el TAP anterior (sin registro ni ficha de
mudez) ve sus 2 rojos. `npm run guards:entrada`: salida 0 (17 guards, 36,9 s). Los 5 de árbol entero de
SCRUM-1560 (195, 414, 694, 710b, 737): 38 de 38. Sin `src/` tocado: el `npm run build` del arranque (salida 0)
es el único `tsc`.

**Capturas** (Ajustes en Avisos y en Equipo, a 390 y 1280), en `docs/master/evidencias/SCRUM-1848/`:
`1848c-ajustes-avisos-390.png`, `1848c-ajustes-avisos-1280.png`, `1848c-ajustes-equipo-390.png` y
`1848c-ajustes-equipo-1280.png`. Salen de una copia de `capturas.mjs` (misma carpeta) con dos cambios —`ESTADOS`
con las pestañas «Avisos» y «Equipo», y el nombre `1848c-<estado>-<ancho>.png`— que no se sube porque el
encargo limitaba los ficheros. Control: las dos de Avisos son idénticas byte a byte (`cmp`) a
`despues-ajustes-avisos-{390,1280}.png` de 1848, hechas con estas mismas dos reglas, y la de 390 es distinta
de `antes-ajustes-avisos-390.png`.

**Lo que NO está medido:** nada en `yaqu.app` (no está desplegado; ① mide el banco de vistas con los datos del
censo, no la pantalla de producción); el toque con un dedo en un móvil real; la suite entera (el encargo lo
prohíbe, y la ficha general la pide antes de empujar: no se corrió); el check obligatorio de este empujón,
hasta que lo mire. Visto de paso en las capturas y sin medir si es del banco o de la pantalla: textos pegados
(«300 plantillas/mesnunca cortamos», «Tienes1», «0(0 pagando)»), iguales en las `despues-*` de 1848.

A9: comprobación → `tests/scrum962f-editor-cuatro-44.test.mjs`
