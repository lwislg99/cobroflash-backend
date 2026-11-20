# SCRUM-1725 — Trabajos del operario: la lista sin el estado de cobro (D1, mitad de la lista)

**Puesto:** S4 · **Rama:** `scrum-1725-lista-operario-sin-cobro` · 12-nov-2026
**Skill UI:** no cargada · sólo quita elementos por rol; ni un estilo, token, clase ni texto nuevo
**Medido contra:** `origin/main` = `8f235725590f2c984b1709a5331ff26a53f25792` · 2026-11-12T15:30:00Z
A9: comprobación → `tests/scrum1725-lista-operario-sin-cobro.test.mjs`

**Encargo:** GO del orquestador a la propuesta de S4 (D1): recorte por rol en `jobsView.js` — sin «Por cobrar», sin filtros de cobro y sin «X € de Y €» para quien no ve el cobro; cero textos; desde main, sin esperar al paquete 1662+1707. La ficha (`jobDetailView.js`) y «Qué hay que hacer» son de S2.

## Por qué (medido en yaqu.app, propuesta de 1725 §⓪)
Firmado en SCRUM-1707 c.21547 (Q1): el operario ve el importe de sus trabajos, «pero SIN la tarjeta "Por cobrar" ni los filtros de cobro del negocio». El 1707 de servidor vacía `totalCobrado` y `estadoCobro`, pero esta lista calcula «lo que falta» en el navegador: simulado el paquete sobre yaqu.app a 390, con rol técnico y sólo sus trabajos, seguían «POR COBRAR 1,21 €», «Pendiente · 0 / Parcial · 0 / Pagado · 0» y «1,21 € de 1,21 €». Con lo cobrado vacío (→ 0), en un trabajo cobrado a medias la lista diría que falta todo. Una cifra falsa.

## Qué cambia (sólo `public/dashboard/js/jobsView.js`)
- `veEstadoDeCobro(rol)`: lista blanca (`admin`), fail-closed como `puedeVerEconomia` (SCRUM-597). Va en `window` para que la ficha haga la MISMA pregunta (canon de SCRUM-831).
- Para quien no la pasa: sin la tarjeta «Por cobrar»; sin los filtros Pendiente/Parcial/Pagado (y el filtro vuelve a «todos»); sin «· X por cobrar» en la cabecera de Terminados ni su salvedad; la celda de importe, una línea con el importe (`importeReferencia`), sin «de» ni lo que falta. «Sin importe / no hay presupuesto aceptado» se queda como está.
- Para el admin no cambia nada.
- Textos: ninguno nuevo. La cabecera «✅ Terminados — cobra el resto» se queda para todos: cambiarla al operario es M1 de la propuesta, y pide firma.

## Comprobación
- Test nuevo, con la vista REAL en el banco (sin navegador): técnico y un rol desconocido (`contable`) no ven nada del cobro y sí el importe; el admin, de control positivo, lo ve todo. 3/3.
- Mutación: `veEstadoDeCobro` → `true` (el comportamiento de main) tumba los dos casos sin permiso (2 ✖); el positivo sigue verde.
- Vecinos: los 33 ficheros `tests/*.test.mjs` que nombran `jobsView`/`renderJobsView`, más el nuevo: **334/334, 0 fallos, 0 saltos**.
- En yaqu.app, tras el merge (regla 42): la sonda de la propuesta (`sonda-trabajos.mjs`, FIEL=1) sin nada local, a 390 y 1280.

## Apéndice · 12-nov-2026 (noche): el rojo del CI y su arreglo
El obligatorio «build + tests» de #3127 cayó a las 15:34Z con UN fallo: `tests/scrum1415-nombres-construidos.test.mjs` (el árbol). Los dos casos sin permiso salían de un bucle con el nombre construido (`rol «${rol}»`), y un test nuevo se escribe con nombre literal: la lista de SCRUM-1415 sólo baja.
- Arreglo en el TEST, no en el guard (regla 41): el cuerpo pasa a `sinCobroParaElRol(rol)` y los dos `test(…)` llevan su nombre escrito. Los nombres que registra la tanda son los mismos de antes.
- Por qué no se vio antes de empujar: se corrieron el test nuevo, la mutación y los 33 vecinos de `jobsView`; `scrum1415` no nombra `jobsView` y no entró en esa selección.
- Medido tras el arreglo: `scrum1415` 6/6 y `scrum1725` 3/3 (9/9, 0 fallos, 0 saltos).

## Ficha (S2 · 18-nov)

**Puesto:** S2 · **Rama:** `scrum-1725f-ficha-visual` · 18-nov-2026
**Skill UI:** yaqu-premium-ui + impeccable (registro `product`), cargadas antes de tocar nada; DESIGN.md única fuente de tokens; checklist AB6
**Medido contra:** `origin/main` = `bcff9d8b1ea465938ef797c17548cb5217de02bc` · 2026-11-18T15:43:13Z
A9: comprobación → `tests/scrum1725-ficha-lenguaje-del-parte.test.mjs`

**Encargo (c.22052):** la FICHA del Trabajo (`jobDetailView.js` + `styles.css`) con el mismo lenguaje visual que el parte de 1722 —tarjeta por bloque, jerarquía de títulos, acciones que parecen botones, 390 primero—. Cero textos nuevos; cifras y flujos intactos (la línea «Tipo de intervención» de c.22019 y la primaria única de c.22030/c.22041 no se tocan). M2 decidido (sin bloque vacío), M3 aplazado.

### Qué cambia (forma, no función)
- `styles.css`, bloque «S2 · SCRUM-1725» al final del fichero. Todo cuelga de `.detail-page--trabajo`: `.detail-page` lo comparten cinco fichas (albarán, gasto, factura, presupuesto, trabajo) y las otras cuatro no cambian.
  - La hoja deja de ser UNA tarjeta partida por rayas: cada bloque es su tarjeta (borde 1 px + Reposo, radio lg, 16/20 px), sobre el lienzo, con 16 px entre ellas. El rail (cliente, dónde, presupuesto, responsable) es UNA tarjeta de contexto con sus bloques separados por la raya fina; a 390 sigue arriba (SCRUM-318).
  - Cabecera sobre el lienzo: título 1,375 rem/800 en Tinta (el número del parte), cita en Tinta 600.
  - Títulos de bloque en Tinta, 18 px, 700, sin versalitas (los del parte). Los del rail son literales en mayúsculas (`JOB_RAIL_TITULOS`) y no se reescriben: llevan el estilo Label de DESIGN.md §3.
  - Relleno = se pulsa: `.btn-secondary` pasa de blanca con contorno (igual que una casilla) al relleno neutro del parte. La única voz verde sigue siendo la primaria.
  - Partes y albaranes a 390: filas de la tarjeta separadas por la raya fina, no tarjetas dentro de la tarjeta. A ≥641, la tabla va de borde a borde de su tarjeta (DESIGN.md §5) y número, fecha y estado no se parten.
  - De paso, en esta misma pantalla: a 1280 la celda «Estado» del albarán era `display: flex`, dejaba de ser celda y su raya quedaba más arriba que la de sus vecinas. Vuelve a ser celda.
- `jobDetailView.js`: la clase `detail-page--trabajo` en el contenedor, y un espacio delante de cada badge de la celda de estado del albarán. Sin él, el texto de la ficha decía «EMITIDOSin precios» (medido en yaqu.app a 390, ya en prod antes de este cambio) y así lo lee un lector de pantalla. Ni una palabra nueva.

### Comprobación
- Sonda `docs/master/evidencias/SCRUM-1725/prod-1725-ficha-visual.mjs` (corre desde `sondas-s2/`, junto a su `comun.mjs`), sólo GET con control positivo del interceptor, build `bcff9d8b1`. Fichas #76, #82, #77, #84 y #86 (terminado con 8 albaranes, sin agendar mínimo, en curso con importe y 6 partes, en curso con tarea y dirección, agendado hoy con «▶ Empezar»), a 390 y 1280, como OPERARIO simulado (rol `tecnico` y la proyección de `trabajoParaElRol.ts` @ `bcff9d8b1`) y como ADMIN real (control). «Antes» = yaqu.app tal cual; «después» = el mismo yaqu.app sirviendo el `jobDetailView.js` y el `styles.css` de esta rama.
- **Huella de función, 20/20 iguales**: el texto de la ficha (sin contar mayúsculas, que las pone el CSS, y con el espacio nuevo entre pastilla y badge), la lista de botones y enlaces visibles, los importes y las primarias son los mismos antes y después. El instrumento SÍ ve diferencias: en la primera pasada marcó 8/8 por las mayúsculas y 2 por el espacio que faltaba a 1280.
- Después: desborde horizontal 0, ninguna caja fuera del viewport, ningún control táctil por debajo de 44 px a 390, 0 errores de página. El operario ve 1 importe y el admin 2 (#77), como pide D1.
- Test nuevo, 6/6: la frontera (toda regla del bloque cuelga de `.detail-page--trabajo`, con control positivo de una regla suelta), la clase sólo en la ficha del Trabajo, sólo tokens en el bloque (con control positivo: un `#dc2626` a mano se caza) y el espacio delante de los tres badges. El mismo test contra los ficheros de `origin/main` da 6/6 rojos.
- Tanda completa local (13 840 tests): 4 fallos en la primera pasada. Dos eran de este test y se arreglaron EN EL TEST, con los guards intactos (regla 41): `scrum553` (extractores con el `>` pegado → sin él) y `scrum700` (filtro de comentarios propio → `soloEjecutable`, con `almohadillaEsComentario: false`, porque en CSS `#` es un color). Los otros dos son `scrum1726` D1, y no los toca este cambio: prueban el servidor (`dist/app.js`) y esta máquina (Node 24.8, ICU 77.1) formatea «3 de octubre de 2026, 0:30» donde el test espera «a las 0:30». Tras el arreglo: `scrum1725` + `scrum553` + `scrum700`, 27/27.
- Aceptación (capturas antes/después y el «me gusta» del fundador): las rutas van en la entrega al orquestador. El ticket NO lo cierra S2.

### Ficha · el rojo del obligatorio y su arreglo (S2 · 18-nov, relevo)
A9: comprobación → `tests/scrum719-el-suelo-de-los-doce.test.mjs`
- El check obligatorio de #3227 cayó con 3 ✖, los tres en ficheros de esta rama (TAP del run 44341511745):
  - `scrum1233g` («todo banco que intercepta yaqu.app bloquea el service worker»): la sonda importaba `comun.mjs` por ruta absoluta fuera de git, así que desde el repo no se podía comprobar que bloquease el SW. **Arreglo:** `comun.mjs` sube a `docs/master/evidencias/SCRUM-1725/` (copia byte a byte de `sondas-s2/comun.mjs`, que abre el contexto con `serviceWorkers: 'block'`) y la sonda lo importa por `./comun.mjs`. La sonda ya no «corre desde `sondas-s2/`»: corre desde su carpeta.
  - `scrum719` SCRUM-1395 ② («un test NUEVO no llama al filtro sin suelo»): el test nuevo llamaba a `soloEjecutable`. **Arreglo:** `ejecutableDe` con ancla `.detail-page--trabajo` (de esa clase cuelga todo el bloque) y `almohadillaEsComentario: false`.
  - `scrum719` SCRUM-1395b ① (el veredicto de `censo:mudez`, al día): **regenerado** con `npm run censo:mudez -- --escribir`: 1 medido de 133, VIVO; 0 mudos, 0 ciegos.
- Los tres guards quedan como estaban (regla 41). Medido en local tras el merge de `main` (`dd26ef66fa8d9e92cbefc116e6f55da900db6fb0`): `scrum1233g` + `scrum719` + `scrum1725`, 45/45 · los 31 tests que recorren `evidencias/`, 303 pass · 0 fail · 8 saltos (BD).
- Mi lectura del porqué: la tanda completa se corrió ANTES de dos cambios (pasar a `soloEjecutable` para contentar a `scrum700`, y subir la sonda al repo), y después sólo se repitieron los ficheros que habían caído. Cambiar de instrumento destapó dos guards que vigilan ese instrumento, y nadie los volvió a correr. El obligatorio lo cazó antes del merge.
- `guard:escalera-por-estado` (job «guards de navegador», no obligatorio): rojo, **igual que la BASE de `origin/main`** que midió S4 hoy. Las 32 líneas de su salida estándar están todas en la mía y no hay ninguna distinta: la misma tabla, con lista y detalle sin casar en `pendiente_agendar`, `agendado`, `en_curso` y `terminado`. Mi pasada dice además «4 hallazgos · 2 ciegos» (los dos «NO SUPE MIRAR» del DETALLE). Eso sale por la salida de error, y la BASE no la guardó, así que esa línea no la he podido comparar. No lo causa este CSS y no se arregla en esta rama.
## Lista (S4 · 18-nov)

**Puesto:** S4 · **Rama:** `scrum-1725e-lista-visual` · 18-nov-2026
**Skill UI:** cargadas (`yaqu-premium-ui` + `impeccable`; DESIGN.md única fuente de tokens; Parte AB: una pantalla)
**Medido contra:** `origin/main` = `bcff9d8b1ea465938ef797c17548cb5217de02bc` · 2026-11-18T15:29:14Z
A9: comprobación → `docs/master/evidencias/SCRUM-1725/c1725e-lista.mjs`

**Orden (fundador, 18-nov, literal):** lavado de cara del panel, «clean nuevo elegante facil de usar intuitivo bien ordenadas las cosas». Se empieza por Trabajos. Esta sección es la LISTA (`jobsView.js` + un bloque propio en `styles.css`); la ficha es de S2, en otra rama.

### Qué se midió antes (yaqu.app, cuenta QA, 390) y qué se hizo
| # | Medido | Arreglo (solo ropa) |
|---|---|---|
| ① | El título «Trabajos» gastaba una tarjeta de 70 px para repetir la barra de arriba (hallazgo (c) de c.21809) | Deja de ser tarjeta. A 390 no se pinta (el `h2` sigue para quien lo oye); desde 641, título Headline en el mismo renglón que «Nuevo trabajo» |
| ② | La lista era una tarjeta con tarjetas dentro, y cada rótulo de grupo era OTRA tarjeta de 65 px con una etiqueta de 12 px en mayúsculas | La lista no es tarjeta: las tarjetas son los trabajos (borde 1 px + Reposo, radio lg, 16 px). El rótulo de grupo es un título (1,0625 rem/700 Tinta a 390; 0,9375 rem en la tabla), de 22 px de alto |
| ③ | «🔒 Cerrados» gastaba dos tarjetas: su rótulo y «Ver 2 cerrados» (65 + 88 px) | Un renglón de 44 px: el rótulo a la izquierda y el botón a su derecha |
| ④ | «Sin importe / no hay presupuesto aceptado» ocupaba media tarjeta y dejaba al cliente en 19 letras por línea | Con «Sin importe», las dos frases bajan a un renglón propio bajo los datos; el cliente y la tarea recuperan el ancho entero. Con importe, la cifra sigue arriba a la derecha |
| ⑤ | En la tarjeta EN CURSO, cuatro botones en dos filas sin orden; los cuatro filtros de cobro, en dos renglones | La rellena (el paso de hoy) a todo el ancho; debajo las demás, con el «⋯» cerrando a la derecha. Filtros de cobro en un renglón |

Nada cambia de sitio en el DOM ni de significado: mismo orden de botones (el del teclado), sin ningún `order`. No se estrena token, color, sombra ni icono. El único cambio de `jobsView.js` es M1.

### M1 (texto firmado)
Para quien no pasa `veEstadoDeCobro`, la cabecera del grupo dice «✅ Terminados», a secas; el admin conserva «✅ Terminados — cobra el resto». Firmado por el orquestador por delegación (SCRUM-1656 c.21978), registrado en SCRUM-1725 c.22052 y en `docs/microcopy/2026-11-18-SCRUM-1725-terminados-sin-cobra-el-resto.md`.

### Medidas (banco H6 sobre yaqu.app, solo lectura; «después» = JS y CSS de esta rama servidos encima)
Población: 8 pasadas (antes/después × admin/operario × 390/1280); admin 9 tarjetas en 5 grupos, operario (rol `tecnico` vestido) 3 en 2.

| | antes | después |
|---|---|---|
| Desborde horizontal de la página | 0 en las 4 | 0 en las 4 |
| Contenido de las tarjetas (cliente, tipo, tarea, dirección, importe, fecha, botones y cuál va rellena), comparado como CONJUNTO | — | idéntico: 0 líneas distintas de 9, 9, 3 y 3 |
| Tarjetas con dos rellenas · rellena que no va primera (SCRUM-1739) | 0 · 0 | 0 · 0 |
| Con tipo · con tarea · con dirección (admin; SCRUM-1670c/1679) | 5 · 3 · 6 | 5 · 3 · 6 |
| Botones de tarjeta por debajo de 44 px | 0 | 0 |
| Dónde empieza la lista a 390 (admin · operario) | 645 px · 393 px | 522 px · 317 px |
| Alto de la página a 390 (admin · operario) | 3.692 · 1.370 px | 3.546 · 1.305 px |
| Rótulo de grupo a 390 | 340×65, tarjeta | 354×22, título |
| «Cerrados» a 390 | 65 + 88 px, dos tarjetas | un renglón de 44 px |

Capturas y medidas: `docs/master/evidencias/SCRUM-1725/{antes,despues}-lista-{admin,tecnico}-{390,1280}.{png,txt}`.

### Tests
- `tests/scrum1725-lista-operario-sin-cobro.test.mjs`: 3/3, con M1 dentro (técnico y rol desconocido «✅ Terminados · N» a secas; admin, de control, su cabecera entera).
- El test distingue por construcción: exige una cabecera a cada rol y la otra al admin, así que ni «todos con — cobra el resto» ni «todos a secas» lo pasan. No se declara ninguna mutación como evidencia: el guion de un solo uso que la corría no nombraba el catálogo (guard SCRUM-1387, cazado en `guards:entrada` antes del push) y se retiró; llevarla al catálogo queda como resto.
- Vecinos: los 215 ficheros `tests/*.test.mjs` que nombran `jobsView`, `styles.css`, `docs/microcopy` o las clases de la lista → 1.824 casos · 1.815 pass · 2 fail · 7 skip. Los 2 rojos son de SCRUM-1199 y son de entorno: `express` no está en el `node_modules` de este árbol (comprobado: no existe la carpeta).

### Lo que NO se ve en las capturas, y lo que queda fuera
- **M1 no sale en las capturas del operario:** en la cuenta QA el operario no tiene ningún trabajo terminado. Lo prueba el test; en pantalla se verá cuando tenga uno.
- Hallazgos (a) y (b) de c.21809 (acciones que el técnico no debería ver; filtro «Técnico» pintado al operario) NO entran: cambian flujo. Confirmados hoy en la captura del operario: el filtro «Técnico» sigue pintado, y en sus tarjetas salen «+ Nuevo albarán», «Emitir albarán» y «Agendar».
- Escritorio: la tabla se queda tabla; solo cambian la cabecera y el rótulo de grupo.
- Pendiente: el «me gusta» del fundador sobre las capturas, y la regla 42 tras el merge (las mismas pasadas, sin `LOCAL_DIR`).

## Escalera por identidad (S2 · 18-nov · 1725h)

**Puesto:** S2 · **Rama:** `scrum-1725h-escalera-por-identidad` · 18-nov-2026
**Skill UI:** no cargada · no cambia nada que se vea: una marca `data-accion` en un botón que ya existe, sin texto, clase ni estilo nuevos
**Medido contra:** `origin/main` = `b3fe6ba82d6e6afa6590cbf3c669510a792943e5` · 2026-11-18T17:20:38Z
A9: comprobación → `scripts/guard-escalera-por-estado.mjs`

**Autorización (SCRUM-1725 c.22107, nominal del orquestador), copiada:** «AUTORIZO cambiar los 4 selectores de guard:escalera-por-estado (L125/176/223/260) de `.detail-head button.btn-primary` a `.detail-head button[data-accion="cta"]`, retirar el respaldo muerto, y añadir `cta.dataset.accion = 'cta'` en jobDetailView.js — porque el guard miraba por PESO y el canon de 1749 lo dejó ciego Y MUDO (tu mutante del cerrado lo prueba); por identidad queda MÁS estricto.»

### El defecto (instrumento, no producto)
- `guard:escalera-por-estado` (job «guards de navegador», fuera del obligatorio) llevaba rojo en `main` desde el merge de SCRUM-1749 (`bcff9d8b1`): 4 «DISTINTAS» y 2 «NO SUPE MIRAR» en el DETALLE. Sobre `ddb811109`, el padre de ese merge en `main`, salía verde (EXIT 0).
- Causa: 1749 deja el CTA de la cabecera con contorno (`btn-secondary`) cuando no es el paso de hoy, y el guard lo buscaba por `button.btn-primary`. El rótulo lo sigue dando `jobNextAction` en la lista y en la ficha. Lo que se quedó sin medir fue el detalle, no hubo desacuerdo entre las dos pantallas.
- Lo grave: ③ («un Trabajo CERRADO no propone nada») estaba MUDO en el detalle. Con un cerrado que propone «MUTADO», el guard de `main` decía «✅ DETALLE: sin acción principal» y seguía dando los mismos 4+2.
- El respaldo `[data-accion="cta"] button.btn-primary` no lo encontraba nadie: en `jobDetailView.js` no había ningún `data-accion`.

### Qué cambia
- `public/dashboard/js/jobDetailView.js`: `cta.dataset.accion = 'cta'` justo después de poner su rótulo. Es la identidad del CTA, pese lo que pese. Ni texto, ni clase, ni estilo.
- `scripts/guard-escalera-por-estado.mjs`: los 4 selectores del DETALLE pasan a `.detail-head button[data-accion="cta"]`, y el respaldo muerto se va. Nada más del guard: suelos, mensajes y exigencias, iguales.

### Comprobación (salidas en `docs/master/evidencias/SCRUM-1725/1725h/`)
- Base, esta rama: `escalera-1725h-base.txt`, EXIT 0, 0 ciegos. Lista = detalle en los cinco estados, ② y ②-bis medidos en el DETALLE (modal y fecha; `PATCH {"status":"en_curso"}`), ③ verde con la pantalla montada (137 nodos).
- Mutante de rótulo (`cta.textContent = nextAct.label;` → `cta.textContent = nextAct.label + ' (mutado)';`): `escalera-1725h-rotulo.txt`, EXIT 1, «6 hallazgos · 0 ciegos».
- Mutante de cerrado (`const nextAct = jobNextAction(job, !isTecnico);` → `… || { kind: 'nuevo', label: 'MUTADO' };`): `escalera-1725h-cerrado.txt`, EXIT 1, «2 hallazgos · 0 ciegos», con «un Trabajo CERRADO propone «MUTADO»». Es justo el caso que el guard de `main` daba por verde.
- Cada mutante se aplicó, se corrió el guard y se restauró `jobDetailView.js` byte a byte (comprobado). El guion NO está en git: SCRUM-1387 manda al catálogo del meta-guard todo banco de mutación nuevo en `evidencias/`, y ese catálogo corre tests de node, no guards de navegador. Por eso esta tanda no lleva línea `Mutaciones:`, y la receta exacta (de → a) queda aquí arriba.
- Fuera de esta rama (carril de S4, apuntado por el orquestador para su brief): el lado LISTA del guard se ancla a `tr.jobs-fila` y `.jobs-acciones > button`, y la lista plana de #3233 puede cegarlo. No lo he medido.
## Lista plana (S4 · 18-nov · SCRUM-1725g)

A9: comprobación → `docs/master/evidencias/SCRUM-1725/c1725g-lista.mjs`
Mutaciones: catálogo → `tests/scrum1725-lista-operario-sin-cobro.test.mjs`

**Por qué.** El fundador vio la lista de 1725e y dio veredicto (SCRUM-1725 c.22073): «no me acabna de gustar es muy lioso la lsita […] me molaria un listado normal como los que tenemos en otros sitios». La vuelta anterior era de ropa; ésta es de estructura.

**PASO 1, medido en yaqu.app** (cuenta QA, 1280 y 390; `g1-patron-listas.mjs`, salida en `plana-paso1-patron-listas.txt`):

| lista | `tbody` | filas de cabecera en el cuerpo | filas con píldora de estado |
|---|---|---|---|
| Presupuestos | 1 | 0 | 10 de 10 |
| Albaranes | 1 | 0 | 12 de 12 |
| Trabajos (antes) | 5 | 7 | 0 de 9 |

**Qué cambia** (`jobsView.js`, bloque `S4 · SCRUM-1725g` de `styles.css`):
- Un `tbody`, una fila por trabajo, ninguna cabecera de grupo. Columna «Estado» con la píldora de `jobStatusMeta` (la de la ficha).
- El ORDEN es el de siempre sin sus rótulos: en curso → hoy → esta semana → sin agendar → más adelante → terminados. `grupoDeTrabajo` sigue siendo la única regla (ordena, cuenta «Para hoy», decide el «▶ Empezar» relleno).
- Los cerrados siguen plegados: «Ver N cerrados» es la última fila.
- Móvil: la tarjeta gana el área `status` (a la derecha del renglón de la fecha, como en Presupuestos y Albaranes). Escritorio ≥1200 px: la celda de acciones se asegura 296 px, porque con la columna nueva el trío «Ver detalle · Enviar para firmar · ⋯» partía en dos renglones.

**Firmas y autorizaciones** (orquestador, por la delegación de SCRUM-1656 c.21978):
- c.22076 · P1 `<th>` «Estado» (registrado en `docs/microcopy/2026-11-18-SCRUM-1725-estado-en-la-lista-de-trabajos.md`) · P2 el orden · P3 los cerrados · P4 el cobro.
- c.22077 · autoriza cambiar lo que exigen `tests/scrum428-terminado-sin-cobrar.test.mjs` L71 y L178 y `tests/scrum1725-lista-operario-sin-cobro.test.mjs` L74, L89 y L92, «porque el REQUISITO cambió […] no para esquivar un rojo».
- c.22078 · amplía a 428 L130-157 y a `scripts/guard-lista-trabajos-917.mjs` B.1, C.4 y C.5.
- c.22081 · autoriza `tests/scrum816-la-lista-no-miente.test.mjs` L136-140 (pasa a exigir que la columna «Estado» existe y que su celda lleva UNA sola píldora de `jobStatusMeta`; el resto del caso no se toca) y guard-917 B.3 (pasa a «exactamente UNA píldora por fila, nunca dos apiladas», o se retira si C.4 ya lo exige idéntico).

**Lo que se PIERDE, declarado (P4):** el subtotal «por cobrar» de SOLO los terminados y la salvedad larga («N sin importe de referencia: no se sabe cuánto falta y no entran en el total.»). Queda la tarjeta «Por cobrar» (importe + «N sin importe de referencia, no entra(n)») y, fila a fila, «💰 Cobrar el resto (importe)» y «X de Y». **M1 (c.22052) queda superado**: no hay cabecera para ningún rol; su doc de microcopy se conserva, anotado.

**`resumenTerminadoSinCobrar` pierde su llamador en la lista.** El motor (`terminadoSinCobrar.js`) y sus tests unitarios (428 L109-128 y siguientes) no se tocan; su retirada, si procede, es ticket aparte del orquestador.

**Rojo primero** (código nuevo, tests sin tocar): `plana-rojo-primero.tap.txt`, 12 casos, 6 caídos (1725 ×3 por L74/L89; 428 ×3 por L71, L140 y L178). `plana-guard917-rojo.txt`: 49 comprobaciones, 5 rojas (B.1, C.4 ×2, C.5 ×2). Después: los dos tests, 13 de 13; el guard, 51 de 51 (`plana-guard917-verde.txt`).

**Mutaciones** (declaradas en el test, vistas en rojo en local con base verde y restauración byte a byte): vuelve un rótulo de grupo → caen 4 casos; `SECUENCIA` con `terminado` delante → cae el caso de 1725g; píldora vacía → cae el caso de 1725g.

**Antes/después en yaqu.app** (`c1725g-lista.mjs`; el después sirve `jobsView.js` y `styles.css` del árbol sobre producción). Capturas `antes-plana-*` y `despues-plana-*`:

| pasada | filas antes → después | tarjetas solo-antes / solo-después | orden | cifras y filtros | cabeceras | con píldora | desborde | <44 px |
|---|---|---|---|---|---|---|---|---|
| admin 1280 | 9 → 9 | 0 / 0 | idéntico | idénticos | 6 → 0 | 0 → 9 | 0 | 0 |
| admin 390 | 9 → 9 | 0 / 0 | idéntico | idénticos | 6 → 0 | 0 → 9 | 0 | 0 |
| operario 1280 | 3 → 3 | 0 / 0 | idéntico | idénticos | 2 → 0 | 0 → 3 | 0 | 0 |
| operario 390 | 3 → 3 | 0 / 0 | idéntico | idénticos | 2 → 0 | 0 → 3 | 0 | 0 |

Las tarjetas se comparan como CONJUNTOS de líneas (cliente, tipo, tarea, técnicos, dirección, importe, fecha y botones con su relleno). «Ver 2 cerrados» sigue al pie en las dos del admin. El operario no tiene filtros de cobro: ahí «filtros idénticos» compara dos vacíos y no prueba nada.

**816 y guard-917 B.3: una sola píldora por fila (c.22081).** La columna «Estado» de la P1 tumbaba el caso 5 de `tests/scrum816-la-lista-no-miente.test.mjs`, que exigía que NO existiera. Rojo primero, con el test SIN tocar: `plana-816-rojo-primero.tap.txt` (12 casos, 1 caído: «sigue la columna ESTADO»). Después de la edición autorizada, 12 de 12.
- 816 L136-140 exige ahora: el `<th>` «Estado» existe; la celda sale de `jobStatusMeta(j.status)`; y a `tdEstado` se le cuelga UNA sola cosa. FECHA, el cobro en IMPORTE y la ausencia de `cobroPillClass` siguen como estaban. El TÍTULO del caso decía «ESTADO y FECHA son una sola columna, y el cobro NO se pierde», que ya no era lo que comprueba: renombrado a «ESTADO lleva UNA sola píldora, FECHA sigue en su columna, y el cobro NO se pierde» (solo el título, ninguna exigencia; autorizado en c.22084). Las salidas guardadas antes del renombrado (`plana-816-rojo-primero.tap.txt`, `plana-una-pildora-mutacion.txt`) llevan el título viejo: son de ese momento y no se reescriben.
- guard-917 B.3: **se REESCRIBE, no se retira.** C.4 no lo exige idéntico: lee solo la PRIMERA píldora de la celda de estado (`querySelector`), así que dos apiladas le pasarían. B.3 cuenta todas las píldoras de la fila (`.status-pill` y la antigua `.jobs-estado-pill`) y exige exactamente una, con suelo («no pinta ninguna fila» es NO SUPE MIRAR). Sus otras dos comprobaciones (la fecha o nada) no cambian. El guard sigue en 51 comprobaciones.
- Visto en rojo con una mutación real (dos píldoras apiladas en la celda), base verde antes y restauración byte a byte: `plana-una-pildora-mutacion.txt`. Es la cuarta del catálogo del test de 1725 y tumba a los TRES que lo exigen: el caso de 1725g (la fila dice «En curso+Parcial»), 816 caso 5 («se le cuelga 2 vez/veces») y B.3 («11 de 11 filas no llevan exactamente UNA píldora»). El guion `plana-una-pildora-mutacion.mjs` no trae lista propia: toma la mutación del catálogo y mide además 816 y el guard. Commit previo a la primera inyección: `e0d5402528dc9fcdff6b3720974df3733c31488e`.
- Un error mío de esta vuelta: la primera versión del guion traía la mutación escrita dentro, y eso lo prohíbe el guard SCRUM-1387 («un banco nuevo va al catálogo»), el mismo que ya hizo retirar un guion a 1725e. Lo cazó correr `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs` tras el merge, antes del push. Arreglado en el guion, no en el guard.

**Lo que NO queda probado, y lo que queda fuera:**
- `guard:escalera-por-estado` sale ROJO (4 hallazgos, 2 ciegos: «el detalle (ninguna)») **también con la lista y la hoja de `origin/main` 34939a6ad**: es del detalle del Trabajo, no de esta rama. Reportado al orquestador.
- En la cuenta QA ningún terminado tiene saldo: «💰 Cobrar el resto» en su fila lo prueba el guard-917 (C.5, banco local), no la captura.
- Pendiente: el «me gusta» del fundador sobre las capturas, y la regla 42 tras el merge (las mismas pasadas, sin `LOCAL_DIR`).
- Dos mensajes míos al orquestador llevaban una hora ESTIMADA («~16:40Z», «~17:05Z») y era falsa por exceso: la de GitHub a esa altura era 16:17Z. La hora se lee de `gh api -i zen`.

### El rojo del CI de #3233 y su cura (relevo de S4 · 18-nov, 17:00Z)

El obligatorio «build + tests (con banco desechable)» cayó sobre la punta `9f87946596e3f6dc1121f77d22e784f33817cdc9` con 3 casos (run 44350276921). Ninguno es de la lista en sí: son los tres trinquetes de árbol entero, que no se corrieron antes del push.

| caso caído | causa | cura |
|---|---|---|
| `tests/scrum1185-trinquete-sin-consumir.test.mjs` ① | al quitar la cabecera «Terminados» se quedaron sin llamador `jobsView.js::eurosJobs` y `terminadoSinCobrar.js::resumenTerminadoSinCobrar` | `eurosJobs` se BORRA (función muerta de este fichero). `resumenTerminadoSinCobrar` se DECLARA en `scripts/_sin-consumir-declarados.json` (carril S4, SCRUM-1725, con su motivo): el motor no se toca (c.22098) y vive en un fichero de S2 |
| `tests/scrum719-el-suelo-de-los-doce.test.mjs` · SCRUM-1395 ② | 1725g metió tres `soloEjecutable(…)` sin suelo en `tests/scrum428-terminado-sin-cobrar.test.mjs` (L78, L152, L200) | las tres pasan por `vistaDeTrabajos()`, que usa `ejecutableDe` con el ancla `function renderJobsView`. Ninguna exigencia cambia: se añade el suelo |
| `tests/scrum719-el-suelo-de-los-doce.test.mjs` · SCRUM-1395b ① | el veredicto de mudez no tenía ficha de 428 y la de 816 estaba caducada | `npm run censo:mudez -- --escribir` (133 fichas, 2 medidas: VIVO 2, MUDO 0, CIEGO 0) |

Después, en local: los siete ficheros que tocan esto (1185, 719, 428, 816, 1725, 1387, 1294) dan 85 casos, 0 caídos, 0 saltados.

**`guard:lista-trabajos` (navegador, NO obligatorio) sale ROJO con esta rama, y NO se cura aquí.** Dice «el clic en la fila NO abrió el Trabajo». Medido en local a 1280 con el banco del propio guard: la columna «Estado» estrecha la celda del cliente a 249 px y su centro (397, 390) cae sobre el desplegable de técnicos (de x=287 a 409, 44 px de alto), que por diseño no navega (`data-fila-no-navega`). El clic en cualquier otro punto de la fila sigue abriendo el Trabajo, pero el centro de la celda del cliente ya no: es un defecto real de la plana, pequeño. Se cura en la rama siguiente (SCRUM-1725h), que rehace justo esa geometría (desplegable sin caja, fila de un renglón); arreglarlo dos veces el mismo día era trabajo tirado. Queda dicho al orquestador.


## Filtros: pestañas de estado y desplegable de cobro (S4 · 18-nov · SCRUM-1725i)

A9: comprobación → `docs/master/evidencias/SCRUM-1725/c1725i-lista.mjs`

**Por qué.** Orden del fundador sobre la lista plana (SCRUM-1725 c.22095: «ni elegante ni clara ni profesional»). Decisiones del orquestador en c.22098 y reparto en dos PR en c.22103. Éste es el PR-① (filtros). El lavado (tarjeta única, renglones, P3, P4, clic en fila) es el PR-② y aquí no se toca.

**Qué cambia** (`jobsView.js`, bloque `S4 · SCRUM-1725i` de `styles.css`). Es el patrón de Albaranes, con sus mismas piezas (`data-card-tabs`, `data-card-tab`, `badge-slate`, `data-card-toolbar`):
- ESTADO en pestañas con contador, para todos los roles: «Todos» + las cinco etiquetas de `jobStatusMeta`. Un trabajo cae en la pestaña que lleva la misma etiqueta que su píldora (`pestanaDeTrabajo`), así que las cinco suman siempre «Todos».
- COBRO en un desplegable de la barra, solo para quien pasa `veEstadoDeCobro`: «Cobro: todos (N)» (literal firmado en c.22098; `docs/microcopy/2026-11-18-SCRUM-1725-cobro-todos.md`) y «Pendiente/Parcial/Pagado (N)». Las cuatro píldoras desaparecen.
- El filtro de técnico entra en la misma barra: mismo nodo, mismo comportamiento. El buscador «Técnico [ ]» no se toca.
- Los tres filtros se cruzan. Los contadores son de la lista entera, como en Albaranes.
- Cerrados (P2): bajo «Todos» siguen plegados tras «Ver N cerrados»; la pestaña «Cerrado» los pinta directos.
- Las pestañas y el desplegable de cobro repintan solo las filas (`pintarFilas`): no pierden el foco, y a 390 la tira no vuelve a su principio. `pestanaALaVista` mueve la tira solo en horizontal.
- Hoja: en escritorio la caja de filtros es la cabeza de la tarjeta de la lista (0 px entre las dos); en móvil va en su propia tarjeta. Las tres franjas comparten vertical izquierda (medido a 1280: 299/293/287 px antes de alinear; 287 después).

**Pendiente de confirmar por el orquestador:** `aria-label="Cobro"` en el desplegable (no se ve; lo oye el lector de pantalla). Es el arranque del literal firmado, como «Facturación» en Albaranes.

**Tests que cambian de exigencia (PIDEN autorización nominal antes del push; a esta hora NO la tienen):**
- `tests/scrum1725-lista-operario-sin-cobro.test.mjs` L56-60: `filtrosCobro` contaba `<button>` «Pendiente · N» y pasa a contar también `<option>` «Pendiente (N)»; se añade `selectoresDeCobro`. L77-79 (nuevo): quien no ve el cobro, 0 desplegables y sin «Cobro: todos». L101-102 (nuevo): el admin, 1 desplegable. Las exigencias de siempre (0 para el operario, 3 para el admin) no cambian de número.
- `scripts/guard-lista-trabajos-917.mjs` A.2: L162-171 (lee las opciones del desplegable en vez de `#jobs-filter > button`), L183-189 (espera «Cobro: todos (N)», «Pendiente (N)»… y 0 píldoras), L218-240 (ELIGE «Pendiente» en el desplegable en vez de pulsar la píldora; exige lo mismo: filas pendientes, control que lo dice, cifra quieta). A.4 es nuevo, L191-196 y L242-273 (pestañas en cuentas, y pulsadas).
- Tests nuevos, sin cambio de exigencia: «SCRUM-1725i ①», «②» y «③» en el test de 1725.

**Rojo primero** (tests nuevos, vista sin tocar): `filtros-rojo-primero.tap.txt`, 7 casos, 4 caídos (el control positivo del admin y los tres nuevos). `filtros-guard917-rojo.err.txt`: 3 hallazgos y 2 ciegos de 51, todos en A.2/A.4. Después: 7 de 7, y el guard 56 de 56 (`filtros-guard917-verde.txt`).

**Medido en local** (`c1725i-sonda-local.mjs`, banco de listas, 12 trabajos, admin y técnico a 1280 y 390; `sonda-local.txt`): desborde 0; pestañas 52 px; controles de la barra 44 px; subrayado de la activa 2 px; a 1280 las seis pestañas caben y la caja y la lista se tocan; a 390 la tira pide 684 px en 364 y desplaza, y «Cerrado» pulsada queda entera a la vista.

**Antes/después en yaqu.app** (`c1725i-lista.mjs`, cuenta QA, solo lectura; el después sirve `jobsView.js` y `styles.css` del árbol sobre producción). Capturas `antes-filtros-*` y `despues-filtros-*`:

| pasada | filas bajo «Todos» antes → después | tarjetas solo-antes / solo-después | orden | pestañas (Todos/Sin agendar/Agendado/En curso/Terminado/Cerrado) | cobro | desborde | <44 px antes → después |
|---|---|---|---|---|---|---|---|
| admin 1280 | 9 → 9 | 0 / 0 | idéntico | 11/4/1/2/2/2 | «Cobro: todos (11)» + 3 | 0 | 10 → 10 |
| admin 390 | 9 → 9 | 0 / 0 | idéntico | 11/4/1/2/2/2 | «Cobro: todos (11)» + 3 | 0 | 10 → 10 |
| operario 1280 | 3 → 3 | 0 / 0 | idéntico | 3/1/0/2/0/0 | no lo tiene | 0 | 1 → 1 |
| operario 390 | 3 → 3 | 0 / 0 | idéntico | 3/1/0/2/0/0 | no lo tiene | 0 | 1 → 1 |

Las tarjetas se comparan como CONJUNTOS de líneas, con el formato de `c1725g-lista.mjs`. En el después cada pestaña se pulsa: enseña tantas filas como dice su contador, todas de su estado, la pulsada queda entera en la tira, «Cerrado» no trae «Ver N cerrados», las vacías dicen «No hay trabajos con ese filtro.» y al volver a «Todos» la lista es la de entrada. La página crece 57 px a 1280 y 76 px a 390 (la caja de filtros pasa de un renglón a dos franjas).

**Guards de navegador, medidos con esta rama:**
- `guard:lista-trabajos`: ROJO PREEXISTENTE, misma firma que en `main` («el clic en la fila NO abrió el Trabajo»). Se cura en el PR-②. No se arregla aquí.
- `guard:escalera-por-estado`: ROJO con la firma de `main` («la lista propone «Agendar» y el detalle (ninguna)»). El lado LISTA sigue leyendo: las pestañas no tocan `tr.jobs-fila` ni `.jobs-acciones`. El lado detalle lo re-ancla S2 en `scrum-1725h-escalera-por-identidad`.

**Lo que NO queda hecho en este tramo:**
- La suite completa local estaba corriendo al escribir esto; su resultado va en la entrega, no aquí.
- Los tres casos nuevos no llevan aún su mutación en `MUTACIONES_QUE_ME_TUMBAN`: no se afirma ninguna.
- Los controles de la barra van a 12,5 px (los del técnico ya lo estaban; el de cobro se iguala). Subirlos a los 13,5 px de Albaranes es ropa del PR-②.
- Un error mío: crucé los 115k de contexto sin avisar y lo medí a 287.926, ya pasado el umbral del traspaso (280k). Leer capturas PNG pesa mucho más de lo que calculé: se mide DESPUÉS de cada imagen, no al final.

### Relevo del mismo puesto (S4 · 18-nov, 17:55Z de GitHub): autorización, mutaciones y tanda de antes del push

Medido sobre `origin/main` `703df1474d8406bacd89c4609a89281256d7063e`, mergeado en la rama (`dd8f94593`) sin conflictos. Comprobado tras el merge: este registro conserva las dos secciones nuevas (la de S2, «Escalera por identidad», y ésta) y la rama solo difiere de `main` en sus seis ficheros y sus evidencias.

**Autorización nominal de las líneas — SCRUM-1725 c.22109** (copiada del encargo del orquestador; esta sesión no tiene Jira y no la ha leído allí):
- `tests/scrum1725-lista-operario-sin-cobro.test.mjs`: L56-60 (`filtrosCobro` cuenta también `<option>`, más `selectoresDeCobro`) · L77-79 nuevo (sin cobro: 0 desplegables, sin «Cobro: todos») · L101-102 nuevo (admin: 1 desplegable). Los 0/3 de siempre, intactos.
- `scripts/guard-lista-trabajos-917.mjs`: A.2 L162-171, L183-189, L218-240 (desplegable en vez de píldoras, mismas exigencias) · A.4 nuevo, L191-196 y L242-273.
- Los tests de 428 y 816 no se tocan. `aria-label="Cobro"`: confirmado (c.21978, según el mismo encargo); deja de estar «pendiente de confirmar».

Cotejo del commit `c0231b35b` contra esa lista, con `git diff -U0`: en el test, los trozos caen en L56-60, L77-79 y L101-102, más L128-264 (los tres casos nuevos). En el guard, en L162-171, L183-196 y L218-273. Los tests de 428 y 816 no están en el diff. **Una línea fuera de la lista:** el comentario que encabeza el catálogo del test dice ahora «los casos de arriba» donde decía «el caso de arriba». Es un comentario, no una exigencia.

**Mutaciones** de los casos nuevos, que el tramo anterior no declaró:

Mutaciones: catálogo → `tests/scrum1725-lista-operario-sin-cobro.test.mjs`

| mutación en `jobsView.js` | caso que nombra | cae |
|---|---|---|
| las pestañas cuentan `jobs.length` en vez de su estado | 1725i ① | sí (y de rebote ② y ③) |
| la pestaña no filtra (`filter((j) => true)`) | 1725i ② | sí (y de rebote ③) |
| `cerradosALaVista` no se atiende (`&& false`) | 1725i ② | sí, solo él |
| el cobro filtra la lista entera, no la pestaña | 1725i ③ | sí, solo él |
| el desplegable de cobro se cuelga con `if (true)` | 1725 ①② «tecnico» | sí (y de rebote «contable») |

Inyectadas una a una, con la base primero (7 de 7 en verde) y el fichero restaurado por bytes: `filtros-mutaciones.txt`. En esa salida la declaración nº 4 (de 1725g, ya en `main`) sale «CIEGO: la inyección no se aplicó»: es mi guion, que exige que el texto de partida desaparezca, y en esa declaración el de llegada lo contiene. No la juzgo aquí; la juzga `meta-guard-mutaciones` en el CI, como hasta hoy.

**Tanda de antes del push** (rama con `main` dentro, `npm run build` salida 0, un fichero cada vez, TAP fuera del árbol):

| fichero | pasan | caen |
|---|---|---|
| `scrum1387-banco-nuevo-va-al-catalogo` | 8 | 0 |
| `scrum1387d-el-recuento-dice-sobre-cuantos` | 5 | 0 |
| `scrum1387f-el-rotulo-dice-los-juzgados` | 3 | 0 |
| `scrum1294-a9-leccion-en-a10` | 4 | 0 |
| `scrum1572-registro-creado-por-dos-ramas` | 6 | 0 |
| `scrum709-microcopy-por-fichero` | 8 | 0 |
| `scrum1185-trinquete-sin-consumir` | 11 | 0 |
| `scrum719-el-suelo-de-los-doce` | 37 | 0 |
| `scrum1725-lista-operario-sin-cobro` | 7 | 0 |
| `scrum1725-ficha-lenguaje-del-parte` | 6 | 0 |

Esa pasada es ANTERIOR a este tramo de registro. Los que leen el registro (1387, 1294, 1572, 709) y `guards:entrada` se repiten después de escribirlo; su resultado va en el cuerpo del PR.

**Triaje de los 14 «not ok» de la suite a medias.** La suite completa del tramo anterior NO terminó (sin fichero de salida y con el TAP cortado en un caso): no hay veredicto local de suite completa, y no la he relanzado (no tengo el turno). Sus 14 caídos se han vuelto a correr, fichero a fichero, en la rama y en `main` limpio (`703df147`) dentro del mismo árbol y con el mismo `dist/` (la rama no toca `src/`, `prisma/` ni `package.json`: 0 ficheros):

| fichero | caen en la rama | caen en `main` |
|---|---|---|
| `scrum1199-avisos-alta-cliente` | 2 | 2 |
| `scrum1726-tanda-firmada-j1` | 2 | 2 |
| `scrum245-tipo-obliga-declarar` | 2 | 2 |
| `scrum385-preview-fiable` | 3 | 3 |
| `scrum471-node-modules-al-dia` | 1 | 1 |
| `scrum475-schema-vs-sql` | 3 | 3 |
| `scrum476-reconciliar-censos` | 1 | 1 |

Comparados como conjuntos de NOMBRES: 14 en la rama, 14 en `main`, 14 en la suite a medias, y ninguno en un solo lado. Ninguno es de esta rama. Su causa no la he investigado: lo medido es que caen igual sin mi cambio, en este árbol.

**Guards de navegador, repetidos con `main` dentro:**
- `guard:lista-trabajos-917`: 56 de 56.
- `guard:escalera-por-estado`: VERDE (salida 0, «las dos pantallas dicen y hacen lo mismo en los cinco estados»). Lo curó #3239 (S2), que ya está en `main` y en esta rama.
- `guard:lista-trabajos`: ROJO PREEXISTENTE, 1 defecto, la misma firma («el clic en la fila NO abrió el Trabajo»). Se cura en el PR-② (c.22103).

### Cura del rojo del CI de #3240 (S4 · 20-nov-2026 07:07Z · run 44364880372)

**Medido contra:** `origin/main` = `b0b7cf9970e7b4202f547a11e1d09add4ffca971` · 2026-11-20T07:07:58Z

El obligatorio cayó con 2 casos. Los dos se arreglan en el código; ni `scrum622` ni `scrum816` se tocan (regla 41).

| caso caído | causa MEDIDA (del log del run) | arreglo |
|---|---|---|
| «SCRUM-622 · EL CENSO: queda UNA red benigna…» | `c1725i-sonda-local.mjs` L96 decía `rojos ? 'ROJO' : 'VERDE'`: el censo por AST la cuenta como red con lado benigno por defecto. Y lo era: con cero exigencias habría dicho «VERDE». | La sonda cuenta sus exigencias. Sin ninguna sale 2 (ciega); con rojos sale 1; «VERDE» solo con exigencias y cero rojos. |
| «SCRUM-816 · el filtro de técnico busca EN CLIENTE…» | Cayó por CIEGO («no acoté el bloque del filtro»), no por una petición nueva: el test acota entre `const tecnicos = tecnicosParaElFiltro` y el `const porCobro` que le sigue, y 1725i había puesto el cruce de filtros (`pintarFilas`) DELANTE de `paint`. | `pintarFilas` se declara después de `paint`, donde iba el cruce en la base (703df1474: L172 y L243). Mismo cuerpo, mismo comportamiento. |

Lo que falló de mi lado: la tanda de antes del push del 18-nov eligió los tests por memoria y dejó fuera estos dos; uno lee `jobsView.js` y el otro barre el árbol entero. Esta vez la lista sale de `git grep -l` sobre `tests/*.test.mjs` (los que nombran `jobsView`, la sonda o `redesBenignas`).

A9: aviso → cicatriz S4 «La tanda de antes del push sale de un git grep de los tests que nombran lo tocado, no de la memoria: el 18-nov dejé fuera los dos que tumbaron #3240.» — no se pudo comprobar: ningún test puede ver qué tanda corrió una sesión antes de empujar

**Medido tras el arreglo**, con `main` traído (111 commits) y `tsc` limpio:
- 30 ficheros de `tests/` (los del `git grep` de arriba): 322 casos, 322 pass, 0 fail, 0 skip. Los dos caídos, en verde.
- `c1725i-sonda-local.mjs` en navegador real: VERDE, 0 en rojo de 32 exigencias (2 roles × 2 anchos, 12 trabajos).
- En ese run cayó también «guards de navegador» (no obligatorio): 40 verdes, 0 ciegos, 1 rojo, `guard:lista-trabajos`, con la firma preexistente de arriba. Se cura en el PR-②.

## El lavado: una tarjeta, filas de tres renglones, P3 y P4 (S4 · 20-nov · SCRUM-1725j)

**Medido contra:** `origin/main` = `0b8b9eda502d9e20c943ab348dd0fd4f26824168` · 2026-11-20T07:42:25Z

A9: comprobación → `tests/scrum811c-skill-ui-declarada.test.mjs`
Mutaciones: catálogo → `tests/scrum1725j-lista-lavado.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`; DESIGN.md única fuente de tokens, ninguno nuevo; Parte AB: una pantalla). La cargó la sesión que escribió la hoja. La sesión de relevo hizo el pulido del 20-nov (cuatro reglas del mismo bloque) ANTES de cargarla y la cargó después, al caer el guard de arriba: es el fallo de la línea A9.

**Por qué.** Es el PR-② de la vuelta 3 (SCRUM-1725 c.22098 y c.22103), tras el veredicto del fundador sobre la lista plana (c.22095). El PR-① (filtros, #3240) ya está en `main`.

**Qué cambia** (`jobsView.js`, bloque `S4 · SCRUM-1725j` de `styles.css`):
- UNA tarjeta, como Presupuestos, Albaranes y Facturas: cabecera con el título y «Nuevo trabajo», pestañas, barra y tabla dentro de una `.data-card`. Las dos cifras se quedan encima.
- La fila de escritorio mide tres renglones: quién · qué · tipo y dirección. Medido: de 61 a 69 px (eran de 92 a 121).
- La cura del clic en la fila (el rojo preexistente de `guard:lista-trabajos`): en 8 de 16 filas el centro de la celda de cliente caía en el desplegable de técnicos, que no navega (`c1725j-clic-antes.txt`). El desplegable ya no pisa el centro: 0 de 16 (`c1725j-clic-despues.txt`). No se toca el `click` ni el candado de SCRUM-727.
- Orden fijo de las acciones: [el paso] · «Ver detalle» · «⋯», haya rellena o no. «Ver detalle» y «⋯» caen en la misma vertical en todas las filas.
- P3 (firmado, c.22098): sin importe de referencia la lista dice solo «Sin importe»; la frase «no hay presupuesto aceptado» vive en la ficha.
- P4 (firmado, c.22098): en EN CURSO el albarán baja de la fila al «⋯», el primero, con su mismo rótulo y destino, para todos los roles. La fila queda en «Abrir parte» · «Ver detalle» · «⋯». El botón lleva `data-accion="escalera"` esté donde esté.
- Ningún texto nuevo: todos los rótulos existían.

**Cambio de diseño medido** (ratificado por el orquestador, abajo): los técnicos van en el renglón ②, con la tarea, y el ③ queda para tipo · dirección. Con los tres en el ③ la dirección medía 0 px en 4 de 8 filas (la celda de cliente mide unos 256 px a 1280).

**Pulido del 20-nov, a la vista de la captura del banco** (pedido por el orquestador en la sesión, sin número de comentario: Jira estaba caído). Tres cosas que se veían mal a 1280 y que se curan sin tocar la cura del clic:
- El nombre del técnico salía cortado («Israel Carm…») con hueco a su izquierda. Ahora aprovecha su mitad: 0 de 16 nombres cortados en el banco.
- En las filas sin tarea propia el técnico quedaba solo a la derecha de un renglón vacío. Ahora abre ese renglón por la izquierda, bajo el cliente, sin pasar de esa mitad.
- La flecha del desplegable, a 10 px, se leía como un punto. Va a 16 px.
- Por eso el banco `c1725j-medir-filas.mjs` (nace en esta rama) deja de exigir «el desplegable en la mitad DERECHA» y exige «no pisa el centro de la celda: entero en una mitad». El árbitro del clic es `c1725j-clic-en-fila.mjs`, que no cambia.
- NO se toca: la caja vacía entre «Técnico» y «Todos los técnicos» es el buscador de SCRUM-816, ya en `main`.

**Cuatro exigencias cambian, y solo ésas.** Cada una se vio en ROJO contra el código nuevo antes de tocarla: en `scrum1739`, «SIN-AGENDAR no tiene rellena y ha cambiado de orden: □Agendar · □Ver detalle · □⋯»; en guard-917, «B.5 … sin eje: ["Sin importe"]» (dos filas) y «C.2 «⋯» de Ana Cuadro: ["+ Nuevo albarán","Técnicos","✅ Marcar terminado"] ≠ ["Técnicos","✅ Marcar terminado"]»; en guard-escalera, «en_curso: la lista propone (ninguna) y el detalle «+ Nuevo albarán»». La autorización, copiada literal (20-nov, ~09:45 local; pendiente de pegar en Jira, que estaba caído):

> «AUTORIZO cambiar exactamente estas CUATRO exigencias y ninguna más, porque el requisito cambió (P3/P4 firmados en c.22098/c.22103, veredicto del fundador c.22095):
> a) tests/scrum1739-una-rellena-por-tarjeta.test.mjs, caso de L138 (L146-151) → exige el orden fijo [paso]·«Ver detalle»·«⋯» también cuando NO hay rellena.
> b) scripts/guard-lista-trabajos-917.mjs B.5 (L373-378) → exige solo «Sin importe» en la lista (P3 firmado; la frase larga vive en la ficha).
> c) guard-917 C.2 (~L57, inventario del «⋯» por estado) → el «⋯» de EN CURSO lleva «+ Nuevo albarán» PRIMERO, delante de Técnicos y Marcar terminado (P4).
> d) scripts/guard-escalera-por-estado.mjs ① EN CURSO (L116; selectores L178/225/262) → lee el botón por identidad data-accion="escalera" DENTRO del «⋯»; los otros cuatro estados intactos (mismo patrón que c.22107: cambia lo que MIRA, no lo que exige).
> RATIFICADO además el cambio de diseño medido: técnicos al renglón ② junto a la tarea; el ③ queda para tipo · dirección (con los tres juntos la dirección medía 0px en 4 de 8 filas). Firmado por delegación c.21978; pendiente de pegar en Jira (caído).»

Cómo quedó cada una:
- a) el tramo de las filas sin rellena exige la lista ENTERA de rótulos, en orden, para sus tres casos. El resto del caso, igual.
- b) B.5 compara la celda entera con `['Sin importe']`: una segunda línea, la que sea, es rojo.
- c) la fila 1 del inventario pasa a `['+ Nuevo albarán', 'Técnicos', '✅ Marcar terminado']`. Las otras tres, intactas.
- d) solo para `en_curso`, el guard abre el «⋯» de la fila y lee dentro `button[data-accion="escalera"]`. Sigue exigiendo el MISMO rótulo que el detalle. Los selectores de ②, ②-bis y ③ (L178/225/262 de entonces) NO se tocaron: siguen leyendo la caja de la fila, que en esos estados sigue llevando el paso. Límite que queda dicho: si un día la acción de otro estado bajara al «⋯», ③ no la vería; hoy solo baja la de EN CURSO.

**Red que corre siempre** (`tests/scrum1725j-lista-lavado.test.mjs`, 4 casos, sin navegador): una tarjeta; P3; P4 con el albarán primero en el «⋯» por su identidad; y P4 para el operario. Declara 5 mutaciones; `scrum1739` declara 1 (vuelven los dos órdenes).

**Las mutaciones, también contra los guards de navegador** (`c1725j-exigencias-mutacion.mjs`, que las toma de los dos catálogos; salida en `c1725j-exigencias-mutacion.txt`): base verde en los 4 instrumentos; 5 mutaciones; 10 caídas exigidas, 10 vistas; árbol restaurado byte a byte. Cada exigencia cambiada cae con su defecto: b) en guard-917, c) en guard-917 (por faltar y por ir el último), d) en guard-escalera (por salir del «⋯» y por perder la identidad), a) en `scrum1739`.

**Medido tras traer `main`** (7 commits, merge sin conflictos; el diff contra `main` son 15 ficheros, todos de esta entrega):
- `guard:lista-trabajos` salida 0 · `guard:lista-trabajos-917` salida 0, 56 comprobaciones · `guard:escalera-por-estado` salida 0 (los cinco estados dan 4 rótulos distintos; EN CURSO «+ Nuevo albarán» en las dos).
- Banco `c1725j-medir-filas.mjs`: VERDE, 0 en rojo de 12 exigencias, 20 trabajos de muestra a 1280 y 390 (`c1725j-medir-filas.txt`).
- Tanda de 279 ficheros de `tests/` (los del `git grep` de lo tocado, más los guards de registro y catálogo): 2147 casos, 2055 pass, 90 skip, 2 fail. Los dos fallos: `scrum811c` (pedía la línea de la skill de este tramo, ya puesta) y `scrum222` «el SQL del censo de producción NO está desfasado respecto al schema», que es del árbol local y no de la rama.
- NO MEDIDO: `npm run build` sale 2 en este worktree. Son errores de tipos de `customerAdmin.ts` sobre columnas de `Attachment` que trajo `main`: el cliente de Prisma compartido va por detrás del esquema, y no se regenera desde aquí (A1). Esta rama no toca `src/` ni el esquema. El build lo juzga el CI.

**Lo que NO lleva esta entrega:**
- Capturas en yaqu.app (antes/después, 390 y 1280, operario y admin): no las he intentado. La cookie de QA estaba caducada y esta sesión no tenía contexto para renovarla. Las que van son del BANCO local, con datos de muestra: `c1725j-banco-lavado-1280.png` (mirada) y `c1725j-banco-lavado-390.png` (sin mirar a ojo; sus medidas sí están en el banco).
- Verificación en yaqu.app: después del despliegue.
