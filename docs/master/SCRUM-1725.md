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
