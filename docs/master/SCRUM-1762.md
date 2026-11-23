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

---

## PIEZA d · EL PARTE DE TRABAJO en escritorio aprovecha el ancho + pasada hallmark (S4 · 20-nov-2026)

**Medido contra:** `origin/main` = `5d6114fb18010482abcb7172882b5c0cf8b35760` · 2026-11-20T11:57:35Z
**Fecha:** 20-nov-2026
**Rama:** `scrum-1762d-hallmark-parte`
**Skill UI:** cargada (`yaqu-premium-ui` + `impeccable`, ANTES de tocar la hoja. AB6: sin texto, sin acción y sin color
nuevos; todo sale de tokens que ya existían (`--brand-tint-ink`, `--brand-ink`, `--ring`); una clase nueva,
`.parte-lateral`, que es solo contenedor; objetivos de 44 px y anillo de foco medidos por la sonda; capturas
antes/después a 390, 1280, 1536 y 1920, en borrador y firmado.)

A9: sin fallo que generalice — dos tropiezos de instrumento, cazados al leer la salida y repetidos en el momento: el primer rojo-primero se corrió sobre una copia de `origin/main` sin módulos ni `dist` y dos de sus «rojos» eran «no encuentro el módulo», no el defecto (se repitió con los fuentes de main dentro del árbol: 7/7 rojos con su motivo); y la primera versión de la sonda medía el desborde con `scrollWidth`, ciego bajo `overflow-x: clip` (lo que ya cuenta `tests/scrum1722c-la-hoja-del-parte-pide-su-ancho.test.mjs`), y pasó a buscar la caja más a la derecha.

**Orden del fundador (20-nov, cabecera del orquestador -25), literal:** «el aprte en escritorio tien edemasiado espacio
por lso lados» y «piensa mas mejoras en cuanto a la skill no la hemos usado para nada no ha mejorado nada visual no?
usala».

### Qué estaba mal (medido, sonda `evidencias/SCRUM-1762/d-parte/capturar-parte.mjs`, fuentes de `origin/main`)
- A 1920 la hoja del parte medía **1120 px centrados, con 276 px muertos a cada lado** (el mismo número que S2 midió en
  la ficha, SCRUM-1768), y la página 1844 px de alto en borrador. A 1280 ya eran dos columnas sin pasillos (SCRUM-1722b):
  el defecto empieza donde la pantalla pasa de 1440 (a 1536, 84 px a cada lado).
- En el parte firmado, «Volver al trabajo» era lo más grande de la pantalla: 600-688 px de ancho, letra de 18,66 px
  (el primario grande de SCRUM-368) y 36 px de alto, al final de la columna; «+ Nuevo presupuesto», también 36 px.
- Los botones del parte seguían con `transition: all` (sloplint 10a de la auditoría de la mañana).
- La firma del cliente: blanco de 15 px sobre `--brand`, **3,3:1** (no es texto grande: no llega a AA).

### Qué cambia (FORMA, no función)
1. **Sin pasillos (patrón 1768).** Desde 1200 px la hoja tiene tope de 1680 y no se centra: se alinea con el título de
   la barra. La cabecera sigue a todo el ancho.
2. **Una LATERAL de verdad** (`.parte-lateral`, 300-360 px; 380 desde 1440): las firmas y, en el parte firmado, sus dos
   salidas debajo («Volver al trabajo», «+ Nuevo presupuesto»), a la vista sin bajar. Es un contenedor en
   `parteDetailView.js` alrededor de tres nodos que ya eran contiguos; el orden del DOM y del tabulador no cambia.
3. **Desde 1500, la principal son dos columnas**: los pasos se leen por parejas en el orden del documento (borrador:
   horas | dictado, mano de obra | materiales, y los datos plegados en dos; firmado: datos | horas, mano de obra |
   materiales). El corte está en 1500 para que entre el portátil de 1536, donde cada columna mide 406 px (más que la
   hoja entera del móvil, 366). El alto de la página baja: a 1920 el borrador pasa de 1844 a **1198 px** y el firmado de
   1420 a **1080 px**; a 1536, de 1844 a **1255** y de 1420 a **871**.
4. **Hallmark:** las salidas a tamaño de botón normal (44 px, 15 px) y **un solo verde de primario** en la lateral, con
   AA (`--brand-tint-ink`, 5,48:1, la receta de S2 en 1762b) para «Volver al trabajo» y la firma del cliente · los
   botones del parte sin `transition: all` y con el **foco instantáneo** · las unidades del parte firmado, bajo su
   cabecera «UNDS» (quedaban a 60 px de ella) · la rejilla ya no reparte el alto que sobra entre sus filas (6 px de más
   sobre cada tarjeta a 1920×1080) · la tarea no pasa de 75 caracteres por renglón.
5. **MÓVIL NO SE TOCA.** Por debajo de 1200 px la lateral se disuelve (`display: contents`) y todo lo demás vive dentro
   de `@media (min-width: 1200px)` o más. La única regla que alcanza al móvil es la lista de `transition`, que no
   cambia ni un píxel en reposo.
- Ficheros: `public/dashboard/js/parteDetailView.js` y `public/dashboard/css/styles.css` (bloque «S4 · SCRUM-1762d», al
  final; un selector del bloque S4 · SCRUM-1722b pasa de `.parte-firmas` a `.parte-lateral`; y la línea de `transition`
  de la regla común de los botones del parte).

### Helper de 915c (firma del orquestador en acta §38)
`plantillaDelPresupuesto(parte)`, también en `window.partePlantillaDelPresupuesto`: UNA definición de «este parte da para
un presupuesto» y de lo que se le pasa al editor (canon de SCRUM-831). La usan las dos puertas de 915b, pintar el botón y
atarlo. Pedido por el orquestador `cobroflash-backend-25` (mensaje entre sesiones, 20-nov) para el lado de S2. El
comportamiento de 915b es idéntico: `tests/scrum915b-presupuesto-desde-el-parte.test.mjs` sigue en verde sin tocarlo.

### Declarado (no entra)
- **Candados de edición, cifras, flujos, el cuadro del dictado y su flujo (SCRUM-683), textos:** sin tocar.
- **El verde de la firma en el MÓVIL** sigue en `--brand` con 3,3:1. El arreglo es quitarle el `@media` a dos reglas del
  bloque; no lo hago porque el encargo dice que el móvil no se toca. Queda para decisión.
- Las unidades bajo «UNDS» se alinean solo en escritorio: en el móvil siguen como estaban, por lo mismo.
- En el parte firmado las unidades se leen «0.5» y en el borrador «0,5»: es formato de cifra, no ropa. No se toca.
- «Sin elegir» y «Sin notas» en los datos de un parte firmado son texto firmado (SCRUM-1698): no se tocan.
- Los colores literales del bloque viejo del parte (sloplint 48) y las píldoras BORRADOR/FIRMADO: la ficha del parte no
  pinta ninguna píldora; las de la lista las arregló S2 en 1762b.

### Huella de función
`capturar-parte.mjs` compara, entre el punto de partida de la rama y el árbol, las palabras, los botones (con sus `data-*`)
y las casillas (con su valor) de la hoja: borrador y firmado × 390/1280/1536/1920, **8/8 IDÉNTICAS** (borrador: 127 palabras,
16 botones, 20 casillas; firmado: 116, 7 y 3), 0 px de desborde y ninguna caja fuera. A 390 exige además las mismas cajas
(hoja, firmas, salidas) y el mismo alto de página que antes: 2345 y 1661 px, iguales. Controles por debajo de 44 px: de 5
a 3 en el firmado de escritorio (los 3 que quedan son las casillas nativas de 13 px de «Tipo», que ya estaban y cuyo
objetivo es su etiqueta). Medidas en `evidencias/SCRUM-1762/d-parte/medidas.json`.

### Tests
- NUEVO `tests/scrum1762d-parte-ancho-y-hallmark.test.mjs` (7): ① la lateral en la ficha pintada · ② el móvil no se
  toca · ③ desde 1200 · ④ desde 1500 · ⑤ salidas y verde con AA · ⑥ sin `transition: all` · ⑦ helper de 915c.
  **Rojo-primero: 7/7 rojos** (②-⑥ con el `styles.css` de `origin/main`; ① y ⑦ con su `parteDetailView.js`); verdes en
  la rama.
- **Ningún test existente cambia de exigencia.** Los 364 ficheros que tocan la ficha del parte, `styles.css` o los bancos
  pasan con el formato nuevo (683b, 1722c, 1693, 1700 y 915b incluidos), salvo dos casos de `scrum1199` que en este
  worktree no encuentran `express` (el árbol no tiene `node_modules` propio) y que no tocan nada de esto.
- **UNA línea en un test de S2, tras mergear main (entró #3273, la 915c).** `tests/scrum915c-presupuesto-desde-la-lista-de-partes.test.mjs`
  l.58 simulaba «el helper no existe» con un `delete` hecho desde fuera del contexto `vm` del banco. Medido con una
  sonda sobre el banco real: recién cargado, dentro = `function`; tras el `delete`, dentro = `function` y fuera =
  `undefined`; tras asignar `undefined`, dentro = `undefined`. En main pasaba porque la función aún no existía; con el
  helper real en el árbol, el caso de l.94 caía («botón sin la función de S4»). La exigencia no cambia.
  Autorización del orquestador `cobroflash-backend-25` (mensaje entre sesiones del 20-nov; Jira caído), copiada LITERAL:
  «AUTORIZO (delegación c.21978, 20-nov ~17:25) tocar UNA línea del fichero de S2 tests/scrum915c-presupuesto-desde-la-lista-de-partes.test.mjs L58: `delete banco.ctx.partePlantillaDelPresupuesto;` → `banco.ctx.partePlantillaDelPresupuesto = undefined;`. Motivo MEDIDO con sonda: el delete desde fuera del contexto vm no borra lo que ve el código de dentro (dentro seguía function; con undefined asignado, dentro = undefined); en main pasaba solo porque la función no existía aún. La exigencia NO cambia — ahora el caso mide DE VERDAD el fallback que dice medir. jobDetailView.js:1969 pregunta typeof !== 'function', así que undefined dispara el fallback como debe.»
- Tras el merge de main: 15 ficheros alrededor del parte, la 915b/915c y los guards de forma, en verde; mutaciones 7/7 y
  sonda 8/8 repetidas. La tanda ENTERA posterior al merge no se tiene: la paró el sistema por falta de memoria en la
  máquina. La anterior al merge (13.990 casos) dio 23 fallos, todos del entorno de este worktree (cliente de Prisma por
  detrás del esquema, sin `node_modules` propio, un formato de fecha de Node) y ninguno en ficheros de esta pieza.

Mutaciones: catálogo → `tests/scrum1762d-parte-ancho-y-hallmark.test.mjs`

Las 7 del catálogo, aplicadas una a una sobre la rama (`evidencias/SCRUM-1762/d-parte/mutaciones.mjs`): **7/7 ROJO**.

### Capturas (fuera de git, A8)
`D:\MILLONARIO\cobroFlash\capturas\SCRUM-1762\d-parte\{antes,despues}-parte-{borrador,firmado}-{390,1280,1536,1920}.png`.
Antes = fuentes de `origin/main` 5d6114fb1; después = el árbol de la rama; los dos con el shell real del panel
(`scripts/_banco-lista.mjs`).

### Pendiente
- El «me gusta» del fundador sobre las capturas: lo trae el orquestador, y S4 no cierra.
- Regla 42 tras el merge: ver el parte en yaqu.app a 1280 y 1920 (cuenta QA, partes #21 y #22) y cotejar con las capturas.
## PR-2 · INICIO (S2 · 20-nov-2026)

**Medido contra:** `origin/main` = `cde9d2f04da5567dc45233cd9356ddcbf5f7cb9e` · 2026-11-20T11:23:11Z
**Rama:** `scrum-1762c-hallmark-inicio` (desde PR-1: los dos anexan al final de styles.css)
**Skill UI:** cargada (`yaqu-premium-ui` + `impeccable`; iconos del set del menú; tokens existentes)
A9: sin fallo que generalice — el tramo se cortó por límite de uso antes de la tanda entera y se retomó; nada entró sin tanda.

- Estructura: «Para hoy» (franja de la Lista, `pintarCifrasDeLaLista`) arriba también para el admin · «Dinero en juego» debajo · «Completa tu configuración» AL FINAL (ranura `#home-configuracion`; el equipo se inserta antes).
- Ropa: emojis → iconos del menú (⚙ 💶 ⚡ 👤 💰 🚀 ⚠; 👋 fuera; 🎉 → ✓ en línea) · sin raya lateral en `.home-hero-card` · 16 px bajo los avisos · un solo H1 (saludo → h2).
- Texto FIRMADO por c.21978: «Cotizaciones» → `appLocale.quotePlural` (el literal del menú) · «0%» con 0 enviados → «—» neutro.
- Tests: NUEVO `scrum1762c-hallmark-inicio` (4) · CAMBIAN 698 (148→151, delta medido por identidad) y 601 (980→1000).
  Autorización del orquestador cobroflash-backend-25 (mensaje entre sesiones; Jira caído, la pega él al volver), copiada LITERAL:
  «AUTORIZO (delegación c.21978, 20-nov ~13:25 local) cambiar exactamente estas exigencias y ninguna más, por el PR-2 de la lavada hallmark de Inicio ordenada por el fundador, rojo-primero visto: ① tests/scrum698-vistas-que-no-se-miden.test.mjs → renderHomeView 148→151, delta MEDIDO por identidad (+div#home-hoy «Para hoy» arriba · +div#home-configuracion ranura final · +span.con-icono--hecho el ✓ del 🎉); las otras tres vistas intactas. ② tests/scrum601-copy-del-documento-vs-flag.test.mjs → re-anclaje por posición de la nota «100% al aceptar» de homeView 980→1000 (medido en main y rama), patrón 1390y/1701/1686/1717.»
  El orquestador RATIFICA aplicar la firma con `appLocale.quotePlural` (el literal del menú) en vez de la palabra fija. «Cotización #8» y «Sin cotizaciones aceptadas aún» quedan declarados para otra ronda con firma propia.

Mutaciones: catálogo → `tests/scrum1762c-hallmark-inicio.test.mjs`

Capturas (fuera de git, A8): `D:\MILLONARIO\cobroFlash\capturas\SCRUM-1762\c-inicio\despues\` (admin y operario, 390 y 1280); el antes es la auditoría de la mañana (`sondas-s2\evid-hallmark-20nov\inicio-*`). Medido después: 0 emojis, un solo H1 («Inicio»), 0 px de desborde.

### Regla 42 del PR-1 (verificado en yaqu.app)
#3271 mergeado (11:50Z). yaqu.app sirve el build `5d6114fb18010482abcb7172882b5c0cf8b35760`, que lo contiene. La sonda
`sondas-s2\capturar-1762.mjs` con `PROD=1` (sin servir nada local, solo GET), trabajo QA 77, admin 390 y 1280, mide
lo mismo que el «después» local: pestaña abierta sobre rgb(236,253,245), «+ Nuevo parte» 13,5 px × 44 px sobre
rgb(4,120,87), 0 emojis y 0 px de desborde. Capturas: `D:\MILLONARIO\cobroFlash\capturas\SCRUM-1762\b-ficha\r42-prod\`.

### PR-2 · exigencias que cambian además de 698 y 601 (cazadas por la tanda; AUTORIZADAS)
- `tests/scrum1341-actividad-del-equipo-sin-importes.test.mjs` L403 y L434: la cabecera «Cotizaciones» pasa a «Presupuestos» (el texto firmado).
- `tests/scrum1686h4-inicio-operario.test.mjs` ⑥: exigía que el admin NO tuviera «Para hoy»; ahora exige que lo tenga, con la misma franja, sin «Por cobrar» y pidiendo su lista una vez.
- `tests/scrum1762c-hallmark-inicio.test.mjs`: control hermano de la negación «Cotizaciones» (SCRUM-237), que con `quotePlural` de LatAm tiene que salir «Cotizaciones».
Rojo-primero: las tres caen con el `homeView.js` de `origin/main`.

Autorización del orquestador cobroflash-backend-25 (mensaje entre sesiones; Jira caído), copiada LITERAL:
«AUTORIZO (delegación c.21978, 20-nov ~13:50 local) cambiar exactamente estas exigencias y ninguna más, consecuencia directa de lo firmado para el PR-2 (texto «Cotizaciones»→literal del menú y «Para hoy» arriba para todos), rojo-primero visto contra main: ① tests/scrum1341-actividad-del-equipo-sin-importes.test.mjs L403 y L434 → la cabecera esperada pasa a 'Presupuestos'; ② tests/scrum1686h4-inicio-operario.test.mjs ⑥ → el admin SÍ tiene «Para hoy», con la misma franja, sin «Por cobrar» y pidiendo su lista UNA vez (['jobs']).»
El control hermano de scrum237 va dentro del test propio (no pide firma, dicho por el orquestador). Tanda local: cortada por el sistema por memoria a ~6.400 pruebas; por decisión del orquestador, arbitra el CI.
