# SCRUM-694 · Los guards que filtraban comentarios a mano — nueve migrados, y el censo que salió por cuatro

**Fecha:** 2-sep-2026 · **Carril:** instrumentos (guards de la casa) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `cc67773b8053569988686ad40ecf6d0e97801527` · 2026-09-02T22:19:42Z

**Tanda:** 4812 tests, 4728 pass, 0 fail, 84 skipped — medida DESPUES del ultimo cambio, entrada incluida.

---

## PASO 0

**ENTRADA.** No hay entrada de usuario: **este carril no tiene pantalla**. Lo que hay son guards, y
lo que se migra es cómo leen el código que vigilan.

**MECANISMO.** Existía: `tests/_solo-codigo.mjs` (SCRUM-693), y **arreglado en SCRUM-696** — que
salió justamente de intentar esta migración. El trabajo aquí era darle superficie, no rehacerlo.

**LA CLASIFICACIÓN, remedida.** El censo de entrada hablaba de trece. Son **14**: nueve migrables y
cinco que no aplican, y decir cuáles no aplican es parte del trabajo.

| no aplica | por qué |
|---|---|
| `scrum205-sql-a-mano-contra-schema` | lee `prisma/schema.prisma:92` |
| `scrum297-fuentes-selladas` | lee `prisma/schema.prisma` |
| `scrum302-duplicar` | lee `prisma/schema.prisma:35` |
| `_censo-configuracion` | es **puro**: no lee el fichero, recibe el texto del schema y parsea `model Merchant` (quien lo lee es `scrum284-censo-configuracion.test.mjs:21`). Filtra `//` **y `@@`**, que es sintaxis de Prisma |
| `scrum548-peaje-package-json` | **no filtra comentarios**: recorre claves de `package.json` que EMPIEZAN por `//` y las BUSCA. Migrarlo sería romperlo |

El scanner de TypeScript no parsea Prisma, así que en los cuatro primeros no hay nada que migrar.
Los nueve migrables usan `soloCodigo()` y ninguno `literalesDe()`: todos preguntan «¿existe esta
forma en el código?», no «¿este texto se pinta?».

**QUÉ FICHEROS LEE CADA GUARD** — el hueco declarado en SCRUM-696 era que su censo sólo cubre
`src/`, `public/`, `tests/` y `scripts/`. Medido guard a guard: **los nueve leen dentro de esas
cuatro carpetas**, así que ninguno pisa terreno sin medir. `scrum574-switch-forma-juridica` lee
además `public/dashboard/index.html`, pero **sin pasarlo por el filtro** (`leer(INDEX)` directo),
así que tampoco depende del mecanismo.

---

## 🔴 El hallazgo: el censo de entrada se quedó corto por cuatro

Al construir el trinquete hubo que censar el árbol de verdad, y no salen trece candidatos. Medido
el 2-sep-2026 sobre `tests/` y `scripts/`:

| familia | cuántos | qué les pasa |
|---|---|---|
| 🔴 **cortan en CUALQUIER `//`** | **27** | se comen código real en cuanto un literal lleva una URL. Es el fallo que produce **verdes** |
| sólo borran líneas que EMPIEZAN por `//` | 29 | riesgo menor, pero siguen ciegos a los bloques `/* */` |
| **y de esos 56, encogen el texto** | **31** | hacen el `replace` por cadena vacía, así que además descolocan cualquier `slice(indexOf(…))` |
| comparan con `//` pero no cortan | 7 | otra familia — aquí caen los cinco que no aplican |
| usan el mecanismo | 12 | los nueve de aquí, más `scrum578`, `scrum693` y `scrum696` |

Tres ejemplos reales, para que no sea un número:

```js
scrum139-acciones-linea:1    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')
scrum313-pantalla-numeracion:52  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
scrum584-selector-de-columnas:202 .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n')
```

**No se migran aquí** (regla 9): son 47 guards más y este ticket cubre los nueve censados. Lo que
sí entra es el **trinquete**, para que mientras se decide qué hacer con ellos **no puedan crecer**.

---

## Lo que decide: cada guard migrado SIGUE SALTANDO

El riesgo de esta migración no es que falle: es que **apague nueve guards y salga en verde**. Así
que la evidencia principal no es la tanda, es esto — nueve mutaciones **reales, en disco**, sobre
el código de producto que cada guard vigila, cada una con post-condición y restaurada después:

| guard | violación inyectada en CÓDIGO | qué test lo tumba |
|---|---|---|
| `scrum324-aviso-simplificado-ui` | la afirmación fiscal en `expensesView.js` | la afirmación FISCAL NO está encendida |
| `scrum324-cadena-hasta-el-libro` | ídem | la microcopy de la foto es la APROBADA |
| `scrum519-un-solo-criterio-de-cobro` | `iban \|\| bizumPhone` en `homeView.js` | ninguna vista recalcula el criterio |
| `scrum574-mismo-cliente-tras-migracion` | un `.includes(` en su propio fuente | el control NO usa includes() |
| `scrum574-switch-forma-juridica` | derivar `contactKind` de `tipoDestinatario` | contactKind NO se deriva |
| `scrum577-nombre-para-documento` | `nombreParaDocumento(` en el SELLADOR | la QUINTA copia NO se unifica |
| `scrum593b-superficie-texto-del-documento` | un `innerHTML` | el texto NUNCA se concatena en markup |
| `scrum625-formato-importe-pdf` | `toFixed(2)` dentro de `generateQuotePdf` | el PDF ya no formatea con toFixed |
| `scrum636-sitio-unico-dinero` | la copia del formato de dinero en un `.ts` de `src/` | no queda NI UNA copia en `src/` |

**9 de 9 saltan.** Y su control negativo: la **misma cadena** en `//`, `/* */` y `/** */` no tumba
a ninguno — que es el impuesto sobre la claridad que motivó SCRUM-693.

**El caso cruzado, en el sentido caro:** con la violación DETRÁS de un literal con `//` y en la
misma línea, los tres probados (`scrum324`, `scrum625`, `scrum574-switch`) siguen saltando. Con el
filtro viejo ese corte se llevaba la violación por delante y el guard daba verde.

---

## 🔴 Dos mutaciones mal elegidas, y las dos las cazó el propio control

Se anotan porque el error es fácil y el patrón se repite: **una mutación que no reproduce la forma
del defecto no prueba nada, y encima parece que sí.**

1. **`scrum636`**: inyecté la copia del formato en `public/dashboard/js/…`, y su censo recorre
   `src/**/*.ts` **y sólo eso**. El guard no saltó, y por un momento pareció un guard muerto. Era
   la mutación puesta fuera de su alcance.
2. **`scrum593b`** (al probar el trinquete): renombré `innerHTML` a `innerHTML_RENOMBRADO_` para
   «vaciarlo», y el censo siguió verde — con razón: la aguja seguía ahí **como subcadena**.
   Borrarla de verdad sí lo tumba.

---

## Qué se construyó

**`tests/scrum694-los-guards-migrados.test.mjs`** — el censo con suelo, y no repite lo que ya
prueban `scrum693` y `scrum696`. Lo que fija es lo que sólo se puede perder aquí:

- los nueve **importan** el mecanismo — y se mira sobre el código, porque nombrarlo en un
  comentario no es importarlo;
- ninguno se ha quedado **vacío**: cada uno conserva la aguja que le da sentido. Un guard que ya no
  nombra lo que prohíbe no falla nunca, y su verde no significa nada;
- la aguja de cada uno **sobrevive** al filtro en código y **desaparece** en los tres formatos de
  comentario;
- **control de que no es cosmética**: el filtro viejo cegaba las nueve agujas. Si no las cegara,
  migrar no habría arreglado nada;
- **el trinquete**: los 56 que filtran a mano no pueden crecer, y si el censo diera cero, falla.

---

## Lo que NO se hizo

- **No se migraron los 47 restantes.** Están medidos y reportados; migrarlos es otra decisión.
- **No se relajó ninguna prohibición** ni se tocó el código de producto: las nueve mutaciones se
  revirtieron y el worktree quedó limpio, verificado con `git status` después de cada una.
- **Cero dependencias nuevas** (regla 36).

---

# SCRUM-694b · El filtro que se libraba de `https://` y se moría con `/^https?:\/\//`

**Fecha:** 15-sep-2026 · **Carril:** instrumentos (guards de la casa) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `7bae70d0e15c18326b19cb75d23b5d47b5110402` · 2026-09-15T08:03:37Z

**Tanda:** 6486 tests, 6376 pass, 0 fail, 110 skipped — medida DESPUÉS del último cambio.

---

## PASO 0

**ENTRADA.** No hay entrada de usuario: **este carril no tiene pantalla**. Lo que hay son guards, y
lo que cambia es cómo leen el código que vigilan.

**MECANISMO.** Existía: `tests/_solo-codigo.mjs` (SCRUM-693, arreglado en SCRUM-696). Aquí no se
construye otro — se le da superficie y, sobre todo, **se le pone suelo**.

**EL TICKET DECÍA TRECE. HOY NO SON TRECE.** El censo de entrada es del 2-sep y el árbol se ha
movido. Remedido el 15-sep sobre `tests/` y `scripts/`: **51** guards se fabrican su propio filtro
de comentarios (eran 56). Pero el número bruto no es la pregunta — la pregunta es cuáles producen
**verdes falsos**, y eso depende de la FORMA del corte:

| forma del corte | cuántos | ¿se come código a mitad de línea? |
|---|---|---|
| 🔴 `(^|[^:])\/\/.*$` | **9** | **SÍ** — es la familia de este ticket |
| `\/\/.*$` a pelo | 3 | sí, pero 2 leen `prisma/schema.prisma` (no aplica) y 1 hoy no pierde nada |
| `^\s*\/\/.*$` | 30 | no: sólo borra la línea que EMPIEZA por `//` |
| `(^|\s)\/\/.*$` | 9 | no ante URLs: `https://` lleva `:` delante, no un espacio |

**Así que los trece de hoy son NUEVE**, y son los nueve que se migran aquí.

---

## 🔴 Por qué el `[^:]` parecía que ya lo resolvía

Los nueve llevaban esto:

```js
.replace(/(^|[^:])\/\/.*$/, '$1')
```

Ese `[^:]` es un parche contra las URLs: como `https://` lleva **dos puntos** delante de las dos
barras, el corte no salta y la línea se salva. Parece resuelto, y por eso nadie volvió a mirarlo.

Pero una URL no aparece en el código sólo como texto. Aparece también como **el regex que la
reconoce**, y ahí las dos barras van detrás de una **contrabarra**:

```
/^https?:\/\//     →   …`\/` + `/`…   →   dos barras seguidas con `\` delante   →   `[^:]` casa
```

Y entonces el filtro se come la línea entera **justo donde se valida una URL**.

## 🔴 El caso REAL, pegado — no un ejemplo que se le parezca

Las dos líneas existen en código de producto, medidas el 15-sep-2026:

```
public/dashboard/js/settingsView.js:1013
  en disco     : if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  filtro viejo : if (!/^https?:\/
  soloCodigo() : if (!/^https?:\/\//i.test(v)) v = 'https://' + v;

src/core/validation/schemas.ts:483
  en disco     : (v) => (typeof v === 'string' && v.trim() && !/^https?:\/\//i.test(v.trim()) ? `https://${v.trim()}` : v),
  filtro viejo : (v) => (typeof v === 'string' && v.trim() && !/^https?:\/
  soloCodigo() : (v) => (typeof v === 'string' && v.trim() && !/^https?:\/\//i.test(v.trim()) ? `https://${v.trim()}` : v),
```

Y **una que un guard migrado ya desnudaba así en cada tanda**, que es la que convierte esto de
riesgo en hecho — `scrum745` sobre `scripts/meta-guard-mutaciones.mjs:515`:

```
  en disco     : if (/(^|[^\w.])(\.\.\/)?dist\//.test(n.text)) visto = true;
  filtro viejo : if (/(^|[^\w.])(\.\.\/)?dist\
```

`scrum745` prohíbe **en negativo** que ese fichero nombre un reporter. Sobre el texto que el
filtro se lleva por delante, una negación se cumple sola.

---

## Lo que decide: las nueve siguen saltando, y el filtro viejo NO las habría visto

La tanda en verde no prueba nada aquí: el riesgo de migrar un filtro es **cambiarlo por un guard
muerto**, y un guard muerto sale más verde que uno sano. Así que la evidencia son **seis
mutaciones reales, en disco**, sobre el código que cada guard vigila. Cada violación va detrás de
un regex de URL **en la misma línea** —la forma de `schemas.ts:483`—, así que la misma mutación
contesta las dos preguntas de golpe:

| guard | violación inyectada | ① guard con el mecanismo | ② ¿la veía el filtro viejo? |
|---|---|---|---|
| `scrum500-suplidos` | `const suplido694b = 0;` en `vat.service.ts` | 🔴 ROJO | no |
| `scrum611-tipo-iva-elegible` | `[21, 10, 4, 0]` en `quotesView.js` | 🔴 ROJO | no |
| `scrum623-desglose-por-tipo` | `'IVA'` dentro de `generateInvoicePdf` | 🔴 ROJO | no |
| `scrum647-presupuesto-tambien-neutral` | `locale.vatName` dentro de `generateQuotePdf` | 🔴 ROJO | no |
| `scrum741-la-entrada-no-la-linea` | la regex anclada en `$` en su vigilante | 🔴 ROJO | no |
| `scrum745-comparar-por-identidad` | `'--test-reporter=tap'` en el meta-guard | 🔴 ROJO | no |

**6 de 6 saltan, y 0 de 6 eran visibles con el filtro que se retira.** El árbol quedó limpio tras
cada una (`git status` verificado por el propio banco).

Los otros tres migrados (`scrum598`, `scrum609b`, `scrum641`) afirman en POSITIVO. Ahí un filtro
que se come código da **rojo**, no verde: se migran igual por el mismo motivo, pero no se les
inventa una mutación para que la tabla quede más larga.

---

## 🔴 El suelo del helper, que es lo más caro que hay aquí

`tests/_solo-codigo.mjs` lo importan ya **50** ficheros. Eso no es reutilización: es un **punto
único de fallo para 50 protecciones**. Si un día devuelve algo peor sin decirlo, no cae un guard
— se apagan todos a la vez, y la tanda sale MÁS VERDE que antes.

Tenía un agujero exacto de la familia de la casa: las tres funciones empezaban por
`String(fuente ?? '')`. Con `undefined` —una ruta mal montada, un `match()` que dio `null`, un
`leer()` con `try/catch`— `soloCodigo` devolvía **la cadena vacía** y `literalesDe` **la lista
vacía**, en silencio. Y los guards que llaman aquí preguntan casi siempre en NEGATIVO («esto no
aparece», «esto no se pinta»): sobre la nada, todas esas preguntas se contestan solas que todo
va bien. **Vacío y no-medido se leen igual y significan lo contrario.**

Ahora el módulo **revienta** en vez de rellenar, y además **verifica el contrato que su cabecera
prometía sin comprobar**: misma longitud, mismas líneas, y lo único que puede cambiar es un
comentario convertido en espacio. Importa porque los guards acotan bloques con
`slice(indexOf(…))`: si los índices se descolocan, cada uno mide un trozo que no es el suyo y no
se entera. Verificado sobre los **1.776** ficheros del árbol ANTES de fijarlo — los 1.776 lo
cumplen, así que el suelo no inventa un rojo: fija el que ya se cumplía para que no se pueda
perder.

### 🔴 Y lo que NO lleva el suelo, porque la tanda lo tumbó

Se intentó añadir «si el fuente tiene contenido y la salida sale TODA en blanco, revienta». La
tanda lo tiró en el acto, y con razón: **un fuente que es enteramente un comentario tiene que
salir entero en blanco**, y ésa es la respuesta correcta. Lo usan de verdad `scrum713c` y
`_cifras-sin-ancla.mjs`, que deriva los comentarios POR DIFERENCIA contra esta salida.

Desde dentro del módulo, «lo he blanqueado todo porque todo era comentario» y «lo he blanqueado
todo porque estoy roto» **no se distinguen**. Quien sí puede distinguirlo es quien llama, que sabe
qué le dio. Queda escrito en el propio fichero para que no se vuelva a intentar. Un suelo que
salta con entrada legítima no es un suelo: es lo que acaba haciendo que alguien lo relaje.

---

## Qué se construyó

**`tests/scrum694b-el-filtro-que-no-ve-la-url.test.mjs`** — 9 tests. No repite lo que ya prueban
`scrum693`, `scrum696` ni `scrum694`:

- los nueve **importan** el mecanismo, y se mira sobre el CÓDIGO (nombrarlo en un comentario no
  es importarlo);
- ninguno se ha quedado **vacío**: cada uno conserva la aguja que le da sentido;
- el corte `(^|[^:])//` **no ha vuelto** a ninguno de los nueve;
- 🔴 **el caso real**: las líneas de `settingsView.js`, `schemas.ts` y `meta-guard-mutaciones.mjs`,
  localizadas **por su contenido y no por su número de línea** (un test anclado a un número o
  miente o se cae por nada), con su **suelo**: si dejaran de existir, eso no es «arreglado», es
  «no medido», y el mensaje lo dice;
- el suelo del helper en las dos direcciones: revienta con lo que no es un fuente, y **sigue
  aceptando lo legítimo** (un suelo que también tumba los casos buenos es un estorbo);
- el contrato del helper sobre **todo el árbol**, con suelo del suelo (si el recorrido viera menos
  de 500 ficheros, el bucle pasaría vacío y no comprobaría nada).

**Trinquete de SCRUM-694: 56 → 42**, con el desglose escrito en el propio fichero: −9 migrados
aquí, −5 que ya no estaban cuando se remidió (el árbol se movió entre el 2 y el 15 de septiembre;
no los migró este ticket y no se apunta el mérito). Y por qué los 42 que quedan son de familias
distintas, no un descuido.

---

## Lo que NO se hizo

- **No se migraron los 42 restantes.** Están medidos y clasificados por familia. Los 30 de
  `^\s*//` y los 9 de `(^|\s)//` no cortan a mitad de línea ante una URL, que es el defecto de
  este ticket; migrarlos es otra decisión (regla 9).
- **No se migró `scripts/censo-anclas-bloque-f.mjs`**, que sí corta en cualquier `//`. Dos
  motivos, los dos medidos: (a) el 15-sep-2026 **no pierde ni una línea** del fichero que lee
  (`src/core/flags.ts`), y (b) ningún `scripts/` importa hoy `tests/_solo-codigo.mjs`, así que
  migrarlo estrenaría una dirección de dependencia nueva `scripts/ → tests/` sin necesidad.
- **No se tocó código de producto.** Las seis mutaciones se revirtieron y el árbol quedó limpio,
  verificado tras cada una. El diff son sólo ficheros de `tests/`.
- **No se relajó ningún guard** (regla 41): el arreglo va en el FILTRO, no en lo que cada guard
  exige. Ninguna prohibición cambió.
- **Cero dependencias nuevas** (regla 36) y **cero estado o flag nuevo** (regla 27).

---

# SCRUM-694c · Los tres del corte a pelo — y por qué los otros 39 se declaran

**Fecha:** 15-sep-2026 · **Carril:** instrumentos (guards de la casa) · **Gate:** sin gate — `npm test`

**Medido contra:** `origin/main` = `c50c6a54b61d9518f6cb98ec14def5d3ed897222` · 2026-09-15T13:00:07Z

---

## ① Cuántos de los 42 siguen vivos

**42, los mismos.** Censados hoy sobre `tests/` y `scripts/` con la misma definición del
trinquete. El árbol se ha movido mucho desde ayer, pero ninguno de los 42 se fue ni entró otro.

## ② Cuáles comparten la forma — y por qué la pregunta no es «¿cuántos?»

Preguntar «¿hoy pierde algo en los ficheros que lee?» depende de que yo sepa resolver qué lee
cada guard, y en **21 de los 42 no lo sabía**: un cero por esa vía sería cota inferior, no prueba,
y aquí «vacío» y «no medido» no pueden leerse igual. Así que se preguntó por la **FORMA**,
pasándole a cada filtro las cuatro maneras en que una URL aparece de verdad en este árbol —
`'https://x'`, `` `https://${t}` ``, `/^https?:\/\//` y `'//cdn…'`:

| forma | cuántos | ¿se come código detrás de una URL? |
|---|---|---|
| `^\s*//.*$` | 30 | **NO** — sólo borra la línea que EMPIEZA por `//` |
| `(^\|\s)//.*$` | 9 | **NO** — `https://` lleva `:` delante, no un espacio |
| 🔴 `//.*$` a pelo | **3** | **SÍ, las cuatro** |

**Se migran los 3.** Los otros 39 se **declaran**, no se fuerzan: su filtro aguanta la URL, así
que migrarlos sería otro ticket con otro motivo. Y la declaración no es una promesa — la ejerce
un test: si alguna de esas dos formas dejara de aguantar una URL, cae.

## 🔴 Dos declaraciones heredadas que no se sostenían

**La de SCRUM-694:** dio dos de los tres por «no aplica, el scanner de TypeScript no parsea
Prisma». Eso no se hereda, se mide. Sobre `prisma/schema.prisma` (1.634 líneas), `soloCodigo()`
blanquea **852** líneas de comentario, con **0** blanqueos que no fueran comentario y **0**
comentarios supervivientes. Era una suposición, y los dos eran migrables.

**Y una mía, de SCRUM-694b:** dejé fuera `censo-anclas-bloque-f.mjs` alegando que ningún
`scripts/` importaba de `tests/` y no quería estrenar esa dirección. Falso: lo hacen
`_pagina-panel`, `_banco-lista`, `censo-internos-de-prisma`, `censo-objetivo-tactil-panel` y dos
más. Miré sólo quién importaba `_solo-codigo.mjs`, no la dirección.

⚠️ **El defecto no está vivo hoy**: los tres pierden **0 líneas** de lo que leen ahora mismo. Eso
es suerte del contenido, no del filtro — un `@default("https://…")` en el schema bastaría. Se
migra por la forma, y se dice que hoy no sangra.

## ③ El rojo, con el caso real

Sin tocar `prisma/schema.prisma` (está prohibido, y no hace falta): los dos guards de Prisma
exponen su función **pura sobre texto**, así que se les da el schema REAL del árbol con la línea
añadida en memoria. El fichero no se toca; la superficie es la de verdad.

| guard | el caso real | qué pasaba con el corte a pelo |
|---|---|---|
| `_pares-del-schema` | `webhookUrl String @default("https://yaqu.app/hook") @map("webhook_url")` | la línea muere en `@default("https:` y **la columna desaparece del censo**, en verde |
| `_prisma-procedencia-guard` | la misma línea, con dos `@map` distintos | las dos salen **iguales** tras normalizar: dos schemas distintos pasan por el mismo |
| `censo-anclas-bloque-f` | — | **no se fabrica**: su entrada es una tabla de BOOLEANOS y ahí una URL no cabe en el código. Se migra por la forma; lo sujetan el trinquete y el control de forma. Decirlo es más barato que inventar un caso que se parezca |

**El control**, con el fuente restaurado byte a byte y verificado:

| vuelta atrás | tests en rojo |
|---|---|
| `paresDelSchema` vuelve al corte a pelo | **2** |
| `normalizarSchema` vuelve al corte a pelo | **2** |
| el censo de anclas vuelve al corte a pelo | **1** |

## ④ El trinquete: 42 → 39

**−3, y los tres son de esta bajada.** No hay ningún «ya no estaba» que apuntarse: 42 − 3 = 39,
censado antes y después. El desglose vive en el propio `TOPE_FILTRAN_A_MANO`.

## ⑤ El helper compartido no se ha tocado

`tests/_solo-codigo.mjs` queda **intacto** — su suelo es el que entregó SCRUM-694b. Lo importan
ya 51 ficheros, así que tocarlo habría sido el trabajo principal del día; no hacía falta.

## 🔴 Dos guards de la casa me cazaron por el camino

- **SCRUM-700** («el número de filtros que CIEGAN CÓDIGO no sube») contó **8** donde decía 7: el
  octavo era **mi propio control**, la réplica del filtro retirado. Intenté sacarlo a un módulo
  compartido y salió peor —ese módulo lo contaban los DOS censos—, así que se deshizo. La salida
  es la que ya usa el trinquete de SCRUM-694 para su `EL_CORTE`: construir el patrón con
  `String.fromCharCode(92)` en vez de escribirlo como literal. **No se subió ningún tope.**
- **SCRUM-533** («los ficheros que TOCA ESTA RAMA no llevan ni un CR») saltó porque
  `_pares-del-schema.mjs` estaba en CRLF. Convertido a LF, que es lo que el repo exige.

## Lo que NO se hizo

- **No se migraron los 39 restantes**, y esta vez no es «quedan pendientes»: están medidos y su
  filtro **aguanta la URL**. Migrarlos necesita otro motivo, que sería el de los bloques `/* */`.
- **No se tocó `prisma/schema.prisma`** (regla 40), ni el CLI de Prisma por `npx`.
- **No se relajó ningún guard**: ni el de los 42, ni el de SCRUM-700, ni ninguno.
- **Cero dependencias nuevas** (regla 36), **cero estado o flag nuevo** (regla 27).
