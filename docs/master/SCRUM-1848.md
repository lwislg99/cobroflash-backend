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
