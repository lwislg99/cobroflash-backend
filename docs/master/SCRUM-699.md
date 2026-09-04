# SCRUM-699 · La tabla de clientes acababa FUERA de su `div.table-scroll`

**Fecha:** 4-sep-2026 · **Carril:** panel de clientes (UI) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `e87a939bd35a5bcaf77212e4c9e8401cd2288f50` · 2026-09-04T21:03:23+01:00

**Tanda:** **5.255 pruebas · 5.166 en verde · 1 fallo · 88 saltadas**, con `main` ya mergeado
dentro y medida DESPUÉS del último cambio, entrada incluida.

🔴 **EL «1 fallo» NO ES DE ESTA RAMA, Y NO SE ESCONDE.** Es
`tests/scrum176b-force-por-identidad.test.mjs:118`, y **`main` limpio da exactamente el mismo**:
se midió ANTES de tocar una línea, sobre un worktree recién nacido de
`1304643497934441f88950e441182b7e344dbb57`, y dio **5.225 · 5.136 · 1 fallo · 88 saltadas** con
ese mismo test y ese mismo mensaje. Está en los hallazgos fuera de carril, abajo. En el CI
(Ubuntu, `/home/runner/work/…`) no aparece: sólo cae donde el camino del checkout tiene un
espacio.

⚠️ **De dónde salen los +30 tests, dicho con precisión:** **5 son de este ticket** (medidos
corriendo el fichero solo). Los otros **25** vienen del `main` nuevo que se mergeó dentro
—SCRUM-607, SCRUM-602, SCRUM-684b y SCRUM-731—, porque la línea base se tomó contra el `main`
ANTERIOR. **No se ha hecho comparación de fan-out nombre a nombre**, así que ese reparto es
aritmética, no medición, y por eso se dice de dónde sale.

---

## 🔴 LO PRIMERO: EL SÍNTOMA DEL TICKET DA CERO, Y EL DEFECTO ES REAL IGUAL

El encargo pedía una cifra: *«¿desborda la página en escritorio con todas las columnas, en una
ventana estrecha? CON NÚMERO, en píxeles»*. Se midió en navegador real (Edge, `puppeteer-core`,
el mecanismo de `scripts/_navegador.mjs`) sobre **18 anchos** de 641 a 1920 px, con las nueve
columnas encendidas y siete clientes ordinarios:

| | |
|---|---|
| desborde de página (`documentElement.scrollWidth − clientWidth`), máximo de los 18 anchos | **0 px** |
| … y con el defecto puesto a propósito, esos mismos 18 anchos | **0 px** |

**La página no desborda, ni desbordaba, ni puede desbordar.** `html, body { overflow-x: clip }`
(`styles.css:359`) lo impide por diseño, y esa línea lleva escrito al lado justo el contrato que
este ticket viene a mirar: *«la PÁGINA jamás scrollea en horizontal; lo ancho scrollea dentro de
su `.table-scroll`»*.

🔴 **Y eso NO cierra el ticket, lo cambia de sitio.** Un `clip` no hace que lo ancho quepa: hace
que lo ancho **desaparezca**. La tabla no desbordaba — **la recortaban**, y sin envoltorio no
quedaba ningún carril por el que llegar a lo recortado. Medir sólo «desborde de página» habría
devuelto un cero limpio y la conclusión contraria a la verdad.

## PASO 0

**ENTRADA — dónde llega el usuario, ruta y fichero.** Barra lateral → botón
`data-view="customers"` (`public/dashboard/index.html:122`) → `app.js:266` `case 'customers'` →
`renderCustomersView(viewContainer)` en `public/dashboard/js/customersView.js:33`. Es la pantalla
**Clientes** del panel, la que usa cualquier profesional con cartera.

**MECANISMO — existía, completo, y llevaba inerte desde el día en que se construyó.** El
envoltorio `.table-scroll` existe, tiene su CSS (`overflow-x: auto`, `styles.css:1807`) y la vista
lo crea (l. 263) y le mete la tabla dentro (l. 266). No había nada que construir. Lo que había era
una línea de más.

## La causa, en una frase

`customersView` metía la tabla en el `.table-scroll` (l. 266) y **150 líneas más abajo** hacía
`outerCard.appendChild(table)` (l. 347). Insertar **MUEVE** —un nodo está en un sitio, no en
dos—, así que la tabla se volvía al `.data-card` y el envoltorio se quedaba **vacío**.

**Y no es reciente.** `git log -L` sobre las dos líneas lo fecha: la l. 347 viene del **primer
commit del fichero** (`5142388b`), de cuando no había envoltorio; el envoltorio lo añadió
`bc4cf146` —*«fix(UI): layout desktop + scroll móvil en todas las vistas»*— que escribió las dos
líneas de arriba **y se dejó la vieja**. O sea que el arreglo de aquel commit **nunca llegó a
aplicarse en esta vista**: el envoltorio nació muerto.

El hallazgo es de S1, de pasada al cerrar SCRUM-697 (citaba las líneas 183 y 207; hoy, con el
fichero crecido, son la **266** y la **347**). Se comprobó antes de tocar nada, y era exacto.

## 🔴 LO QUE COSTABA: TRES BOTONES QUE NO SE PUEDEN PULSAR

`.data-card { overflow: hidden }` (`styles.css:1819`) recorta lo que sobra. Sin envoltorio no hay
barra ni rueda: **un `hidden` se deja empujar por código pero no por un humano**. Así que el
árbitro no puede ser el ancho — es **si se puede pulsar**, medido por QUIÉN RECIBE EL TOQUE
(`elementsFromPoint`), que es como lo mide la casa desde SCRUM-542/562.

La columna de acciones de cada fila lleva **`Editar` · `Portal` · `📊 Historial`**. Antes y
después, mismo fichero de disco, misma pasada del navegador (el «antes» se obtiene devolviéndole
la línea al JS **que se sirve**, sin ensuciar el árbol):

| ancho de ventana | card | recorte | carril ANTES | pulsables ANTES | carril DESPUÉS | pulsables DESPUÉS |
|---|---|---|---|---|---|---|
| 1280 | 982 | 0 px | — | 3/3 | — | 3/3 |
| 1240 | 942 | 21 px | **NINGUNO** | 3/3 | envoltorio | 3/3 |
| **1196** | 898 | 65 px | **NINGUNO** | **2/3** | envoltorio | 3/3 |
| 1152 | 854 | 109 px | **NINGUNO** | **2/3** | envoltorio | 3/3 |
| 1100 | 802 | 161 px | **NINGUNO** | **1/3** | envoltorio | 3/3 |
| 1024 | 726 | 237 px | **NINGUNO** | **0/3** | envoltorio | 3/3 |
| 900 | 602 | 361 px | **NINGUNO** | **0/3** | envoltorio | 3/3 |
| 769 | 471 | 492 px | **NINGUNO** | **0/3** | envoltorio | 3/3 |
| 768 | 742 | 718 px | tabla | 3/3 | tabla | 3/3 |
| 641 | 615 | 845 px | tabla | 3/3 | tabla | 3/3 |

**8 de los 18 anchos medidos perdían acciones. Después: 0 de 18.**

**El umbral, al píxel:** barrido de 1264 a 1120 px **de 4 en 4**. El primer ancho (bajando) en el
que se pierde un botón es **1196 px** (card 898, recorte 65 px). De 1264 a 1200 el recorte ya
existe pero se come sólo el hueco a la derecha del último botón.

**Por qué por debajo de 768 px no se notaba, y por qué eso importa:** ahí manda
`.table { display: block; overflow-x: auto }` (`styles.css:1762`), de A6.6, cuyo comentario dice
literalmente *«antes el clip de html/body recortaba las últimas columnas (estado, acciones)»*.
**La casa ya había tenido este defecto exacto y lo arregló sólo para móvil.** La mitad de
escritorio se quedó dependiendo del envoltorio que estaba vacío. Y ese hueco es el rango de
ventana más común que hay: media pantalla de un 1920, un portátil de 1366 con el navegador sin
maximizar, un 1024.

## Las otras dos preguntas del encargo

**② ¿Qué hace hoy el `.table-scroll` vacío?** Medido, no razonado: **0 hijos, 0,00 px de alto**,
`display: block`, márgenes 0/0, padding 0/0, sin borde, sin `min-height`. **No deja hueco y no se
ve.** Por eso el defecto llevaba desde `bc4cf146` sin que nadie lo notara: en pantalla no había
nada que delatara que el contenido del envoltorio se había ido a otro sitio.

**③ ¿Le pasa a otras vistas? CENSO, no memoria.** Por **AST** (`acorn`, ya en el árbol; sin
dependencias nuevas, regla 36) y no por texto, que es lo que exige SCRUM-203:

| | |
|---|---|
| población: ficheros `.js` en `public/dashboard/js/` | **79** |
| con `table-scroll` | **14** |
| envoltorios con nombre resoluble | **15** |
| que acababan **vacíos** | **1** — `customersView.js` |
| sin envoltorio con nombre (marcado con la `<table>` dentro del mismo texto: no puede vaciarse) | **2** — `expensesView.js`, `homeView.js`, comprobados a mano |

**El cero de los demás sólo vale porque el barrido encuentra el que sí:** control positivo
—localiza `customersView.js`— y control negativo —declara **sanos** a los otros catorce, o sea que
sabe decir que no—. Los dos, o el cero no significa nada.

### 🔴 Y el censo se equivocó DOS veces antes de acertar

Se deja escrito porque la lección es más útil que el resultado:

| versión | qué encontró | por qué era falso |
|---|---|---|
| v1, por texto | 1 de 14 | sólo miraba `createElement("div","table-scroll")`; la casa usa también `x.className = 'table-scroll'`. **Trece clasificados sin mirar.** Lo destapó revisar seis a mano |
| v2, por texto | **9** de 15 | ocho eran de `reportsView.js`: `table` y `tableWrap` son nombres reutilizados en **cuatro ámbitos** distintos y una búsqueda por líneas los confunde |
| v3, por AST | **1** | se pregunta por **VÍNCULO** (la declaración a la que resuelve cada nombre), no por nombre |

Un «1 de 14» y un «9 de 15» habrían pasado los dos por respuesta. El primero decía «a nadie más le
pasa» sin haber mirado a trece; el segundo habría abierto ocho tickets que no existen.

## El arreglo

**Se QUITA la l. 347.** No se añade nada: el sitio bueno ya estaba escrito en la 266. No se toca
el CSS, ni el filtro, ni el orden, ni las etiquetas, ni el selector de columnas de SCRUM-584, ni
el orden visual de la tarjeta — el envoltorio ya estaba insertado justo donde iba la tabla, así
que la secuencia en pantalla es idéntica.

### El riesgo del propio arreglo, medido ANTES de proponerlo

Meter la tabla dentro **no es neutro**: activa `.table-scroll .table { min-width: 520px }`
(`styles.css:1811`), una regla que hoy no se le aplicaba por estar fuera. Con la lista llena da
igual —la tabla ya quiere 963 px—, pero **con la lista VACÍA la tabla es estrecha** y ese
`min-width` podía sacarle una barra a una pantalla que hoy no la tiene. Se midió:

| ancho | caso | ancho de la tabla | ¿muerde el `min-width: 520px`? |
|---|---|---|---|
| 769 / 800 | sin clientes | 585,86 px | **no** — el estado vacío ya pide 586 |
| 1024 / 1280 | sin clientes | 726 / 982 px | **no** |
| todos | lista llena | 962,83 px | **no** |

**No muerde en ningún caso medido.** A 769 y 800 px la lista vacía sí gana barra — porque hoy, sin
envoltorio, ese mismo contenido está **recortado**. Se cambia «cortado» por «alcanzable», que es
el contrato.

## Verificado en rojo — cuatro mutaciones, cada una con post-condición

Cada mutación guarda los **bytes** del fichero antes de tocar (SCRUM-570: en un fichero
normalizado el blob no sirve de referencia), comprueba que ha cambiado **ese** fichero y no
«alguno», corre la tanda del ticket y restaura verificando con `Buffer.compare`. El árbol queda
limpio, y se comprueba con `git status` al final.

| se rompe a propósito | fichero | cae por |
|---|---|---|
| ① se devuelve `outerCard.appendChild(table)` — el defecto original, tal cual | `customersView.js` | «la tabla cuelga de su `.table-scroll`» **y** «el `.table-scroll` no se queda vacío» |
| ② `.table-scroll` se queda sin `overflow-x` | `styles.css` | «`.table-scroll` sigue declarando `overflow-x: auto`» |
| ③ el detector del test se vuelve ciego (`fuera` devuelve siempre vacío) | el propio test | «CONTROL NEGATIVO: el detector no marca lo que está bien» |
| ④ **CONTROL NEGATIVO**: se le añade una clase de verdad a la `<table>` | `customersView.js` | **no cae** — y no debe |

La ② y la ③ son las que hacen que esto no sea un verde hueco. **②** porque meter la tabla en un
envoltorio que no scrollea no arregla nada: la recortaría igual, un nivel más adentro — las dos
mitades o ninguna. **③** porque sin el control negativo, un detector que contestara siempre «cero
fuera» pasaría los tres tests del defecto y el fichero entero sería un verde que no mira. **④**
porque si un cambio cualquiera en la vista lo tumbara, el test no estaría midiendo el carril:
estaría midiendo «que nadie toque el fichero», y caería con cada ticket que pase por aquí.

## Ficheros

`public/dashboard/js/customersView.js` (**−1 línea**, más el comentario que dice por qué no
vuelve) · `tests/scrum699-tabla-en-su-carril.test.mjs` (**nuevo**, 5 tests) · esta entrada.

**No se ha tocado:** `public/dashboard/css/styles.css` (sólo se mutó en memoria para probar el
rojo, y se restauró byte a byte) · `prisma/schema.prisma` · ningún otro fichero del panel ·
ninguna microcopy · `package.json` · sin dependencias nuevas (regla 36) · el suelo de la tanda,
`scripts/_suelo-de-la-tanda.mjs`, **no se toca**: esta rama añade tests, así que el mínimo de
`main` sigue siendo cierto (misma decisión y mismo motivo que SCRUM-697).

## Estado del árbol

* Rama nacida de `origin/main` = `1304643497934441f88950e441182b7e344dbb57`. Durante la sesión
  `origin/main` avanzó a `e87a939b` (el `.git` es compartido entre los nueve árboles, así que el
  `fetch` de otra sesión mueve la referencia para todos): **se mergeó `main` DENTRO**, sin
  reescribir historia, y **todas las mediciones de arriba se repitieron sobre el árbol mezclado**
  — el `main` nuevo trae `[hidden] { display: none !important }` (SCRUM-731) al CSS del panel, y
  una medición de maquetación contra un CSS que ya no es el de nadie no vale.
* Cero CR en disco en los ficheros tocados, **medido por BYTES** (`grep` en Git Bash miente aquí:
  daba 1339 y 172 donde `fs.readFileSync` cuenta 0).
* `npm run guards:entrada` en verde.

## 🔴 Los huecos que declaro

1. **Un navegador, una máquina, una fuente.** Todo se midió en **Edge 152** sobre Windows, con
   Inter cargada de Google Fonts (comprobado: `document.fonts.check('13.5px Inter')` da `true`).
   Los anchos exactos —963 px de contenido, umbral de 1196— **son de esa combinación**. El
   veredicto cualitativo (recorta y no hay carril) es de CSS y no depende de la fuente; los
   números sí. Por eso el umbral **no está escrito en ningún test**: un número de maquetación
   medido en una máquina no es un contrato (regla 3).
2. **No hay guard de navegador permanente.** Lo que queda vigilando es el test del banco de
   vistas, que mira el **DOM** y el **contrato CSS del envoltorio**, no los píxeles. Si alguien
   ensancha una columna hasta recortar la tabla dentro del envoltorio, este ticket no se entera —
   pero el profesional podrá llegar igual, que es lo que se venía a arreglar.
3. **La medición no pasa por el servidor real.** Se sirve `dashboard/index.html` del disco con los
   `<script>` quitados y sólo los cinco que la vista necesita, y `getCustomers` devuelve siete
   clientes de mentira. Es el marcado y el CSS de verdad, pero **no es una sesión autenticada
   contra datos reales**: no se afirma nada sobre anchos con datos de un merchant concreto.
4. **Los datos son «ordinarios» a propósito, y eso es una elección.** Nombres de empresa
   españoles, emails reales de longitud normal, una o dos etiquetas. Con nombres más largos el
   umbral de 1196 px **sube** (la tabla pide más). No se ha medido con qué cartera real empieza a
   doler antes, porque eso pide datos de producción.
5. **El test mira que la tabla cuelgue DIRECTAMENTE del envoltorio.** Si alguien la anidara un
   nivel más adentro —dentro de otro `div` dentro del `.table-scroll`— el carril seguiría
   funcionando y el test caería igual. Es deliberado: es como lo hacen las quince, y aflojarlo
   abriría la puerta a que la tabla se fuera dos niveles y nadie se enterara.
6. **Las seis vistas que no se montan en el banco** (declaradas en SCRUM-697) siguen sin medirse
   ahí. Ninguna de las seis salía en el censo AST como envoltorio vacío, pero el censo es
   **estático**: lee el código, no monta la pantalla.

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* `npm test` sobre `main` **limpio** da **1 fallo** en esta máquina: `tests/scrum176b-force-por-identidad.test.mjs:118` construye la ruta del hook con `new URL(import.meta.url).pathname` sin decodificar, y el `%20` de `C:\Users\Javier Pereira` la rompe — falla en **cualquier** checkout cuyo camino tenga un espacio, o sea en los nueve árboles de esta máquina y en ninguno del CI.
* La premisa «`node_modules` va por junction y el cliente de Prisma es global a todos los worktrees» es **falsa aquí**: `npm run topologia` sobre los nueve árboles dice que **cada uno llega a un `node_modules` distinto** — y el propio `package.json` ya lo dejó medido y fechado en SCRUM-351.
* `.table { display: block; overflow-x: auto }` (`styles.css:1762`) arregló en ≤768 px el mismo defecto de recorte que este ticket cierra en escritorio, y nadie miró si la mitad de escritorio quedaba cubierta: conviene revisar si otras vistas dependen de esa asimetría.
* El `CONNECT_TIMEOUT` de Playwright que reporta otra sesión **no es de la máquina ni de la red**: el MCP arranca en 8 s (`npx -y @playwright/mcp@latest --help`), `registry.npmjs.org` contesta en 233 ms y Edge 152 levanta bien por `puppeteer-core` — pero `%LOCALAPPDATA%\ms-playwright` **no tiene ningún navegador instalado**, sólo 43 ficheros de bloqueo `browser@…`, los cinco más recientes de **hoy** entre las 20:01 y las 20:36.
* Un navegador **no se puede lanzar desde la herramienta Bash de esta sesión** —`puppeteer.launch` muere en 0,1 s en «proceso+ws»— y sí desde PowerShell con el mismo binario y los mismos argumentos: quien escriba un guard de navegador y lo vea caer ahí, que lo pruebe por el otro shell antes de tocar el guard.
* `public/dashboard/js/customersView.js` aparece **modificado sin commitear** en el worktree `cobroflash-b3` (rama `scrum-587-descuento-por-defecto`) junto con `prisma/schema.prisma`, y el encargo de hoy decía que ese fichero era de una sola sesión: si las dos ramas lo tocan, el choque llega en el merge.
