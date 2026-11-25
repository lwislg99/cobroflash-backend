# SCRUM-1837 · el «+ Nuevo presupuesto» corto del censo táctil: cuál es y desde cuándo

**Medido contra:** `origin/main` = `f1cd9c39c07f172fa3a13fa7fa2016ba03369876` · 2026-11-24T18:38:32Z

A9: sin fallo que generalice — tramo de solo medición, sin cambio de producto; lo que confundió al ticket (leer el «p.ej.» de una fila por CLASE del censo como si nombrara un elemento) queda dicho abajo y se lo lleva el orquestador al equipo que lo abrió.

Los tres censos se corrieron con el árbol en `db0a6c04541c258eda6499e1088cf16db9f1836b`; los tres
commits que `main` ganó después (hasta `f1cd9c39c`) no tocan `public/` ni el instrumento. La rama
lleva además fusionado un `main` posterior que sí toca `public/dashboard/js/jobDetailView.js`
(+15 −2): la fila de la ficha del trabajo de abajo es la de `db0a6c045` y NO se ha vuelto a medir.

## Resultado, en corto

1. **No es el botón de SCRUM-1148.** El de 1148 es el de la cabecera de Plantillas
   (`renderTemplatesView`): hoy, 6 pulsables medidos y **0 cortos**, a 390 y a 929.
2. **Es el de la ficha 360 del cliente** (`renderCustomer360View`): `#btn-new-quote-360`,
   `public/dashboard/js/customerDetailView.js:477`. Mide 30,7–31,0 px de toque (caja 30,0).
3. **No es una regresión de hoy.** Con el `public/` de la base del día mide lo mismo, y `main` no
   ha tocado hoy ni ese fichero ni `templatesView.js`.
4. **No se cura aquí:** la ficha 360 no es del carril de S4. El propio registro de SCRUM-1148 lo
   dejó escrito al curar Plantillas («La de `BUTTON.btn-primary.btn-sm` «+ Nuevo presupuesto» que
   hay en ese fichero es de la ficha 360, `renderCustomer360View`, que es de J2: no se toca»).
   Nunca midió 44,6–45,0: esa cifra es del otro botón.

## Cómo se confunden los dos

La sección «POR CLASE» del censo agrupa elementos DISTINTOS que comparten clase y pone tres textos de
ejemplo. Su fila de hoy:

    3  BUTTON.btn-primary.btn-sm   toque 30.7–31.0 px · caja 30.0–30.0 px · 3 pantalla(s) · p.ej. + Nuevo presupuesto / Marcar como cobrada / + Añadir miembro

Son tres botones de tres pantallas, cada uno con su texto; no un «+ Nuevo presupuesto» en tres
pantallas. Y «+ Nuevo presupuesto» es el rótulo de dos botones de la misma clase: el de Plantillas
(curado por contenedor en 1148) y el de la ficha 360 (sin curar).

## Las tres mediciones

Instrumento: `node scripts/censo-objetivo-tactil-panel.mjs` (el árbitro del guard, navegador real).
Población de cada pasada, igual en las tres: 29 vistas publicadas, 28 montadas, 88 páginas ×
anchura, sonda de control leída en 88 de 88, 0 sondas no cazadas.

| pasada | fila de `BUTTON.btn-primary.btn-sm` | salida guardada |
|---|---|---|
| hoy (`db0a6c045`) | 3 elementos · 30,7–31,0 · 3 pantallas · + Nuevo presupuesto / Marcar como cobrada / + Añadir miembro | `evidencias/SCRUM-1837/censo-tactil-main-db0a6c045.txt` |
| `public/` de la base del día (`42cae6109`, 23-nov 22:48Z), instrumento de hoy | la misma fila, letra por letra | `evidencias/SCRUM-1837/censo-tactil-public-de-42cae6109.txt` |
| sonda: hoy, quitando `btn-sm` SOLO a `#btn-new-quote-360` | 2 elementos · 30,7–30,7 · 2 pantallas · Marcar como cobrada / + Añadir miembro | `evidencias/SCRUM-1837/censo-tactil-sonda-sin-btn-sm-en-la-360.txt` |

La sonda es la que identifica el botón: al quitarle la clase a ese y solo a ese (1 ocurrencia en el
fichero), «+ Nuevo presupuesto» desaparece de la fila y la cuenta baja de 3 a 2. Si el corto fuese el
de Plantillas, la fila no se habría movido. Se repite así: `git checkout 42cae6109 -- public` para la
segunda pasada, y para la tercera cambiar en `customerDetailView.js`
`class="btn-primary btn-sm" id="btn-new-quote-360"` por `class="btn-primary" id="btn-new-quote-360"`;
censo, y `git checkout HEAD -- public`.

Bisección contra los merges de hoy: 62 merges en `main` desde `42cae6109`, 13 tocan `public/`
(12 ficheros). Ninguno toca `customerDetailView.js` ni `templatesView.js`, y `styles.css` solo gana
3 líneas (un `:focus-visible` de `.customers-card[role="button"]`, SCRUM-1639c). Con la fila
idéntica en los dos extremos no queda nada que bisecar.

## Las tres pantallas que nombraba el encargo (parte, ficha del trabajo, lista de partes)

| pantalla | a 390 | a 929 | lo que NO se pudo mirar |
|---|---|---|---|
| parte (`renderParteDetailView`) | 8 medidos · 0 cortos · 3 no tocables | 8 medidos · 1 corto (no es de esta clase) | — |
| ficha del trabajo (`renderJobDetailView`) | 10 medidos · 0 cortos · 16 ocultos | 10 medidos · 0 cortos · 16 ocultos | la pestaña «Partes» no se deja abrir en el banco: su contenido NO está medido |
| lista de partes de oficina (`renderPartesOficinaView`) | NO MEDIDA | NO MEDIDA | el censo la da por no medida (12 nodos con su contrato) |

En lo que el censo ve del carril del parte no hay ningún `btn-primary.btn-sm` corto. De la pestaña
«Partes» y de la lista de oficina no se sabe nada: no es un cero, es un «no he mirado».

## Lo que queda para quien corresponda

- Los otros dos de la fila («Marcar como cobrada», «+ Añadir miembro») también miden 30,7 y tampoco
  son de hoy. Qué botón es cada uno no se ha identificado con sonda: las pantallas con cortos de
  esa familia son `renderInvoiceDetailView`/`renderInvoicesView` y `renderTeamView`.
- La cura de `#btn-new-quote-360` es «por contenedor, como en 1148»; la decide y la reparte el
  orquestador (carril de la ficha 360).

## Con qué se midió, dicho

- `dist` de este árbol: `tsc` salió 2 con 29 errores de tipos en 9 ficheros, todos por el cliente
  de Prisma compartido (18 campos por detrás, `scripts/_prisma-client-guard.mjs`); emitió igual
  (372 `.js`). El censo solo usa de `dist` módulos de dominio que no pasan por el cliente.
- guards:entrada: CIEGO por carga de máquina (corte a 90 s, cuarta vez en la tarde); los 16 guards
  de su lista con `node --test` sueltos: 177/177, 0 fallos. Mismo criterio que firmó el orquestador
  para SCRUM-1824 (SCRUM-1656 c.22684 ①): el juez es el check obligatorio del CI.
- Sin cambio de producto: la rama lleva este registro y las tres salidas del censo. suite con dist:
  NO CORRIDA; la corre el CI.

## Aceptación → dónde se ve

| aceptación | dónde se ve |
|---|---|
| medir en cuál pantalla se ha encogido | arriba: `renderCustomer360View`, `#btn-new-quote-360`; las tres salidas en `docs/master/evidencias/SCRUM-1837/` |
| por qué (¿un merge de hoy?) | no: fila idéntica con el `public/` de `42cae6109`; es el botón que 1148 dejó fuera |
| curar donde toque sin romper las otras dos | NO HECHO → fuera del carril de S4; al orquestador, para el dueño de la ficha 360 |
| capturas a 390 | NO HECHO → no hay cura que fotografiar; la medida es la del censo |

## SCRUM-1837b · las dos esquinas que el censo no medía: «Partes» de la ficha y la lista de oficina

**Medido contra:** `origin/main` = `7592c8c140cbe5ddb1bcc516c8c6af38af90d59d` · 2026-11-25T08:58:38Z

A9: sin fallo que generalice — tramo de solo medición, sin cambio de producto. Lo que salió mal aquí: la primera pasada de mi banco leyó «qué pestaña abre sola» DESPUÉS de haberlas pulsado, y lo cazó su propia expectativa (salida 2); es la norma que ya está en A3 («un instrumento que provoca el estado que va a comprobar»), no una lección nueva.

Puesto S4, rama `scrum-1837b-esquinas`. No toca producto ni el censo: un banco de un solo uso, la
salida del censo sobre este árbol y la salida del banco, las tres en
`docs/master/evidencias/SCRUM-1837/b-esquinas/`.

### Por qué es un banco aparte y no un cambio en el censo

El encargo decía «dale al banco lo que le falte (es TU banco)». No lo es: `node scripts/carriles.mjs de`
da a S3 los tres ficheros que habría que tocar (`scripts/censo-objetivo-tactil-panel.mjs`,
dos-equipos.md:177 · `scripts/_datos-del-censo.mjs`, :185 · `tests/_banco-vistas.mjs`, :169). Dicho al
orquestador antes de escribir nada (A20); decidió que S4 entrega la MEDICIÓN y el diagnóstico, y que la
puerta permanente en el censo la pone S3 con lo que hay en «Lo que le falta al censo», abajo.
`medir-esquinas.mjs` IMPORTA esos instrumentos y no los modifica.

### Qué pasaba de verdad (leído y corrido, sin tocar nada)

- **«Partes» sí se abre: es la pestaña que la ficha abre SOLA al montar.** `montarPestanasDeLaFicha`
  (`jobDetailView.js:141-143`) elige la sección que contiene la primaria visible, y es «+ Nuevo parte».
  El aviso del censo («pulsarla no cambia nada en el banco») sale porque su recorrido mira
  `aria-selected` en vivo: tras pulsar «Lo que falta», «Partes» ya no está elegida, la pulsa, y el
  resultado es idéntico al montaje. No es una pestaña cerrada: es volver al principio.
- **Lo que no se medía eran sus FILAS.** `GET /admin/jobs/:id` manda `partes`
  (`jobs.routes.ts:689-693` y `:819`), pero `TRABAJO_DE_MUESTRA` (`scripts/_pagina-panel.mjs:163-186`)
  no lleva esa clave: el panel se pintaba con el párrafo de «aún no hay» y un solo botón.
- **La lista de oficina monta 12 nodos** con el único pendiente de su contrato
  (`_datos-del-censo.mjs:191-199`), y el suelo del censo es 20. Con 3 pendientes son 22.
- **El parte que abre cada fila no lo puede ver el censo**: se abre con un clic en la fila (el censo
  sólo sabe abrir pestañas, y lo dice) y pide `GET /admin/partes/:id/oficina`, que no tiene contrato.
  No está ni en «ocultos»: no existe en el DOM hasta que se pulsa.

### Lo medido

Vara de 44 px de toque en las tres anchuras, que es como juzga el censo. Población: 7 estados × 3
anchuras = 21 páginas; 54 mediciones dentro de las dos esquinas. Salida entera:
`evidencias/SCRUM-1837/b-esquinas/medidas-7592c8c14.txt`.

| estado | elementos en la esquina | 390 | 929 | 1280 |
|---|---|---|---|---|
| ficha · «Partes» con 2 partes (firmado + borrador), admin | 4 | 0 cortos | 0 cortos | 0 cortos |
| ficha · «Partes» con 2 partes, técnico | 3 | 0 cortos | 0 cortos | 0 cortos |
| oficina · lista con 1 pendiente (el dato del censo) | 1 | 0 cortos | 0 cortos | 0 cortos |
| oficina · lista con 3 pendientes | 3 | 0 cortos | 0 cortos | 0 cortos |
| oficina · 3 pendientes y el primero abierto (3 líneas) | 7 | 3 cortos | 4 cortos | 4 cortos |

Los cortos, uno a uno (el banco los lista por elemento, con su selector, su texto y su posición en el
DOM, así que no hizo falta la sonda de quitar una clase):

| elemento | fichero | 390 | 929 | 1280 |
|---|---|---|---|---|
| las 3 casillas de precio, `INPUT.po-col-precio` | `parteOficinaView.js:204-208` (S2) | caja 20 · toque 21 | caja 20 · toque 21 | caja 20 · toque 21 |
| «Guardar precios», `BUTTON.btn-primary` | `parteOficinaView.js:237-238` (S2) | toque 44,7 ✓ | caja 36 · toque 36,9 | caja 36 · toque 36,9 |

En «Partes» de la ficha todo llega: «+ Nuevo parte» 44,8–44,9 · el número del parte
(`.detail-miga-link`) 45 · «+ Nuevo presupuesto» de la fila firmada 44,7–44,8.

### La vara a 929 y a 1280 no es la misma en todas partes

`DESIGN.md:168-170` deja el botón de escritorio en 36 px «a propósito», y el guard usa ese suelo por
encima de 768 (`MINIMO_ESCRITORIO` y `CORTE_MOVIL` en `scripts/_medidor-de-toque.mjs`). El censo, y este
banco con él, juzgan con 44 a cualquier anchura. Con eso:

- las casillas de precio (21 px) son cortas con las dos varas y también a 390: defecto sin matiz;
- «Guardar precios» a 36,9 es corto con la vara de 44 y conforme con `DESIGN.md`: es una DECISIÓN
  (¿la tableta entre 769 y 1199 cuenta como dedo?), no un descuido.

### De paso, en el carril del parte (S4): NO curado, y por qué

El control K2 (la ficha del parte con el dato del censo) da 1 corto a 929: «Volver al trabajo»
(`parteDetailView.js:918`, `.btn.btn-secondary`), caja 36 · toque 36,8; a 390 y a 1280 mide 44,6. Ya
estaba el 24-nov (fila «1 corto (no es de esta clase)» de la tabla de arriba). La regla que lo sube a
44 vive en `@media (min-width: 1200px)` (`styles.css:6491`, leída) y a 390 llega por otro lado: entre
medias se queda en los 36 de `DESIGN.md` (medido sólo a 929; dónde empieza y acaba esa franja no se ha
medido). Es el mismo caso que «Guardar precios»: subirlo es
«un cambio de aspecto que nadie ha pedido» según `DESIGN.md`, así que se lleva al orquestador como
decisión y no se toca. `[data-parte-presupuesto]` (`parteDetailView.js:1015`) lleva la misma clase y la
misma regla; NO se ha medido (hace falta un parte firmado con líneas, que el dato del censo no es).

### Rojo-primero y control positivo

- Rojo-primero (sección ① de la salida): con el dato del censo, «Partes» abre sola, el aviso se
  reproduce pulsando en el orden del censo, el panel tiene 0 filas y la lista de oficina 12 nodos. Con
  los datos de este banco: 2 filas a la vista, 22 nodos y, pulsando la fila, 3 casillas y 1 botón.
- Control positivo (sección ③): `renderJobDetailView` y `renderParteDetailView`, montadas con los datos
  del censo, dan aquí la MISMA fila que el censo corrido sobre este árbol
  (`censo-tactil-main-7592c8c14.txt`), a 929 y a 390: 10/0/16/0/0 dos veces, 8/1/0/0/3 y 8/0/0/0/3.
  4 filas comparadas de 4. A 1280 el censo no mide: ahí no hay contraste.
- Las tres sondas del censo (corta, oculta, tapada) en las 21 páginas: 0 fallos. Fuente de la app
  cargada en todas.
- El banco sabe salir en rojo: su primera pasada salió 2 por una expectativa incumplida (la del A9).

### Lo que le falta al censo (para S3; ficheros suyos, no tocados)

1. **`partes` en el Trabajo de muestra.** En el contrato de `/admin/jobs/:id`
   (`_datos-del-censo.mjs:181-187`): `'partes'` en `claves` y
   `dato: () => ({ ...TRABAJO_DE_MUESTRA, partes: [{ id, numero, fecha, estado: 'firmado' }, { …, estado: 'borrador' }] })`.
   En el contrato y no en `TRABAJO_DE_MUESTRA`, que comparte el guard. Efecto medido aquí: la ficha pasa
   de 10 a 13 medidos, con los mismos 16 ocultos, y «Partes» sigue abriendo sola.
2. **El aviso falso de la pestaña elegida al montar.** En `abrirPestanas`
   (`censo-objetivo-tactil-panel.mjs:115-144`), apuntar cuál estaba elegida ANTES del bucle y saltarla
   por índice, en vez de leer `aria-selected` de un nodo que el propio bucle ya ha movido. Los otros dos
   avisos iguales («Plantillas» de `renderQuotesListView`, «Historial» de `renderTemplatesView`) NO se han
   mirado: pueden ser lo mismo o no.
3. **La lista de oficina por encima del suelo.** Tres pendientes en
   `/admin/partes/oficina/pendientes` (`:191-199`) dan 22 nodos.
4. **El parte abierto.** Necesita un gesto que no es una pestaña (clic en `#po-lista > button`) y un
   contrato para `/admin/partes/\d+/oficina` (`partes.routes.ts:369`, forma en `:208-252`).
5. **Tres formas que no casan con el servidor.** `puedeEditarContenido` y `puedeEditarPrecios` van
   como booleano (`:83`, `:197`) y el servidor manda `{ ok, motivo }` (`parteTrabajo.ts:419`): la vista
   lee `.ok`, así que el censo mide el parte de muestra, que es un borrador, como NO editable (por eso
   aparece «Volver al trabajo», que sólo se pinta con `!editable`, `parteDetailView.js:910`). Y `bloque`
   va como `'material'` (`:84`, `:198`) cuando el dominio dice `materiales` (`parteTrabajo.ts:59`).

### No medido, dicho

La lista de oficina vacía (no tiene nada que tocar) · el parte abierto de uno ya facturado (casillas
deshabilitadas, sin botón) · la ficha de un Trabajo cerrado (la barra de «Partes» va oculta) · los
estados de error con «Reintentar» · `[data-parte-presupuesto]` del parte firmado · nada de esto en
yaqu.app ni en un teléfono: es el banco, con la hoja y la fuente de la app, no producción.

### Aceptación → dónde se ve

| aceptación | dónde se ve |
|---|---|
| ① abrir «Partes» en el banco y medir sus botones a 390 y 929/1280 | `docs/master/evidencias/SCRUM-1837/b-esquinas/medidas-7592c8c14.txt`, estados P1 y P2: 0 cortos |
| ② dar puerta a la lista de oficina en el censo | NO HECHO → S3 (los ficheros del censo son suyos); el cambio, en «Lo que le falta al censo» |
| ② medir la lista de oficina | misma salida, estados O1, O2 y O3 |
| identificar cada corto | tabla de arriba: 3 casillas de precio y «Guardar precios», `parteOficinaView.js` |
| curar lo que sea del carril de S4 | no hay corto de S4 en las dos esquinas; los de la lista son de S2 → al orquestador |
| rojo-primero y control positivo con una vista ya censada | secciones ① y ③ de la misma salida |
