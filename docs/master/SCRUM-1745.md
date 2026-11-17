# SCRUM-1745 — La hoja del albarán y el modal «Agendar», al pulgar (fila 29 del recorrido H6 de SCRUM-1686)

**Puesto:** S4 · **Rama:** `scrum-1745-hoja-albaran-y-agendar-44px` · 17-nov-2026
**Skill UI:** cargada (`yaqu-premium-ui`). `DESIGN.md` y la Parte AB no se releyeron en esta sesión: el cambio no trae token, color, sombra ni texto, sólo medidas (`min-height`, `min-width`, `flex`, `order`, `margin`) y el patrón de casilla que ya usa `.catalogo-productos`.
**Medido contra:** `origin/main` = `b8fc4077c24a4338d73836b9918f51b31b17e1d8` · 2026-11-17T16:26:34Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `scripts/guard-hojas-del-trabajo-44.mjs`

## El defecto, medido

En yaqu.app, a 390 (recorrido H6 de SCRUM-1686, fila 29). El guard lo reproduce contra el `styles.css` descargado de producción el 17-nov-2026 (284.181 bytes, sin el bloque de este ticket): **12 de 18 casos en rojo**, los 12 de móvil.

| dónde | qué medía |
|---|---|
| hoja «Editar albarán», con precios | el Concepto, 30 px de ancho: enseñaba 4 px de un texto que pide 182 |
| hoja, sin precios | el Concepto, 144 px a 390 y 76 a 320: enseñaba 118 y 50 de 182 |
| hoja, campos de cada línea | 36 px de alto (37 de toque) |
| hoja, las dos casillas | 13×13 (14 de toque) |
| hoja, «✕» Quitar línea | 34 px de ancho |
| modal «Agendar» / «Reagendar» | «Cancelar» y el botón principal, 30 px; la fecha, 38 |

Los «?» y «×» de la cabecera ya daban 45 px de toque (SCRUM-962d, de S2): no se tocan.

## Lo que cambia

Un bloque de CSS en `public/dashboard/css/styles.css`, entre `/* ══ S4 · SCRUM-1745 ·` y `/* ══ fin S4 · SCRUM-1745 ══ */`, todo dentro de `@media (max-width: 768px)`. Ni una línea de JS: `jobDetailView.js` y `jobAgendar.js` son de S2.

- **La hoja** se selecciona por su contenido, `.modal-body:has(.alb-precio-field)`, que es el cuerpo que pinta `buildAlbEditor`. Entra así también la hoja de alta, que usa el mismo editor.
- **Cada línea** pasa a dos renglones: el Concepto con su «✕» al lado, y debajo cantidad, unidad, precio e IVA. El «✕» sube con `order`; el orden del DOM (teclado y lector de pantalla) no cambia. Entre una línea y la siguiente van 16 px, para que se vea qué cantidad es de qué concepto.
- **Campos** a 44 px de alto. **«✕»** a 44 de ancho. **Casillas** con el `::before` de la casa (13 + 2 × 16 = 45) y su `label` a 44 de alto, para que dos seguidas no se pisen.
- **`.jobs-modal`**: los botones del pie y los campos, a 44 px.
- Ni un texto nuevo. A 1280 nada cambia.

**Dos decisiones mías que conviene mirar.**

1. `.jobs-modal` no es sólo «Agendar»: es el modal que monta `jobsModal` para todos los de la lista y la ficha del trabajo. La regla va a todos, porque el defecto es del componente («Cancelar» lo pone el propio `jobsModal`). El guard sólo mide Agendar y Reagendar.
2. A 320 con precios, el IVA cae solo a un tercer renglón. Ya pasaba antes del cambio. Meter los cuatro campos en un renglón a 320 dejaría el precio en 37 px útiles, y un importe de cuatro cifras no se leería.

## El guard

`npm run guard:hojas-del-trabajo-44` (`scripts/guard-hojas-del-trabajo-44.mjs`, de navegador). Monta los scripts reales de `dashboard/index.html` menos `app.js`, abre la hoja con `openAlbEditorSheet` y el modal con `window.abrirAgendarTrabajo`, y mide el área de toque con `_medidor-de-toque.mjs`.

**Población:** 18 casos = 6 superficies (albarán en borrador con precios, borrador sin precios, emitido con precios, borrador visto por el técnico; Agendar; Reagendar) × 390×844, 320×568 y 1280×800.

**Verde:** 18 de 18, tres pasadas seguidas con salida 0. Toque mínimo a móvil, 44,6 px. Sin el bloque, 132 controles cortos en los 12 casos de móvil.

**Rojo, sobre copias de la hoja de estilos fuera del árbol** (`HOJAS_CSS`; el árbol no se tocó, commit de partida `e6f1c8312846dd2939ccf8bdf69ffe56fdd7eaf3`):

| copia | salida | qué cae |
|---|---|---|
| el `styles.css` de yaqu.app | 1 | 12 casos: A × 84, B × 32, C × 16 |
| el bloque sin el `::before` de las casillas | 1 | 6 casos: A × 8, B × 8 |
| el bloque sin la regla de `.jobs-modal` | 1 | 4 casos: A × 12 |
| el bloque sin el `flex` del Concepto | 1 | 8 casos: C × 16 |
| el bloque sin el `min-width` del «✕» | 1 | 8 casos: B × 16 |
| el bloque sin el `min-height` de los campos | 1 | 8 casos: A × 64 |
| el bloque aplicado también a escritorio | 1 | 6 casos: E × 6 |
| las reglas del bloque repetidas fuera de él | 2 | F: «sin el bloque salen 0 cortos»: no sabe si mira |

Cada mutación comprobó antes que su texto aparecía una sola vez en el fichero.

**A9 · el guard medía a media animación.** La primera versión de este guard (commit `d7b18fb930b427a115f52d09991bacae5df947c9`, sin empujar) medía nada más abrir la hoja, y `.modal` entra animada (0,18 s en escritorio, 0,22 s en móvil). De ahí salieron tres resultados que no eran del producto: la fecha de Agendar ciega a 390 unas pasadas sí y otras no, «Cancelar» con 42,5 px de toque en una caja de 44, y el «?» de la cabecera bailando de 44,5 a 44,9 a 1280, que tumbaba el control E. Ahora espera a que no quede ninguna animación en marcha, y si a los 5 s sigue habiéndola el caso sale ciego. Se vio porque el mismo árbol daba resultados distintos en dos pasadas seguidas.

## La tanda

Tanda dirigida (`node scripts/tests-que-cubren.mjs --lanzar`): 510 ficheros de test de 1.689, 4.569 tests. En la primera pasada cayeron 5:

- `scrum471` y `scrum476`: del entorno. Este worktree no tiene `node_modules` propio y los dos lo exigen; en el CI sí lo hay.
- `scrum854`: pedía el registro ya commiteado. Pasa tras el commit.
- `scrum548` y, por arrastre, `scrum976`: de esta rama. El guard nuevo sirve su página en una ruta virtual y un puerto efímero, y `scrum548` exige declarar a los guards cuyo destino no se puede derivar del fuente. Declarado, con su motivo y su medida (`__hojas` sólo aparece en este guard).

Después, los seis tests del alta (`scrum548`, `scrum976`, `scrum854`, `scrum522`, `scrum1295`, `scrum1294`): 63 de 63. La tanda completa la juzga el CI.

## Lo que NO está medido

- La hoja de **alta** del albarán: recibe el mismo CSS por el selector, pero el guard abre sólo la de «Editar» (`openAlbCrearSheet` vive dentro de la ficha y no se alcanza desde fuera).
- Los **otros modales** de `.jobs-modal` (asignar, cerrar el trabajo): reciben la regla y no los mide nadie.
- El `::before` de las casillas en un navegador que no sea Chromium. Si no lo pinta, queda el `label` de 44 px, que también marca la casilla.
- El teclado en pantalla y la hoja de dictado.
- **Regla 42:** faltaba al entregar; hecha el 17-nov-2026, abajo («Regla 42»).

## Capturas

En `docs/master/evidencias/SCRUM-1745/`, sacadas por el guard (`HOJAS_CAPTURAS`) con datos de prueba: `hoja-con-precios-390-antes.png` y `-despues.png`, `hoja-tecnico-390-antes.png` y `-despues.png`, `agendar-390-antes.png` y `-despues.png`, `hoja-con-precios-320-despues.png`, `hoja-con-precios-1280-despues.png`. «Antes» es la hoja de estilos del árbol sin el bloque.

## Regla 42 (17-nov-2026, S4) · SCRUM-1745b · la hoja y «Agendar», vistas en yaqu.app

Medido contra `origin/main` = `e5145bc54e9709de09ac362a6d6c4d156bb32ac4`, que contiene el merge de #3193 (`c742cf25dd1cb6ba1b9ca6f4a6ba9036ca0a1204`, 16:57:21Z). `/health` de yaqu.app servía ese mismo SHA a las 17:27:50Z; las pasadas, entre las 17:31Z y las 17:33Z (cabecera `Date:` de `gh api -i zen`).

**1 · La hoja de estilos de producción es la de `main`.** `https://yaqu.app/dashboard/css/styles.css` descargada (287.280 B) y `git show origin/main:public/dashboard/css/styles.css` dan el mismo SHA-256 (`e5323ebf…3ddb80`). El bloque de S4 está dentro.

**2 · El guard, contra ese fichero.** `HOJAS_CSS=<el descargado> node scripts/guard-hojas-del-trabajo-44.mjs` → código 0, «bloque de SCRUM-1745: sí», 18 casos medidos de 18, y su control: sin el bloque, 132 controles cortos en los 12 casos de móvil.

**3 · La página real, sin CSS local.** Instrumento: `docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs` + `docs/master/evidencias/SCRUM-1745/r42-hoja-y-agendar.mjs` (nuevo, en esta rama). Abre la hoja o el modal como los abre el profesional, espera a que acabe la animación, mide con `scripts/_medidor-de-toque.mjs` y no pulsa nada que envíe. Cuenta QA, rol admin. Nueve pasadas, las nueve con código 0:

| qué | ventana | controles | toque mínimo | Concepto | se sale de lado |
|---|---|---|---|---|---|
| hoja · AB260008 (borrador, con precios, trabajo #84) | 390×844 | 17 | 44,6 px | caja de 292, ve 290 de 290 | no |
| hoja · AB260008 | 320×844 | 17 | 44,6 px | caja de 222, ve 220 de 220 | no |
| hoja · AB260008 | 1280×800 | 17 | 14 px (casilla) | caja de 119,8, ve 118 de 204 | no |
| hoja · AB260003 (borrador, sin precios, trabajo #76) | 390×844 | 14 | 44,6 px | caja de 292, ve 290 de 290 | no |
| hoja · AB260003 | 320×844 | 14 | 44,5 px | caja de 222, ve 220 de 220 | no |
| hoja · AB260003 | 1280×800 | 14 | 14 px (casilla) | caja de 231,1, ve 229 de 229 | no |
| «Agendar» (lista de Trabajos, un trabajo sin agendar) | 390×844 | 3 | 45 px | — | no |
| «Agendar» | 320×844 | 3 | 45 px | — | no |
| «Agendar» | 1280×800 | 3 | 30,9 px | — | no |

A 390, en la hoja con precios: Concepto 292×44 con su «Quitar línea» de 44×44 al lado; debajo cantidad, unidad, precio e IVA de 81×44; las dos casillas (caja de 13×13) reciben el toque en 46 de alto y 45 de ancho; «+ Añadir línea», «Guardar cambios» y «Cancelar», 44 de alto. En «Agendar», la fecha 342×44, «Cancelar» 80×44 y «Agendar» 76×44. El ANTES es el de la entrada P1-1745 de `docs/BUGS.md`, medido en yaqu.app en el recorrido H6: Concepto de 30 px, campos de 36, «✕» de 34 de ancho, botones del modal de 30 y fecha de 38.

A 1280 las cifras son las de escritorio que el guard da «sin el bloque» (campos de 34, casillas de 14, modal 36,9 / 30,9 / 30,9): el bloque no toca el escritorio.

Escrituras de las nueve pasadas: sólo `POST /admin/entorno`. No se guardó ni se agendó nada.

**No medido en producción:** la hoja de un albarán EMITIDO (el #54, AB260009: su fila en la ficha del trabajo #85 no ofrece «Editar líneas»; el guard sí mide ese caso sobre la página montada), «Reagendar», el rol técnico, la ventana de 320×568 (el banco usa 844 de alto), Safari y el teclado en pantalla.

**Apuntado, fuera de este ticket:** a 1280, en la hoja CON precios, el Concepto enseña 118 px de un texto que pide 204 («(prueba) Latiguillo de 40 cm»). Es el reparto de escritorio de antes de SCRUM-1745, que este ticket no toca (su aceptación es el móvil y el guard exige que a 1280 nada cambie). Avisado al orquestador, que lo ha abierto como SCRUM-1753.

**Lo que salió mal (A9).** Tres cosas, las tres mías:
- Lancé la primera pasada sin `node scripts/qa/sesion-panel.mjs estado` (RUNBOOKS R23): la cookie QA había caducado a las 15:39Z y `GET /admin/me` dio 401. No se leyó como limpia porque la acción tiene suelo: sin el botón que abre la hoja lanza CIEGO y `paso2.mjs` sale 1. El mismo suelo saltó con el trabajo #85, donde el albarán está emitido y el botón no existe.
- Mi acción exigía 44 px de ancho donde el guard exige 43,5 (el ancho se tantea a pasos de 0,5 px), y dio tres rojos falsos en el «?» de la cabecera (43,5). Era mi instrumento, no el producto: lo igualé al guard y lo dejé escrito en la acción.
- Dejé el directorio de trabajo dentro de `docs/master/evidencias` con un `cd`, y el hook `guard-dangerous` (ruta relativa) dejó de encontrarse y bloqueó todo hasta volver a la raíz del árbol.

A9: comprobación → `docs/master/evidencias/SCRUM-1745/r42-hoja-y-agendar.mjs`
