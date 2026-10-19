# SCRUM-1177 · Las citas a una red que no existe

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T15:58Z

A9: sin fallo que generalice — mis tres tropiezos de la tanda ya tienen norma o trampa escrita: lo puse «En curso» tarde (A13, paso 2); la mitad de PR del control del sufijo salió ciega por `ConvertFrom-Json` en PowerShell 5.1 (se vio, «PRs leídos=1», y se repitió antes de empujar); y faltaba esta línea (lo cazó SCRUM-1294 en CI).

S3 · rama `scrum-1177-citas-a-redes-que-no-existen` · worktree `wt-s3-1367e` (hora del `Date:` de GitHub).

## Qué mentía

Un comentario de test que dice «esto se mide en tal guard» cuando ese guard no ha existido nunca. Quien
lo lee se cree que hay red, y nadie comprueba lo que el comentario dice que se comprueba.

## Cuánto

Censo de las líneas de COMENTARIO de los `.mjs/.js/.cjs` seguidos de `tests/` y `scripts/` (1.843
ficheros, 113.214 líneas de comentario), buscando entre comillas de código rutas `tests/…` o
`scripts/…`, ids de test (`scrumNNNx`) y `npm run x` que no existen. Control positivo: las dos citas del
ticket salen.

| clase | cuántas | qué se hace |
|---|---|---|
| red que **nunca existió** | **3** | se corrigen (abajo) |
| ejemplo o marcador de una API (`tests/x.mjs`, `scripts/X.mjs`, `npm run X`…) | 8 | declaradas, una a una |
| temporal que crea un test mientras corre (`tests/__tmp-emite-sin-sellar.ts`) | 1 | declarada |
| fichero retirado a propósito en SCRUM-773, nombrado como historia | 5 | declaradas |
| `test:pass`/`test:fail`… tomados por scripts de npm | 35 | **falso positivo de mi primer patrón** (son eventos del reporter de Node): se retiró el patrón, no se cuentan |

Las tres redes, con `git log --all -- <ruta>` vacío (no se borraron: no existieron):

1. `tests/scrum783-seleccion-sobrevive-navegacion.test.mjs:115` — «la visibilidad de verdad se mide en
   navegador» con un guard de la barra de selección. **Ahora dice:** nadie la mide en navegador; las
   reglas de la cascada las fija `tests/scrum792-barra-alcanzable-en-movil.test.mjs` (que existan en su
   `@media`, no que ganen). Es la opción 2 del ticket; la 1 (medirlo) queda **sin hacer**, abajo.
2. `tests/scrum720b-el-nav-abre.test.mjs:16` — atribuía a un `scrum652f` que no existe lo que mide el
   «SUELO DEL NAV» de `scrum652d`. Corregida la cita.
3. `tests/scrum832-atras-vuelve-a-la-lista.test.mjs:18-19` — **no venía en el ticket; la encontró el
   censo.** «El atrás de verdad se mide en» un guard que nunca existió. **Ahora dice:** el «atrás» de una
   ficha a su lista no lo mide nadie; `guard:rastro-del-menu` pulsa «atrás», pero entre pantallas del menú
   (leído en `scripts/guard-rastro-del-menu.mjs:122-134`).

## La red nueva

`tests/scrum1177-la-red-citada-existe.test.mjs`, en el check obligatorio. Trinquete de dos mitades: una
cita rota sin declarar cae, y una declarada que ya no aparece también cae (sobra). Suelo: > 1.000
ficheros y > 50.000 líneas de comentario leídas. Control del detector con un árbol fabricado (una rota,
una buena, una en código que no cuenta, y `npm run`).

Rojo por mutación, sobre `af4c8b5a3f0d63a2eb7c44e5f44ab7329221910d` (el árbol entero comiteado antes):

- se re-introduce en `scrum832` la cita al guard inexistente → cae el caso 2, nombrando
  `tests/scrum832-atras-vuelve-a-la-lista.test.mjs:18`;
- se añade una DECLARADA que no corresponde a nada → cae el caso 3, nombrándola.

Deshecho con Edit (`git diff` vacío después).

## Lo que no mira, declarado

Un comentario al final de una línea de código; una cita sin comillas de código; los `.md`. Y si lo
citado CORRE en el check obligatorio: eso es SCRUM-1178.

## Sin hacer

- La medición de la barra de selección en un navegador (opción 1 del ticket) y la del «atrás» de una ficha
  a su lista. Las dos son piezas visibles sin red; los comentarios ya lo dicen en vez de esconderlo.

## 1177b · la barra de selección, medida en un navegador (18-oct-2026, S3)

**Medido contra:** `origin/main` = `2cc3243ec30c41e27bbe04d0d5647f241c83c28c` · 2026-10-18T18:44:10Z

A9: comprobación → `docs/master/evidencias/SCRUM-1177/sonda-barra-en-navegador.mjs`

(Es una sonda, no un test: mide, no vigila. Por qué no es un test, abajo.)

**De dónde sale.** El orquestador cerró 1177 el 18-oct (c.19957) por la letra de su aceptación, y dejó dicho el
hueco: «nadie mide en un navegador que la barra de selección sea visible de verdad». Encargó medirlo como
continuación de este registro, sin ticket nuevo. Sólo se lee: ni la vista (`customersView.js`, J2) ni la hoja
(`styles.css`, S2) se tocan.

**Cómo.** La lista de Clientes la pinta el PRODUCTO en Edge (`scripts/_banco-lista.mjs`: los scripts del índice,
en su orden; sólo se dobla `apiRequest`), con dos clientes de muestra. Por anchura y con 0 y 1 marcado (la casilla
de una fila, pulsada de verdad) se mide la barra `div.barra-seleccion`: `display`, su caja y QUIÉN responde en su
centro (`elementFromPoint`). Lo último es lo que dice si la barra GANA y no sólo si está.

**Resultado: todo como dice la hoja, y ninguna anchura se queda sin vía.**

| ancho | 0 marcados | 1 marcado | vías de «seleccionar todos» con 0 |
|---|---|---|---|
| 390 | se ve · 364×42 · gana | se ve · 364×148 | 1 (la barra) |
| 640 | se ve · 614×42 · gana | se ve · 614×96 | 1 (la barra) |
| 641 | oculta (`none`) | se ve · 615×96 | 1 (la cabecera) |
| 929 | oculta (`none`) | se ve · 631×96 | 1 (la cabecera) |
| 1280 | oculta (`none`) | se ve · 982×65 | 1 (la cabecera) |

El relevo entre 640 y 641 px no deja hueco: hasta 640 la vía es la barra (allí la cabecera no gana), desde 641 la
casilla de la cabecera. Es lo que SCRUM-792 midió a mano con cuatro casos («0 vías alcanzables» a 390 antes de su
arreglo); aquí se repite con cinco anchuras, las dos del umbral incluidas.

**Controles positivos: los tres caen, salen NO visibles.**
- La barra ocultada a la fuerza por CSS a 390 px: `display none`.
- La barra TAPADA por una capa transparente encima a 390 px: `display flex`, caja 364×42, y **no gana**. Sólo
  `elementFromPoint` lo caza: un control por `display` o por caja diría «se ve».
- La casilla de la cabecera ocultada a la fuerza a 929 px con 0 marcados: el recuento de vías da 0.

**¿Cabe en el check obligatorio? NO, y éste es el motivo.** La aceptación pedía un `tests/*.test.mjs` sólo «si la
visibilidad cabe como cascada CSS». Que la barra GANE no cabe en una cascada leída: hace falta un motor de
maquetado. Y la suite obligatoria no arranca navegador, por decisión escrita en la casa (`package.json`,
`//guard:lista-trabajos`: «Fuera de npm test por la misma decision que guard:contraste y guard:objetivo-tactil: la
suite no arranca navegador»). Lo que sí cabe sin navegador, que las reglas de la cascada existan y compartan
`@media`, ya corre en el obligatorio: `tests/scrum792-barra-alcanzable-en-movil.test.mjs`. Así que el hueco se
cierra con una medida declarada y repetible, no con una red. Meterla en el job informativo de guards de navegador
es una decisión de workflow (S5 y orquestador), y no la tomo aquí.

**Lo que NO cubre.** Una lista con dos clientes: no se miran cientos de filas ni el scroll largo. Sólo la lista de
Clientes, que es donde vive la barra. Sólo Edge: ni Safari ni Chrome de móvil. Y la medida vale para este árbol:
nada la repite sola.
