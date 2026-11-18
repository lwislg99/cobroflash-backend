# SCRUM-1679 · la tarjeta de Trabajos dice qué trabajo es y dónde, y «Abrir trabajo» abre la ficha

**Fecha:** 18-nov-2026 · **Carril:** S4 (producto) · **Pedido por:** el orquestador, con orden del fundador («la cara de Trabajos») · **Rama:** `scrum-1679-cara-trabajos`
**Skill UI:** cargada (`yaqu-premium-ui`. La sesión que escribió el cambio la cargó DESPUÉS de editar, y lo dejó dicho en su relevo; la que arregla este encabezado la cargó antes de tocarlo y repasó el diff contra ella: sólo `--ink` y `--muted`, ningún token, color, sombra ni `style=` nuevo)
**Medido contra:** `origin/main` = `c36bd1648deb26f39b173eab0439029dc4746781` · 2026-11-18T08:35:33Z
A9: comprobación → `tests/scrum267-ancla-de-medicion.test.mjs`

La primera medición, la del defecto y la de las capturas, se hizo el 18-nov-2026 a las 08:00Z (hora de GitHub) sobre `origin/main` `6881a0d27e8b4e337bd55175c3068791c8304c69`. El ancla de arriba es la del árbol que se empuja: esta rama con `c36bd1648…` (que ya lleva SCRUM-1739) fusionado dentro.

## El defecto, visto hoy

- **La tarjeta no dice qué trabajo es.** En yaqu.app (cuenta +qa, `#jobs`), el trabajo #84 tiene tarea («(prueba) Recorrido H6 del 16-nov: cambiar el termostato…») y dirección («Calle Mayor 14, 3º B…»), el servidor las manda en la lista (`serializeJob`: `queHayQueHacer`, `direccion`) y la tarjeta pintaba sólo el cliente y el técnico. 8 tarjetas, 0 con tarea, 0 con dirección. Tres de ellas eran «Marta Prieto (PILOTO-1 QA)» sin nada que las distinguiera.
- **«Abrir trabajo» no abría.** Leído en el código, no corrido en producción (crearía un trabajo): `jobsView.js` le pasaba al modal `() => renderJobsView(container)`, que repinta la lista e ignora el trabajo que el modal entrega.

## Qué cambia

1. `jobsView.js` · `jobRow`: bajo el cliente, la **tarea** (`.jobs-fila-tarea`) cuando el trabajo no tiene nombre propio; con nombre propio manda el nombre propio, como desde SCRUM-917c, y la tarea no se repite. Al final de la celda, la **dirección** (`.jobs-fila-direccion`) si existe. Las dos por `textContent`, con el texto entero en `title`.
2. `jobsView.js` · «Nuevo trabajo»: al crear, `renderAppView('jobs-detail', { jobId })`. Sin trabajo o sin router, repinta la lista como antes. El modal (`jobNuevoModal.js`, carril S2) no se toca: ya entregaba `alCrear(job)`.
3. `styles.css` · bloque propio «S4 · SCRUM-1679»: tarea en `--ink`, dirección en `--muted`, 13 px. En escritorio, dos líneas y una, con tope de 46ch para que una tarea larga no ensanche la columna. En la tarjeta de móvil (≤ 640 px), tres y dos.

**Cero textos nuevos:** todo lo que se pinta lo escribió el profesional. Cero servidor.

## Medido en la página real, con el front del árbol servido encima de producción

Acción: `docs/master/evidencias/SCRUM-1679/c1679-tarjeta.mjs` (banco H6, `LOCAL_DIR`). No escribe.

| ancho | tarjetas | con tarea | con dirección | desborde de la página |
|---|---|---|---|---|
| 390 antes | 8 | 0 | 0 | 0 |
| 390 después | 8 | 2 | 5 | 0 |
| 320 después | 8 | 2 | 5 | 0 |
| 1280 después | 8 | 2 | 5 | 0 |
| 390 después, operario | 3 | 1 | 2 | 0 |

Los botones de cada tarjeta son los mismos antes y después (rótulo y clase), y los pulsables de la pantalla también: 67.

Capturas en `docs/master/evidencias/SCRUM-1679/`: `antes-390.png`, `despues-390.png`, `antes-1280.png`, `despues-1280.png`, `despues-operario-390.png`.

## El test

`tests/scrum1679-la-tarjeta-dice-que-trabajo-es.test.mjs`, 6 casos sobre el banco de vistas. Rojo primero (commit `6ce988a52`): caían 4 de 6; los otros dos son los que impiden pasarse (con nombre propio no se repite la tarea; sin datos no nace un renglón vacío).

## Lo que salió mal por el camino

- El primer corte (dos líneas la tarea, una la dirección, a cualquier ancho) se midió a 390 antes de empujar y no valía: en la tarjeta de móvil al cliente le quedan unos 125 px, porque «no hay presupuesto aceptado» se lleva media tarjeta, y «Calle de Prueba QA 17» salía cortada. Se dio una línea más a cada una por debajo de 640 px. Lo cazó la captura, no el test.

## Lo que NO está hecho o no se ha medido

- **SCRUM-1739 y SCRUM-1749 (la primaria «▶ Empezar») NO van en esta rama.** Chocan con la decisión C.1 de SCRUM-917c (prototipo aprobado por el fundador, comentario 15876): «una sola primaria, la del dinero; Agendar/▶ Empezar en secundaria». Se le plantea la reconciliación al orquestador.
- «Abrir trabajo» → ficha, en yaqu.app: se verá en la regla 42 (crea un trabajo de verdad en la cuenta QA).
- En móvil la columna del cliente sigue siendo estrecha cuando no hay importe: una tarea larga se corta a tres líneas de unas 19 letras. Darle el ancho entero de la tarjeta es tocar la rejilla que comparten las listas (carril S2).
- A 320 el desplegable «Todos los técnicos» llega a x=357 (se sale 37 px de su caja, sin desbordar la página). Ya pasaba antes de esta rama: medido igual en producción.
- Un teléfono de verdad y Safari (`-webkit-line-clamp`).

## El rojo de #3214 (18-nov-2026): era PROPIO, y eran dos más de los que se arreglaron

El obligatorio de `1bc9ab652` cayó con 17 fallos, y ninguno era de código. Leído en el log del job (21.110 líneas, 13.829 «✔», 36 «✖» contando el resumen):

- `scrum267-ancla-de-medicion` (3 casos, que otros cuatro ficheros vuelven a correr): este registro no llevaba la línea `**Medido contra:**`. Decía contra qué `main` se midió, pero en prosa.
- `scrum811c-skill-ui-declarada` (SCRUM-1340): la rama toca `public/` y el registro no declaraba `**Skill UI:**`.
- `SCRUM-976 ④`: corre los guards de verdad, así que cae con los dos de arriba.

El primer rojo de esta rama (`scrum1233g`, la acción de banco) se arregló sin ver el resto: el log del run salió vacío porque `gh run view --log` no entrega nada mientras el run sigue en marcha. El log de UN job ya terminado sí se puede pedir: `gh api repos/<dueño>/<repo>/actions/jobs/<id>/logs`.

**Arreglo:** las dos líneas del encabezado, y `origin/main` fusionado dentro (la rama iba por detrás y `main` ya lleva SCRUM-1739, que toca la misma función `jobRow`). Git fusionó `jobsView.js` sin conflicto; que la fusión sea correcta se midió aparte: los 28 tests que nombran `jobsView` más `scrum1233g`, 305 pruebas, 0 fallos.

## SCRUM-1679b · Regla 42: visto en yaqu.app con un trabajo de verdad (18-nov-2026)

**Rama:** `scrum-1739b-reglas-42-cara-trabajos` (sirve también a la regla 42 de SCRUM-1739: el mismo trabajo). Sólo registro y evidencia; no toca `src/` ni `public/`.
**Medido contra:** `origin/main` = `25b6c8f9c7edaf4eb7ded049abdd59d75a22974a` (merge de #3214) · 2026-11-18T11:12:37Z (cabecera `Date:` de `gh api -i zen`).
A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

**El despliegue, cotejado antes de medir** (descarga a fichero + `git hash-object --no-filters`, contra `git rev-parse origin/main:<ruta>`):

| fichero servido por yaqu.app | blob servido | blob de `origin/main` |
|---|---|---|
| `/dashboard/js/jobsView.js` | `7f55a66bace5582fc2246df779f9815b0e619929` | el mismo |
| `/dashboard/css/styles.css` | `5d41e118853e7ec368698b8a74c3ebe2f0538950` | el mismo |

**Instrumento:** `docs/master/evidencias/SCRUM-1679/r42-crear-y-abrir.mjs`, acción del banco H6 (`SCRUM-1686/banco-h6/paso2.mjs`). No usa `.route(`: mide lo que sirve producción. Tres pasadas, las tres con código de salida 0:

1. **Mirar** (sin `HACER=1`, 390): abre el modal y no crea nada. Botón «Abrir trabajo»; 4 clientes en el desplegable, entre ellos el de la prueba.
2. **Crear** (`HACER=1`, 390): rellena cliente, tipo de intervención, dirección y tarea, pulsa «Abrir trabajo» y mira dónde queda el panel. Salida en `evidencias/SCRUM-1679/r42-crear-390.txt`.
3. **Releer** (`TRABAJO=86`, 1280): lee la tarjeta de ese trabajo a escritorio sin crear otro. Salida en `r42-releer-1280.txt`.

**Lo medido al crear:**

- `POST /admin/jobs` → **201**, `id=86`, `status=pendiente_agendar`; el servidor devuelve la tarea y la dirección iguales a lo escrito.
- **Aterriza:** `location.hash` = `#jobs-detail/86` · el panel pidió `GET /admin/jobs/86` → 200 · el modal ya no está · se pintan 0 filas de la lista. El hash solo no probaría nada (se queda como se escribió aunque el panel pinte otra cosa): por eso van las cuatro.
- **La ficha lo dice a la vista** (`innerText`, sin abrir nada): la tarea, en «Qué hay que hacer», y la dirección, en «DÓNDE».
- **La tarjeta lo dice:** de vuelta en la lista, UNA tarjeta pinta esa tarea, con esa dirección y ese cliente. Población: 9 tarjetas, 3 con tarea, 6 con dirección (antes de crear: 8, 2 y 5).

### Aceptación → dónde se ve

La aceptación literal del ticket en Jira NO la ha leído esta sesión (no tiene Rovo): las filas son las del encargo del orquestador del 18-nov, copiadas.

| aceptación (del encargo) | dónde se ve |
|---|---|
| crear trabajo QA REAL con tarea y dirección → la tarjeta lo dice | yaqu.app, cuenta QA, Trabajos: la tarjeta del trabajo #86 · `evidencias/SCRUM-1679/r42-lista-390.png` y `r42-lista-1280.png` (tomadas con el trabajo aún sin agendar) · `r42-crear-390.txt`, línea `TARJETA de #86` |
| «Abrir trabajo» ATERRIZA en su ficha | `evidencias/SCRUM-1679/r42-ficha-390.png` · `r42-crear-390.txt`, líneas `ATERRIZA` y `LA FICHA DICE` · `tests/scrum1679-la-tarjeta-dice-que-trabajo-es.test.mjs` |
| capturas 390/1280 | las tres PNG `r42-*` de `evidencias/SCRUM-1679/`. El aterrizaje se midió a 390; a 1280 sólo la tarjeta |

### Lo que se queda en la cuenta QA (declarado)

- **Trabajo #86**, de «Marta Prieto (PILOTO-1 QA)», creado el 18-nov-2026 entre las 11:12:37Z y las 11:14:41Z (GitHub). Tarea: «(prueba) Regla 42 de SCRUM-1679 del 18-nov: revisar la presión de la caldera y cambiar la válvula de seguridad.» Dirección: «Calle de la Regla 42, n.º 18, 1.º A, 28801 Alcalá de Henares». Tipo de intervención: `REPARACION_ASISTENCIA`. Sin técnico asignado.
- Después se AGENDÓ para la regla 42 de SCRUM-1739 (`docs/master/SCRUM-1739.md`, sección 1739b). No se ha borrado ni cerrado.
- Crear un trabajo no manda nada al cliente: leído en `jobs.routes.ts` (el único envío del fichero es el del enlace de cobro, otra ruta); no se observó ningún envío en la pasada (escrituras de la bitácora: `POST /admin/entorno`, del banco, y `POST /admin/jobs`).

### Lo que NO se ha medido

- El aterrizaje a 1280 (es el mismo código a cualquier ancho; no se creó un segundo trabajo sólo para fotografiarlo).
- Un teléfono de verdad y Safari: sigue como arriba.
- El operario: la pasada es con la cookie de administrador.

**Lo que salió mal en esta pasada (A9):** las dos secciones nuevas (ésta y la 1739b) se escribieron con su ancla «Medido contra» y sin la línea `A9:` que cada ancla exige. Lo cazó `npm run guards:entrada` antes del push (`tests/scrum1294-a9-leccion-en-a10.test.mjs`, 2 hallazgos); no llegó a CI.

**La acción se revisó antes de correrla** (la dejó escrita y sin correr la sesión anterior). Dos cambios: comprueba que el cliente de la prueba ESTÁ en el desplegable antes de escribir nada (si no, para sin crear), y lee la tarjeta en la misma pasada aunque la ficha diera rojo, porque para entonces el trabajo ya existe.
