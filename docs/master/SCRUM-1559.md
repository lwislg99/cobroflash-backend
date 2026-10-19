# SCRUM-1559 · el serializador del banco perdía nodos y texto: un CRITERIO, no una fila

## 16-oct-2026 · S3 · causa, arreglo del instrumento y antes/después

**Medido contra:** `origin/main` = `ce054fb4da4240ce67aa6715c93380e3e0cfb0d1` · 2026-10-16T12:36:53Z

Hora de la cabecera `Date:` de GitHub · rama `scrum-1559-serializar-lee-los-dos-sitios`.

A9: comprobación → `tests/scrum1559-serializar-lee-los-dos-sitios.test.mjs`
A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

Error propio (17-oct): empujé esta entrada sin pasar los guards del registro en local, y el
obligatorio cayó tres veces por lo mismo que ya vigilaban: el ancla mal formada (`scrum267`), la
falta de esta línea A9 (`scrum1294`) y cuatro `includes('<etiqueta>')` con el `>` pegado en mi
propio test (`scrum553`; pasados a igualdad con la salida entera, que es más estricta).

### La pregunta
S2 midió que en Informes los 5 enlaces de la fila de descargas están en el DOM del banco (5 de 5) y
no en el HTML de `scripts/_pagina-panel.mjs` (0 de 5): el censo daba Informes = 8 medidos y en
producción son 13. Lo que había que contestar: ¿sólo esa fila, o un criterio?

### La respuesta: un criterio, con tres caras
El banco (`tests/_banco-vistas.mjs`) guarda cada dato de un nodo en DOS sitios —el campo y `_attrs`
/ `hijos`— y `serializar()` leía cada uno de UNO solo. Control positivo de la sonda: un `<a>` con
`href` por marcado SALE, por `setAttribute` SALE, por propiedad NO sale.

| # | Qué se perdía | Por qué | Medido en las 18 vistas que montan |
|---|---|---|---|
| 1 | atributo reflejado puesto por PROPIEDAD (`a.href = …`, `.title`, `.placeholder`, `.name`, `.download`, `.htmlFor`) | vive en el campo; sólo se emitía `_attrs` | 18 `<a href>` invisibles para `a[href]` en 5 vistas: Clientes 10/10, Informes 5/5, Facturas 1, Presupuestos 1, Trabajo 1 |
| 2 | `type` nacido del MARCADO | vive en `_attrs`; sólo se emitía el campo | 25 nodos en 7 vistas; `<input type="checkbox">` salía como cuadro de texto (Exportar: 9) |
| 3 | texto propio + un hijo (`btn.textContent = 'Nuevo cliente'; btn.appendChild(kbd)`) | con hijos se emitían sólo los hijos | 23 nodos; el CTA de Clientes se medía como «N» |

No se arregla (declarado): `value` (en el navegador la propiedad no es el atributo, y no mueve la
geometría); y un `_texto` anterior a un `innerHTML` (medido: 0 casos hoy; el arreglo 3 no se aplica
cuando hay `_html`).

Sondas: `docs/master/evidencias/scrum1559/sonda-serializar.mjs` y `sonda-texto.mjs`
(`node <sonda> <raíz-del-árbol>`).

### El arreglo
Sólo el instrumento: `scripts/_pagina-panel.mjs`, `serializar()`. Ninguna vista tocada.
Test `tests/scrum1559-serializar-lee-los-dos-sitios.test.mjs`: **ROJO antes del arreglo** (4 de 8
caen, los cuatro casos; los cuatro controles pasan) y verde después. Verdes también los demás
consumidores del serializador: `scrum1158b`, `scrum1158`, `scrum848b`, `scrum694c`, `scrum522`.

### Antes / después — 🔴 TODO LO QUE SE MUEVE, SUBE, y sube porque el instrumento VE MÁS
Un trinquete que sube sin declararlo se lee como regresión: **no lo es**. Ningún control del
producto ha cambiado.

**`censo:tactil-panel`**

| Cifra | Antes | Después | Por qué |
|---|---|---|---|
| distintos < 44 px | 45 | **53** (+8) | 10 elementos nuevos cortos; los tres «💬» de Clientes cuentan como 1 (la clave es pantalla+selector+texto: es la COLA 2, aparte) |
| mediciones cortas | 70 | **82** (+12) | |
| con `.btn-sm` | 23 | 26 | |
| Informes, medidos | 8 | **13** | lo que cuenta producción; 0 cortos a los dos anchos |
| Clientes, medidos 929 / 390 | 22 / 21 | 32 / 28 | |
| Exportar, medidos | 3 | 9 | sus 6 casillas, 46 px: cumplen |
| Facturas 929 / 390 | 4 / 4 | 6 / 5 | |
| Presupuestos 929 / 390 | 4 / 4 | 5 / 5 | |
| Trabajo | 10 | 11 | el `tel:` |

Diff elemento a elemento (`evidencias/scrum1559/diff-censo-viejo-vs-nuevo.txt`, con
`diff-censo.mjs`), emparejando por pantalla+ancho+selector+ordinal y con las dos copias del censo
reproduciendo las cifras reales (45 y 53) como control: **263 emparejados · 46 nuevos · 0
desaparecidos · 0 cambian de veredicto · 0 cambian de área ≥ 0,5 px.** La cara 3 cambió 16 textos
(«N» → «Nuevo clienteN», «· 0» → «Todos · 0»…) y ninguna área: **no había falsos cortos ni falsos
buenos por el texto perdido**, en esta población.

**Los cortos que aparecen** (controles de S2; aquí NO se arreglan):

| Vista | Selector | Texto | 929 px | 390 px |
|---|---|---|---|---|
| Clientes | `A.btn-secondary.btn-sm` | ⬇ Clientes CSV | 31,0 | 31,0 |
| Clientes | `A.contacto-link` (×3) | los tres teléfonos | 41,8 | 45,0 cumple |
| Clientes | `A.contacto-link.contacto-link--icono` (×3) | 💬 | 37,0 | 45,0 cumple |
| Facturas | `A.btn-secondary.btn-sm` | ⬇ CSV | 31,0 | 31,0 |
| Facturas | `INPUT` (casilla del marcado) | — | 14,0 | sin pintar |
| Presupuestos | `A.btn-secondary.btn-sm` | ⬇ CSV | 37,0 | 45,0 cumple |

**`guard:objetivo-tactil`** (36 px en escritorio, 44 en móvil): de **0 hallazgos** a **2 hallazgos,
un solo elemento**: «⬇ Clientes CSV», `A.btn-secondary.btn-sm`, 31 px < 36 a 929 y 31 < 44 a 390.
Interactivos de Clientes en el DOM servido 29 → 39; ficha de Trabajo 20 → 22. Los teléfonos y «💬»
de Clientes (41,8 y 37) pasan los 36 del guard en escritorio. El guard queda en ROJO al entrar esto
en main; no se le añade excepción ni se toca (regla 41): o se arregla el control, o se decide junto
con `.btn-sm` (las demás `.btn-sm` de Clientes ya esperan esa decisión del fundador).

## 16-oct-2026 · S3 · los datos de muestra del censo dan respuestas que el servidor nunca daría

S2 midió que el «undefined» de Ajustes (los tres `kpi-value` de Referidos) sale del fixture y no
del producto: `GET /admin/referral` siempre trae las cinco claves. Preguntado si era sólo ése: **es
un patrón, no un caso.** Sonda `evidencias/scrum1559/sonda-fixture-relleno.mjs`, con control (una
ruta servida sale como servida; una inventada cae en el relleno):

- **28 rutas reales** que piden las vistas caen en el `return []` de relleno de `DATOS`
  (`scripts/censo-objetivo-tactil-panel.mjs`), entre ellas endpoints que devuelven OBJETO:
  `/admin/referral`, `/admin/connect/status`, `/admin/metrics/home`, `/admin/reports/pl`,
  `/admin/reports/vat`, `/admin/expenses/summary`, `/admin/exports/datos.zip/info`…
- Rutas «servidas» con el fixture de OTRA: `/admin/customers/:n/historial` y `/whatsapp` casan con
  `/admin\/customers/` y reciben la LISTA de clientes; `/admin/jobs/:n/gastos` recibe el Trabajo;
  `/admin/albaranes/:n/fotos` recibe el albarán.
- Vistas de detalle montadas SIN id: `/admin/jobs/NaN`, `/admin/albaranes/undefined`,
  `/admin/partes/undefined` (sólo la 360 lleva argumento en `ARGUMENTOS_DE_VISTA`).

No arreglado aquí: mueve las cifras de pantalla y mezclarlo con el serializador no dejaría saber
cuál las movió. No medido: los datos propios que `guard:objetivo-tactil` pasa a cada superficie.

## 16-oct-2026 12:42Z · S3 · 1559b — el censo cuenta cada ELEMENTO (la COLA 2)

Rama `scrum-1559b-censo-cuenta-cada-elemento`, encima de la de 1559 (GO del orquestador).
«Distinto» en `censo:tactil-panel` era pantalla + selector + texto: tres «💬» de Clientes contaban
UNO. Ahora es pantalla + posición del elemento en `querySelectorAll(INTERACTIVOS)`
(`scripts/_censo-distintos.mjs`). Sirve de identidad a los dos anchos porque el censo sirve el MISMO
HTML a 929 y a 390. Test `tests/scrum1559b-censo-cuenta-cada-elemento.test.mjs`: con la clave vieja
cae 1 de 5 (el caso), los 4 controles pasan; con la nueva, 5 de 5.

🔴 **El total SUBE, y sube porque el instrumento cuenta lo que antes juntaba:**

| Cifra | Con 1559 | Con 1559b | Qué entra |
|---|---|---|---|
| distintos < 44 px | 53 | **61** (+8) | todo en Clientes, filas que se juntaban |
| `BUTTON.btn-secondary.btn-sm` | 12 | 16 (+4) | «Editar» ×3 y «Portal» ×3 contaban 2 |
| `BUTTON.btn-ghost.btn-sm` | 3 | 5 (+2) | «📊 Historial» ×3 contaba 1 |
| `A.contacto-link.contacto-link--icono` | 1 | 3 (+2) | «💬» ×3 contaba 1 |
| con `.btn-sm` | 26 | 32 | |
| mediciones cortas | 82 | **82** | sin cambio: control de que sólo cambió la cuenta, no la medida |

Quién cita las cifras viejas: `docs/master/SCRUM-1158.md` (62 → 51 con la clave vieja y el banco
de antes de 1559). No se reescribe: es lo que se midió entonces con aquel instrumento.
Declarado y sin tocar: el suelo de `guard:objetivo-tactil` (`distintosEsperados`) usa la misma
clave `sel|texto` (`scripts/guard-objetivo-tactil.mjs`, el `Set` de distintos), así que subcuenta
igual. Es un suelo (mínimo): subcontar lo hace más fácil de cumplir, no da rojos falsos.

17-oct · error propio: `scripts/_censo-distintos.mjs` nació sin fila en `dos-equipos.md` §3.3 y el
obligatorio cayó por `scrum1480f`. Fila propia a nombre de S3, con su motivo (decisión del
orquestador de Luis), y `.claude/carriles.json` + `carril-s3.md` regenerados con
`node scripts/carriles.mjs generar`.

## 18-oct-2026 · S2 · 1559g — los 16 controles NUESTROS de la §20, a 44 px

**Medido contra:** `origin/main` = `e59be9fa384b5bb1d4fbaa6d429a32a5a8a6be8d` · 2026-10-17T23:51:18Z
A9: comprobación → `tests/scrum1559g-dieciseis-controles-44px.test.mjs`
**Skill UI:** cargada · `yaqu-premium-ui`: sólo tamaño (`min-height`/`min-width` 44 px y el área de una casilla), cero tokens, cero texto, cero componentes.

S2 · rama `scrum-1559g-dieciseis-controles-nuestros-44px` · worktree `s2-1559g`. Encargo del orquestador
(18-oct): los 16 de `docs/equipo/para-javier.md` §20 que son nuestros, con el patrón de SCRUM-1158c (decisión
del fundador de SCRUM-786, opción ③: reglas ACOTADAS, nunca `.btn-sm` global). Los 15 de J1/J2/J3 no se tocan.

**Recuento propio, no cifra heredada.** `censo:tactil-panel` sobre `main` (`e59be9fa3`), con el detalle por
elemento de las cuatro pantallas: salen los **16** de S3, uno a uno, con las mismas medidas.

| pantalla | control | antes 929 / 390 | después 929 / 390 |
|---|---|---|---|
| Inicio | «Ver resumen» | 30,9 / 30,6 | 44,6 / 44,6 |
| Inicio | «✕» | 30,9 / 30,6 | 44,6 / 44,6 |
| Inicio | «Ver facturas →» | 30,7 / 30,5 | 44,7 / 44,5 |
| ficha de presupuesto | «📄 PDF», «⎘ Duplicar», «← Volver» | 31 / 31 | 45 / 45 |
| ficha de presupuesto | «↻ Reenviar por WhatsApp», «↻ Reenviar por correo» | 30,5 / 30,5 | 44,5 / 44,5 |
| ficha de presupuesto | «Aceptar presupuesto», «Rechazar presupuesto» | 30,5 / 30,6 | 44,5 / 44,6 |
| ficha de presupuesto | «+ Añadir gasto a este trabajo» | 30,6 / 30,7 | 44,6 / 44,7 |
| ficha de presupuesto | casilla de `documentoAsignados` | 21 / 21 | 45 / 45 |
| Solicitudes | «+ Crear presupuesto», «✓ Marcar gestionada» | 30,7 / 30,9 | 44,7 / 44,9 |
| Albaranes | número «A-2026-0031» | no tocable / 17 | 45 / 45 |
| Albaranes | «Enviar para firmar» | 30,8 / 44,6 | 44,8 / 44,6 |

Total del censo: distintos bajo 44 px **97 → 80** (−17), mediciones cortas **143 → 111**. Los 17 son los 16 más
la casilla en la ficha de FACTURA de J1: `documentoAsignados.js` es un componente compartido, y arreglarlo aquí lo
arregla allí (avisado al orquestador para que J1 no lo toque también). Las otras 46 filas pantalla × anchura,
**idénticas** a las de `main`, comparadas fila a fila. Quedan, sin tocar y fuera del encargo: «Nuevo albarán» (37)
y «Crear revisión» (36,7) a 929, que cumplen los 36 px de escritorio de `DESIGN.md`.

### Qué cambia
- `public/dashboard/css/styles.css`: una regla de alto para `#btn-ver-resumen-trimestre`, `.home-hero-card > .btn-sm`,
  `.presupuesto-ficha .btn-sm`, `.solicitud-acciones > .btn-sm` y `.table--albaranes td.cell-actions > .btn-sm`;
  alto y ancho para «✕» (un glifo); el número del albarán como caja de 44 (`inline-flex`); y la casilla con el
  mecanismo de `.casilla-tactil-44` (SCRUM-786), con `inset: -12px` y no -16: 20 + 2 × 12 = 44 cabe en su fila de
  44, y -16 se metería 2 px en la de al lado, que marca a OTRA persona.
- La ficha del presupuesto va ENTERA (`.presupuesto-ficha`) y no botón a botón: el censo sólo ve lo que pintan sus
  datos, y «Confirmar aceptación», «Archivar» o el del albarán son la misma pantalla.
- `quotesDetailView.js` y `quoteRequestsView.js`: una clase de enganche cada uno, en la MISMA línea (no se mueve
  ninguna). `homeView.js` y `albaranesView.js` no se tocan: sus ids y clases ya bastaban.
- `tests/scrum1559g-dieciseis-controles-44px.test.mjs`: las reglas con 44 px, `.btn-sm` global intacto, el `inset`
  contra el alto de la fila, y que cada vista siga pintando sus controles DENTRO de lo que la regla nombra, montada
  con los datos del censo (`_datos-del-censo.mjs`).

### Verificado, ejecutando
- **Censo en navegador**, `main` contra esta rama (un árbol desechable de `main` al lado, misma `dist`): la tabla de arriba.
- **Rojo primero, por mutación** (cada una aplicada y restaurada byte a byte): sin `presupuesto-ficha` en la ficha,
  con la regla renombrada, con `inset: -16px`, sin `solicitud-acciones`, y sin el ancho de «✕»: cae 1 cada vez. Base: 6 de 6.
- `guard:objetivo-tactil`: rojo, y AJENO: «⬇ Clientes CSV» (J2, §17), el que anunció 1559b. Ninguna excepción sobra.
- **yaqu.app, cuenta QA**, antes del merge: sonda de sólo lectura (`sondas-s2/tactil-1559g.mjs`, fuera del repo;
  sirve `styles.css`, `quotesDetailView.js` y `quoteRequestsView.js` de la rama en lugar de los de producción, con
  control de que se sirvieron y de que el interceptor corta todo lo que no es GET; 0 escrituras, 0 errores;
  capturas en `sondas-s2/cap1559g/`). Área de toque por `elementFromPoint` desde el centro, no por caja:
  · ficha del presupuesto #202, a 390 y a 929: **8 de 8** de 30,5 a **44,5** («📄 PDF», «⎘ Duplicar», «Archivar»,
    «← Volver», «✉️ Enviar por correo», «Aceptar presupuesto», «Rechazar presupuesto», «+ Añadir gasto…»);
  · Albaranes: «Enviar para firmar» y «Emitir» 30,5 → **44,5** a 929; los tres números 16 → **44,5** a 390, y a 929
    de 17×10 / TAPADOS (0×0) a una caja de **120,5×18,5** sin huecos.
  · **NO medido en yaqu.app, y por qué:** Inicio (la cuenta QA no pinta ni «Tu resumen del trimestre» ni «Tienes en
    juego»), Solicitudes (cero solicitudes), los dos «↻ Reenviar» (QA no tiene un presupuesto enviado) y la casilla
    (sin miembros de equipo). Medidos en el banco, arriba. No se han creado datos: la sonda no escribe.
- **De paso, medido y NO arreglado — para el orquestador:** a 929 la tabla de Albaranes parte letra a letra el
  número («A/B2/6/0/0/3»), las fechas («16/10/2 026») y el estado («BOR/RAD/OR»): siete columnas en 631 px y
  `.table td { word-break: break-word }` global. Probé a ponerlos en una línea y lo retiré: sólo con el número la
  tabla pide 676 px y desborda 45 (con «Enviar para firmar» medio fuera); con todo, 27-251 px entre 800 y 1024.
  Es de cuántas columnas caben a ese ancho, no de toque, y no cabe en este PR.
## 1559i — la tabla de Albaranes, entera desde 900 px (S2, s2-18oct)

**Medido contra:** `origin/main` = `2cc3243ec30c41e27bbe04d0d5647f241c83c28c` · 2026-10-18T19:02:57Z

**Skill UI:** cargada · sólo CSS acotado a `.table--albaranes` (`public/dashboard/css/styles.css`), sin texto nuevo; una pantalla.

**Decisión (orquestador, 18-oct):** A+B desde 900 px; **NO** la tarjeta C para 769-899. **769-899 queda sin
tratamiento propio, decidido el 18-oct; se añade si aparece una medida que lo pida.**

- **A** · desde 641, en esta tabla `word-break: normal; overflow-wrap: break-word` (se parte por palabras, nunca
  dentro de una) y la fecha `nowrap`. La causa era la regla GLOBAL `.table td { word-break: break-word }`, que
  NO se toca: el modificador la acota a esta tabla (el patrón de `.table--trabajos`).
- **B** · entre 641 y 1279 se oculta «Emisión» (el mismo `col-hide-mobile` que ya la quita en móvil; la ficha la
  sigue teniendo) y el relleno lateral baja a 8 px desde 769.

**Medido en yaqu.app** (build `214283d79`, cuenta QA, 3 albaranes) sirviendo el `styles.css` de la rama;
`sondas-s2/albaranes-tabla-medida.mjs [css]`, sólo GET. Carril = ancho del `.table-scroll`; desborda = lo que la
tabla pide de más; «página» = scroll horizontal de la PÁGINA.

| ancho | prod: desborda · alto de fila | rama: desborda · alto de fila | rama: página |
|---|---|---|---|
| 769 | 149 · 171-192 | 106 · 108-109 | +0 |
| 800 | 118 · 171-192 | 75 · 108-109 | +0 |
| 850 | 68 · 171-192 | 25 · 108-109 | +0 |
| 899 | 19 · 171-192 | **0** · 87-88 | +0 |
| 900 | 18 · 171-192 | **0** · 87-88 | — |
| 929 | 0 · 150-171 | 0 · **69** | — |
| 1024 | 0 · 87-88 | 0 · 69 | — |
| 1100-1440 | 0 · 69 | 0 · 69 | — |

Con la rama, número, fechas y estado van en UNA línea en todos los anchos medidos (641-1440); cliente y trabajo se
parten por palabras (4 líneas a 769-850, 2 a 929-1024). Por debajo de 769 la tabla ya era un bloque con scroll
(A6.6) y no cambia de forma; el botón de la fila queda menos fuera (641: 158 → 64 px; 700: 99 → 5; 768: 31 → 0).
**769-899, ¿rota o fea?** Fea, no rota: la página no se desborda (+0), el carril tiene `overflow-x: auto` y la
acción se alcanza con su scroll (a 769, 24 px fuera; prod: 62). Es el patrón del design system, y en esa banda
prod ya desbordaba MÁS. Capturas fuera del repo: `sondas-s2/cap-albaranes-929/albaranes-{800,929,1280}-rama-1559i.png`
y las `-prod` de la misma tanda.

**Test** `tests/scrum1559i-tabla-albaranes-desde-900.test.mjs` (sin gate; el caso de la vista usa el banco, que
pide `dist`): las reglas EN SU `@media` (lector de reglas con condición, con control: ve la regla global
causante), que la regla global siga intacta, y que la vista pinte lo que las reglas nombran (2.ª cabecera
«Emisión», su celda con `col-hide-mobile`, la 3.ª con `cell-date`, tantas celdas como cabeceras).
**Rojos sembrados**, deshechos cada vez: ① quitar `word-break: normal` → cae A; ② quitar `th:nth-child(2)` → cae
B; ③ el relleno sólo en `th` → cae B; ④ cambiar la regla GLOBAL → caen el control y «acotada»; ⑤ quitar
`col-hide-mobile` de la celda en la vista → cae el de la vista. Los 84 ficheros que leen `styles.css` o
`albaranesView.js`: 813/813 con y sin el cambio, sobre el mismo `dist` (`tsc` con el error conocido de
`activityKind`, Prisma desfasado; no se ha corrido `prisma generate`).
A9: comprobación → `tests/scrum1559i-tabla-albaranes-desde-900.test.mjs`


## 1559j — Productos a 44 px, y su estado vacío dentro de la pantalla (S2, 19-oct-2026 11:27Z)

**Encargo** (orquestador, 19-oct): S3 contó 8 controles cortos nuestros sin repartir; 6 de Productos, para S2.
Medidos con el censo de `main` (`ea8dece1d`) y una copia con detalle por elemento, FUERA del árbol: en
Productos son **7 a 929 y 6 a 390** (S3 dio 6 porque contaba a 390):

| control | antes 929 | antes 390 | rama 929 | rama 390 |
|---|---|---|---|---|
| «Recargar», «⬇ Exportar CSV», «⬆ Importar CSV» (`.btn-sm`) | 31 | 31 | 45 | 45 |
| casilla «Solo activos» | 14 | 14 | 46 | 46 |
| «Crear producto» | 36,9 | 44,6 | 44,9 | 44,6 |
| «Editar», «Activar» de cada fila (`.btn-sm`) | 30,7 | 30,8 | 44,9 | 44,8 |

Censo entero: **81 → 74** distintos por debajo de 44, y la tabla por pantalla sólo cambia en las dos filas de
Productos (comparada línea a línea). Sondas del censo: 56/56 cazadas.

**Arreglo** (patrón 1559g + 1265, sólo tamaño): clase de enganche `catalogo-productos` en el `.data-card` de la vista
y reglas acotadas en `styles.css`; `.btn-sm` global sin tocar. La casilla es la del navegador (13 px): su `::before`
da 13 + 2 × 16 = 45 de alto y sólo 6 de lado, menos que el hueco de 10 del toolbar, para no tapar el buscador. Los dos
botones del catálogo vacío entran también, por la regla de pantalla entera.

**De paso, en la misma pantalla:** con el catálogo VACÍO, a 390 el estado vacío vivía en un `td` de 520 px dentro de
una caja con scroll de 364: el título, el texto y «+ Añadir un servicio a mano» (x 298-493) quedaban cortados por la
derecha. Ahora el estado vacío toma el ancho de la caja (`container-type` + `100cqi`) y se queda pegado a su izquierda:
los dos botones caben (se apilan) a 390, y a 929 y 1280 no cambia nada visible. Con la tabla llena la regla no aplica.

**Medido en yaqu.app** (cuenta QA, 0 productos; builds `ea8dece1d` y `1cdccf36c`), sirviendo `styles.css` y
`productsView.js` de la rama; sólo GET. `sondas-s2/tactil-1559j.mjs [árbol]` con control (un botón de 12 px sale
corto): prod 7 cortos a 1280 y 6 a 390 → rama 0 y 0. `sondas-s2/vacio-productos-390.mjs [árbol] [ancho]`: el botón
pasa de x 298-493 (sin nada en su centro) a 94-288 dentro de la caja 13-377. Capturas antes/después fuera del repo:
`sondas-s2/cap1559j/`.

**Test** `tests/scrum1559j-productos-44px.test.mjs` (sin gate; el caso de la vista usa el banco, que pide `dist`):
las reglas con 44, la casilla (alto ≥ 44, lado < 10), el estado vacío (contenedor + sticky + ancho) y que la vista
pinte los controles dentro de lo que las reglas nombran. **8 mutaciones, 8 rojas** (sin la clase, sin la regla de
`.btn-sm`, sin el `::before`, inset -14, inset lateral -12, sin `container-type`, sin `sticky`, `.btn-sm` global a 44),
base verde. Los 280 ficheros que leen `styles.css`, `productsView.js` o el banco: 2440/2441, y el rojo era el de la
skill sin declarar (este registro). `tsc` con el error conocido de `activityKind`; no se ha corrido `prisma generate`.
A9: comprobación → `tests/scrum1559j-productos-44px.test.mjs`
> **Skill UI:** cargada · `yaqu-premium-ui`: sólo tamaño (`min-height` 44 px, el área de una casilla) y el ancho del estado vacío de una pantalla; cero tokens, cero texto, cero componentes.
