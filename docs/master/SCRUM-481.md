# SCRUM-481 · La columna MÉTODO habla el mismo idioma que el filtro de al lado

**Medido contra:** `origin/main` = `3be9a2eaceacdf0f93b340aaf64f6e74c79ac872` · 2026-08-12T12:20:00+01:00

**Y con `origin/scrum-474-fase2-filtro` = `037ff52a` mergeada dentro**, que es el contrato de debajo
que cambió a mitad del ticket. El ancla de arriba va sola en su línea a propósito: partirla para
meter esta segunda referencia es lo que tumbó el guard de SCRUM-267 (abajo, en la corrección propia).

> 🔴 **TERCERA MEDICIÓN, y el motivo es que esta rama lleva días sin poder entrar.** Cada vez que se
> intenta mergear, `main` se ha vuelto a mover — **cinco veces solo el 12-ago**. Los números de abajo
> están rehechos contra `3be9a2ea`, que ya trae dentro SCRUM-441, 467, 483, 485, 486 y 489. La
> resolución de la columna MÉTODO **no ha cambiado**: es la misma desde que entró la fase 2 del
> filtro, y este merge de `main` ya **no la vuelve a plantear** —la base de merge la incluye—, así
> que el conflicto que renacía está cerrado de raíz y no por repetir la resolución a mano.

**12-ago-2026** · **Carril:** Cobros · **Gate:** sin gate, corre en `npm test`

> ⚠️ **ESTE DOCUMENTO SE REESCRIBIÓ DOS VECES EN EL MISMO DÍA, y las dos por algo que cambió
> DEBAJO.** La primera versión midió contra `9286f5b5` y dejó los dos Bizum indistinguibles a la
> espera de que alguien aprobara la grafía. Luego llegaron las dos cosas: la **microcopy aprobada**
> (`Bizum · automático` / `Bizum · manual`) y la **fase 2 de SCRUM-474**, que se llevó al servidor
> quién decide los cubos. Los números de la primera versión describían un árbol que ya no existe y
> **están rehechos enteros**, no restados de cabeza.

## Las tres preguntas del contrato nuevo, contestadas con la línea delante

**1 · ¿Se usan `COBROS_METODOS` y `cuboDeMetodo`? SÍ — se quedan.** No como la lista de cubos que
la fase 2 se llevó (eso ya no lo hacen: la barra se pinta con `window.appCobrosCubos`), sino en tres
sitios de LECTURA, todos medidos:

| dónde | línea | para qué |
|---|---|---|
| `cuboDeMetodo` | `cobrosView.js:172-173` | suelo de la clave si la fila llega **sin `metodoCubo`** |
| `rotuloDeMetodo` | `cobrosView.js:289-290` | suelo de la **grafía** si el arranque no trajo cubos |
| `casa` | `tests/scrum474-dos-copias-atadas.test.mjs:52` | lo que ata la lista a `PAID_VIA`. **Borrarla apaga ese guard** |

**2 · ¿Sigue valiendo 2 el trinquete? SÍ, medido, y ni ha bajado ni ha subido.** Corrido el
detector del propio trinquete sobre el árbol fusionado —**autoprobado primero** sobre fuente
sintética: ve una partición y discrimina la que no lo es—, **356 ficheros barridos**:

```
src/modules/billing/domain/metodoDeCobro.ts:37   partirMetodo()
public/dashboard/js/cobrosView.js:156            metodoSinPasarela()
COPIAS_DE_LA_PARTICION medidas = 2
```

`cuboDeCobro`, la función nueva del servidor, **no parte por «:»**: delega en `metodoParaAgrupar`,
que delega en `partirMetodo`. Por eso el número no se mueve. Y `pasarelaDeMetodo` tampoco parte —
probado por mutación: escribiéndole un `indexOf(':')` a mano, **el trinquete salta** (abajo).

**3 · ¿Sigue siendo cierta «filtrar por cuatro, leer los cinco»? AHORA SÍ, y antes de este commit
NO.** Es la frase de `COBROS_METODOS` y describe un mecanismo: la distinción `bizum_auto` /
`bizum_manual` no se filtra, **se lee en la fila**. La primera versión de este ticket la dejó falsa
—los dos se leían «Bizum»— y lo declaró como coste a decidir. Con la microcopy aprobada la fila
vuelve a distinguirlos, así que la frase describe otra vez algo que existe. El comentario está
reescrito para que se vea de dónde le viene la verdad.

**Lo que NO se rompió, comprobado y no supuesto:** `metodoEtiqueta` y `cuboYEtiqueta` tienen **cero
apariciones** en todo el árbol (`grep`), y este ticket nunca se apoyó en ellos ni en la forma
`{ cobros, cubos }` — su banco sirve un **array pelado**, que es lo que la fase 2 restauró.

## PASO 0

* `git worktree list`: **cuatro** — aquí, `b1` (scrum-360), `b2` (scrum-477), `b3` (scrum-475).
* `git fetch origin main:main` **(sesión del 12-ago, mañana)**: **`917bf2c7` → `1117b313`**. Con lo
  de la noche, `main` se ha movido **cinco veces** en este ticket.
* **La rama ajena que entra**: se anunció `scrum-474-fase2-filtro` = `8a8d956a`, pero la punta ya era
  **`037ff52a`** (Luis, 12-ago 10:25 +0200) — un commit de `docs(master)` por encima, sin código. Se
  mergea la punta y **se declara la diferencia** en vez de mergear un sha que ya no era la rama.
* `git branch -r --contains` del commit de este ticket: **solo la rama propia**. Nadie más lo tiene.
* **Búsqueda por CONTENIDO además de por número**, y el filtro estrecho es el que vale: de las
  **225** ramas remotas, las únicas NO mergeadas que tocan `public/dashboard/js/cobrosView.js` son
  **la mía** y **`scrum-474-filtro-cobros` (`79248b55`, Luis, 11-ago 20:44 +0200)** — y ésta es un
  **subconjunto estricto de `main`** (`git diff` contra `main`: 1 añadida / 24 borradas, o sea le
  falta trabajo que ya está dentro). Es la rama superada por `scrum-474-filtro-cobros-al-dia`, que
  sí se mergeó. **Nadie está haciendo esto.**
  > 🔸 El grep ancho por la microcopy (`tarjeta · `, `· Stripe`) dio **56 refs** y **no es señal**:
  > el `·` se usa como separador en medio repo. Se dice para que nadie lo repita creyendo que mide.
* `docs/master/SCRUM-481.md` no existía en ninguna rama (`--diff-filter=A` sobre toda la historia).

## El defecto, y por qué se ve AHORA

La columna pintaba `c.metodo` **tal cual**: `card:stripe`, `card`, `transfer`. Tres centímetros más
arriba las pestañas decían «Bizum · tarjeta · transferencia · efectivo · Método no registrado».

**El agravante nació con SCRUM-474.** Antes el filtro también fallaba, así que la incoherencia no se
veía; arreglado el filtro, el profesional pulsa «tarjeta» y las filas que le salen dicen `card`.
**Arreglar una mitad destapó la otra.**

## 🔴 PASO 1 · LA CAJA, RE-MEDIDA EN NAVEGADOR — y 21 no era el máximo

Medido el **12-ago-2026 sobre el árbol fusionado**, con `dashboard/index.html` **servido desde el
disco**, el CSS del árbol y **`renderCobrosView` del producto en su contenedor real**
(`#view-container`) — no una copia del marcado. Cuatro suelos antes de dar un número: el CSS se
aplicó (`borderCollapse: collapse`), las seis cabeceras son las de `COBROS_COPY`, «Método» es la
4.ª, y las 8 filas del corpus se pintan. Los cuatro en verde en las cuatro anchuras.

**El corpus lleva delante el peor caso, y el peor caso no es el que decía el encargo:**

| entrada | rótulo | largo |
|---|---|---|
| `transfer:mercadopago` | **transferencia · MercadoPago** | **27** ← el techo real |
| `card:mercadopago` | tarjeta · MercadoPago | 21 |
| `null` | Método no registrado | 20 |
| `bizum_auto` | **Bizum · automático** | 18 |
| `card:stripe` | tarjeta · Stripe | 16 |
| `bizum_manual` | **Bizum · manual** | 14 |

> 🔴 **La primera medición tomó 21 por máximo, y era el máximo DE LA TARJETA.** La pasarela vale
> para cualquier método —`tests/scrum474-filtro-cobros-un-cubo.test.mjs` ejercita
> `transfer:mercadopago` como caso legítimo— así que el techo componible son **27**. Se volvió a
> medir con ése delante. **No lo obligan los dos Bizum** (18 y 14, por debajo de 21): ya estaba ahí
> desde la primera versión, sin que nadie lo hubiera medido.

| ancho de ventana | ancho real | columna MÉTODO | ¿se corta alguna celda? | página | `.table-scroll` |
|---|---|---|---|---|---|
| **320 px** | 305 | **OCULTA** (`display:none`) | — | sin scroll | 279/279 · cabe |
| **390 px** | 375 | **OCULTA** (`display:none`) | — | sin scroll | 349/349 · cabe |
| **641 px** | 641 | **198 px** | **no, ninguna** | 641/641 · sin scroll | 615/615 · cabe |
| **768 px** | 768 | **198 px** | **no, ninguna** | 768/768 · sin scroll | 742/742 · cabe |

**El rótulo más largo posible cabe entero a 641 px**, que es la anchura mínima en la que la columna
existe: `.col-hide-mobile` es `display: none` a `max-width: 640px` (decisión de SCRUM-285 — en la
card no hay cabecera que explique un `transfer` suelto). A 320 y 390 px se comprobó que la columna
**no se pinta y las 8 filas siguen ahí**: nada desaparece, solo se esconde una columna.

### 🔴 Y LA COLUMNA NO CRECE POR ESTE CAMBIO — medido aislando la causa

La pregunta del encargo era si los dos Bizum obligan a ensanchar. Se mide con **el mismo corpus y
la misma pantalla**, quitando y poniendo `COBROS_MATICES` en caliente:

| | rótulos de Bizum | ancho de la columna |
|---|---|---|
| **sin matices** (como antes) | «Bizum», «Bizum» | **198 px** |
| **con matices** (aprobados) | «Bizum · automático», «Bizum · manual» | **198 px** |

**Idéntico.** La columna la fija el rótulo de 27, no los de 18 y 14. Ningún corte y ningún scroll en
los dos casos.

> 🔸 Los 26 errores de consola del banco son **un único sondeo a `/version` cada 5 s** que el
> servidor de un solo uso no sirve. Nada de la vista. Se dice para que el número no se lea como
> «la pantalla petaba».

> 🔸 **Dos precisiones sobre la premisa original.** «El más largo que YA se pinta hoy» —«Método no
> registrado», 20— **no se pintaba en la columna**: era el rótulo de la **pestaña**. En la columna,
> el «no consta» decía «No registrado» (13). Y el más largo que sí se pintaba era el valor crudo
> `card:mercadopago` (16). Los dos números del encargo eran de sitios distintos.

## Lo construido — el rótulo se DERIVA, no se traduce

`rotuloDeMetodo(metodo, cubo, cubos)` **consume lo que manda el servidor**: `c.metodoCubo` —la clave
que decidió `cuboDeCobro`, y **contra la que compara el filtro**— y `window.appCobrosCubos`, los
rótulos derivados de `PAID_VIA` que llegan en el arranque. **Columna y pestaña no pueden discrepar
porque no se parecen: son el mismo dato.** No hay tabla de traducción de métodos.

| entrada | rótulo |
|---|---|
| `card:stripe` | **tarjeta · Stripe** |
| `card:mercadopago` | **tarjeta · MercadoPago** |
| `card` | **tarjeta** |
| `bizum_auto` | **Bizum · automático** |
| `bizum_manual` | **Bizum · manual** |
| `transfer:revolut` (pasarela sin grafía aprobada) | **transferencia** |
| `card:` · `bank` · `mp` · `null` · `42` · `card:constructor` | **Método no registrado** |

### 🔸 El suelo local, y por qué NO es «la lista a mano por la puerta de atrás»

Si el arranque no trajo cubos (`/admin/me` viejo o caído) o la fila llega **sin `metodoCubo`**
—respuesta que el Service Worker guardó antes del despliegue— se cae a `cuboDeMetodo` y
`COBROS_METODOS`. **La barra de filtros hace lo contrario a propósito** (sin cubos, solo «Todos») y
allí es la decisión correcta: una opción sin confirmar ofrece filtrar por algo que quizá no existe.

**Aquí no se ofrece nada: se describe un dato que el servidor YA mandó.** Sin suelo, los 51 cobros
con método conocido se leerían «Método no registrado» — decirle al profesional que no consta cómo
entró su dinero, que es justo la mentira que ese cubo existe para no contar. Y hay test que ata los
dos caminos: **el rótulo del servidor y el del suelo tienen que decir lo mismo**, o con arranque
diría una cosa y sin arranque otra.

### 🔴 El trinquete sigue en 2, y no por suerte

`COPIAS_DE_LA_PARTICION = 2` **no sube, y tampoco ha bajado** (medición completa arriba, en las tres
preguntas). `pasarelaDeMetodo` **no parte por «:»**: le pide la cabeza a `metodoSinPasarela` —la
copia declarada— y se queda con lo que sobra detrás (`limpio.slice(base.length + 1)`). No contiene el
literal `':'` en ninguna parte: **si mañana cambia la partición, cambia en un sitio y esto la sigue
sin enterarse.** Es lo que pide el mensaje del propio trinquete —«casi siempre puede llamar a una de
las dos»—, no un rodeo para esquivarlo.

**Interrogado, no supuesto.** El detector de SCRUM-474, sobre el árbol fusionado:

| función | ¿parte por `:`? | ¿toma la cabeza? | ¿la cuenta el trinquete? |
|---|---|---|---|
| `partirMetodo` (servidor) | sí | sí | **SÍ** (declarada) |
| `metodoSinPasarela` (navegador) | sí | sí | **SÍ** (declarada, sigue ahí) |
| `pasarelaDeMetodo` | **no** | sí | no |
| `cuboDeCobro` (nueva, del servidor) | **no** — delega en `partirMetodo` | no | no |
| `rotuloDeMetodo` · `cuboDeMetodo` | no | no | no |

Y **probado por mutación**: escribiendo a mano un `indexOf(':')` dentro de `pasarelaDeMetodo`, **el
trinquete de SCRUM-474 salta**. No se ha relajado ni tocado.

### 🔸 Un defecto encontrado en el código YA MERGEADO, y arreglado aquí

`card:constructor` se leía **«tarjeta · function Object() { [native code] }»**. `COBROS_PASARELAS[
clave]` devuelve lo heredado del prototipo, que es truthy, y se concatenaba tal cual. No puede
llegar de un escritor nuestro —`esMetodoValido` lo rechaza— pero **la columna pinta lo que venga en
el payload**, y una celda de dinero no se pone a enseñar fontanería de JavaScript. `grafiaAprobada`
exige propiedad **propia** y de tipo cadena; el corpus del test lleva `constructor`, `__proto__` y
`toString`.

### La pasarela: conjunto ABIERTO, grafía aprobada

`COBROS_PASARELAS = { stripe: 'Stripe', mercadopago: 'MercadoPago' }`. **No es la partición ni una
tabla de métodos**: el conjunto de pasarelas es abierto a propósito (`metodoDeCobro.ts`: «inventarlo
cerraría la puerta a la siguiente»).

Una pasarela que no esté ahí **se pinta solo con su método**. Capitalizar por las bravas daría
«Mercadopago», que no es como se escribe la marca; y pintarla cruda sería el defecto de este ticket.
🔸 **La tercera pasarela necesita que se apruebe su grafía, no código nuevo.**

## Verificación

* **CONTROL POSITIVO** — `card:stripe` → «tarjeta · Stripe» y `card` → «tarjeta», **y los dos caen
  bajo la misma pestaña**. Ejercido también sobre la pantalla pintada.
* **🔴 LOS DOS BIZUM** — «Bizum · automático» y «Bizum · manual», **distintos entre sí y en el mismo
  cubo**, comprobado en la función y en la pantalla pintada. Y un guard que **sobrevive al ticket**:
  dos métodos del mismo cubo no pueden leerse igual, así que si `PAID_VIA` estrena un `bizum_x` sin
  grafía aprobada, sale en rojo en vez de colapsar en silencio.
* **Derivado, no a mano** — el corpus sale de `COBROS_METODOS` × `COBROS_PASARELAS` ×
  `COBROS_MATICES`. Si mañana nace un método, entra solo o el test se cae.
* **🔴 CONTROL NEGATIVO, y protege el dinero** — `bank`, `mp`, `bizum`, `desconocido`, `SCTinst`,
  `card:`, `''`, `null`, `42`: todos «Método no registrado», ninguno se cuela en otro cubo, y **las
  cuatro filas siguen pintadas**. Un cobro que desaparece de una pantalla de dinero es peor que uno
  mal etiquetado.
* **Nunca «tarjeta · » colgando** — sobre 21 entradas: ni separador suelto, ni cadena vacía, ni un
  «:» del valor de la base dentro del rótulo, ni fontanería del prototipo.
* **SUELO ①** — sin cubos del arranque, la columna **sigue en castellano** (medido en la pantalla).
* **SUELO ②** — una fila **sin `metodoCubo`** (Service Worker viejo) se lee igual de bien.
* **SUELO ③** — si el cubo no tiene rótulo **en ningún sitio**, sale «Método no registrado». Ni
  cadena vacía ni valor crudo «por si acaso».
* **LA CAJA, ATADA** — un test exige que el rótulo más largo sea **exactamente los 27 caracteres que
  se llevaron al navegador**: ni más (habría que re-medir) ni menos (el corpus habría dejado de
  ejercer el caso que se midió).

### 🔴 EL ROJO POR MECANISMO (6, restaurando entre cada una, sobre el árbol fusionado)

| mutación | resultado |
|---|---|
| volver a pintar el valor **crudo** (`c.metodo \|\| 'No registrado'`) | **7 rojos**, uno diciendo *«LA PANTALLA LE ESTÁ ENSEÑANDO EL VALOR DE LA BASE DE DATOS AL PROFESIONAL»* con su línea |
| **colapsar los dos Bizum** otra vez en «Bizum» | **6 rojos**, incluido el de SCRUM-285 endurecido |
| quitar el **suelo del rótulo** (solo vale el arranque) | **3 rojos** |
| **ignorar el cubo del servidor** y recalcularlo en la vista | **1 rojo** |
| coger la grafía del **prototipo** (sin `hasOwnProperty`) | **1 rojo** |
| `pasarelaDeMetodo` **parte por «:»** a mano (tercera copia) | **1 rojo**, y lo da el trinquete de SCRUM-474 |

> 🔴 **Y el script de mutación se autoprueba.** Comprueba primero que la tanda está **verde sin
> mutar** —si la base ya está roja, ningún rojo de abajo significa nada— y, cuando un patrón no casa,
> **lo DICE y no lo cuenta como verde**. Pasó de verdad: tres mutaciones multilínea no casaban por
> los saltos CRLF del fichero, el script las declaró no aplicadas, y se rehicieron. Un «6 de 6» ahí
> habría sido mentira.

**La segunda no salía a la primera.** Esa rama es defensiva y hoy no la alcanza nadie —todos los
cubos tienen rótulo—, así que «si no sé el rótulo, enseña el valor de la base» pasaba en verde. Se
**provoca** la condición contra la que defiende (se le quita el rótulo a un cubo y se restaura en
`finally`) en vez de declararla imposible. Un suelo que solo se declara no es un suelo.

### El detector se AUTOPRUEBA antes de creerse su número

Requisito nuevo del 12-ago —una sesión vio su censo pasar de 4 a 0 porque un refactor correcto de
otro dejó ciego a su guard—. El detector de «la celda pinta el valor crudo» **demuestra primero que
VE y que DISCRIMINA**, sobre fuente sintética: ve `td.textContent = c.metodo`, lo ve **también con
un `|| 'x'` detrás** (que es como estaba escrito), y **no** marca `td.textContent =
rotuloDeMetodo(c.metodo)` ni `td.textContent = c.cliente`. Sin esa cuarta comprobación el detector
marcaba el arreglo, y un guard que salta con todo se silencia.

## Un test ajeno actualizado, y por qué NO es relajarlo

`tests/scrum285-pantalla-cobros.test.mjs:177` exigía que la fila dijera **«No registrado»** — el
segundo nombre que la columna tenía para lo mismo mientras la pestaña decía «Método no registrado».
La microcopy del 11-ago unifica en el rótulo de la pestaña, así que ese literal queda superado.

**La comprobación se endurece, no se afloja:** antes buscaba la subcadena `/No registrado/` en toda
la pantalla; ahora exige que **todas** las apariciones de `/registrado/i` sean **exactamente**
«Método no registrado» y que haya **al menos dos** —la pestaña y la fila—. Si columna y filtro
vuelven a divergir, ese test cae. La comprobación de que la pantalla nunca dice «Otro» no se toca.

## ✅ LO QUE COSTABA, RESUELTO: la salida 2, aprobada

La primera versión de este ticket dejó **la columna sin distinguir `bizum_auto` de `bizum_manual`**
y lo declaró como coste, con tres salidas posibles y una propuesta. **El asesor y el fundador han
aprobado la 2**, que era la propuesta: grafía propia en la ranura del calificador.

```
bizum_auto    →  Bizum · automático   (18)
bizum_manual  →  Bizum · manual       (14)
```

Con eso **la frase de SCRUM-285 vuelve a describir un mecanismo que existe** —«la distinción no se
pierde: se lee en la fila de cada cobro. Filtrar por cuatro, leer los cinco»— y `paidVia.ts:17`
sigue siendo cierto donde importa: «uno lo confirma una PERSONA, el otro un WEBHOOK. Son dos cadenas
de evidencia distintas ante una inspección».

🔸 **Los dos son microcopy APROBADA, no derivada** (regla 30). Por eso viven en `COBROS_MATICES`,
igual que `COBROS_PASARELAS`: un mapa de **grafía**, no de clasificación. Lo que se deriva —en qué
cubo cae cada cobro, y cómo se llama el cubo— sigue viniendo del servidor. Y un test exige que las
claves de `COBROS_MATICES` estén **en `PAID_VIA`** (regla 22): aquí no nacen métodos.

## Lo que NO se ha tocado

`prisma/schema.prisma` · `PAID_VIA` (regla 22, no se amplía) · ninguna fila histórica · el camino de
emisión (regla 38) · `partirMetodo` y `metodoSinPasarela`, que no se han modificado · **y el ORIGEN
de los cubos del filtro**, que es zona de la otra sesión: esta columna **consume** `c.metodoCubo` y
`window.appCobrosCubos`, y no cambia quién los produce ni cómo llegan.

🔸 `metodoParaAgrupar` **ya no está sin llamantes**: la fase 2 le dio uno (`cuboDeCobro`). El hueco
que declaraba la versión anterior de este documento **lo cerró otro**, y se anota para que nadie lo
persiga creyendo que sigue abierto.

## Verificación de la tanda — REHECHA sobre el árbol fusionado

Con **`main` = `3be9a2ea`** dentro (12-ago, 12:20), que ya trae `scrum-474-fase2-filtro` mergeada por
su propio camino. **Prisma regenerado desde este worktree y `dist/` recompilado antes de medir.**

> 🔴 **EL CONFLICTO QUE RENACÍA YA NO RENACE, y no por repetir la resolución a mano.** Cuando la fase
> 2 del filtro entró en `main`, este merge la encontró **ya resuelta en la base de merge**: git no
> vuelve a plantear la celda de MÉTODO. Comprobado sobre el resultado, no supuesto —`0` marcadores,
> `0` apariciones del comentario ajeno, y la celda pinta `rotuloDeMetodo(c.metodo, c.metodoCubo,
> cubos)` en `cobrosView.js:488`—.
>
> Y la trampa que dejaba el otro lado, medida en todo el árbol: **`COBROS_COPY.metodoSinRegistrar`
> tiene CERO usos de código**. Las dos únicas apariciones —`cobrosView.js:34` y
> `scrum481-…test.mjs:441`— son **comentarios** que explican por qué se retiró. Si hubiera quedado
> uno vivo, la celda pintaría `undefined` en la pantalla del dinero.

> **No se rebasa, se mergea DENTRO.** La rama está empujada, y rebasar exigiría `--force`, prohibido
> en esta casa. El resultado es el mismo contrato, con la historia intacta.

**Línea base MEDIDA APARTE, y sin borrar ficheros del disco** —eso dio un falso rojo anoche
(`docs/master/SCRUM-362.md`)—: se corre el conjunto de tests que **`main` declara** (`git ls-tree`,
437 ficheros) sobre este árbol; el 438 es el de este ticket.

| | tests | pass | fail | skipped |
|---|---|---|---|---|
| **línea base** (los 437 tests de `main`, este árbol) | **3.315** | **3.238** | **0** | **77** |
| **después** (tanda entera, 438) | **3.335** | **3.258** | **0** | **77** |
| diferencia | **+20** | **+20** | **0** | **0** |

> 🔸 Los números suben respecto a la medición de las 10:40 (3.296 / 3.316) porque `main` ha traído
> **SCRUM-441, 467, 483, 485, 486 y 489** por el camino. **Los +20 de este ticket son los mismos**:
> la rama aporta lo que aportaba, medido contra la base de hoy y no restado de cabeza.

* `npm run guards:entrada` — **17 tests, 4 guards, 0 fail**.
* **Marcadores con el guard oficial** `tests/scrum393-marcadores-de-conflicto.test.mjs` — **6 tests,
  0 fail** (0 · 0 · 0).
* **Ni un salto nuevo:** los 77 `skipped` son los mismos antes y después.

> 🔸 **La medida en navegador NO queda como guard permanente.** Se hizo con un script de un solo uso
> —misma disciplina que `scripts/guard-caja-avisos.mjs`: servidor que lee del disco y suelos de «¿es
> la página que creo?»—, y sus números viven en la tabla de arriba, fechados. Montar un tercer guard
> de navegador sería un guard más que mantener; la red que sí corre siempre es
> `tests/scrum481-metodo-en-castellano.test.mjs`, que vigila el mecanismo **y ata el número 27**.
> Queda declarado: **si alguien aprueba un rótulo más largo, esto hay que volver a medirlo a mano.**

## Fuera de carril — se reporta, no se arregla (regla 9)

**`public/dashboard/js/paidViaEtiquetas.js` es un SEGUNDO vocabulario de `paid_via` en el
navegador.** Lo estrenó SCRUM-398 para la pantalla de **Informes**, con otra grafía aprobada y
emoji: `bizum_auto: '📲 Bizum'`, `bizum_manual: '📲 Bizum (confirmado a mano)'`, `'card:stripe':
'💳 Tarjeta'`. Con este ticket, `bizum_manual` se lee **«Bizum · manual»** en Cobros y **«📲 Bizum
(confirmado a mano)»** en Informes: dos pantallas, dos nombres, el mismo hecho.

**No se toca aquí**, y no por comodidad: son dos microcopys **aprobadas por separado** para dos
sitios distintos, y unificarlas es cambio de microcopy (regla 30), no refactor. Se deja dicho para
quien decida si el vocabulario de cobro debe ser uno solo.

## 🔴 Corrección propia — la tanda se corrió ANTES del último cambio, y eso dejó un rojo dentro

La primera entrega de esta rama partió el ancla en dos líneas para meter la referencia a la rama
ajena, y el guard de **SCRUM-267** la tumbó: *«falta la HORA (la fecha sola no dice si caducó)»*. El
regex exige el ancla **completa en una línea que termine en la fecha**.

**No lo cazó la tanda porque la tanda se corrió antes de editar este documento** — que es
exactamente el orden que el encargo prohíbe («`npm test` después del último cambio»). Los 3.316
tests que se declararon eran ciertos sobre el árbol de ese momento, y ese árbol duró hasta la
siguiente edición. **Es el mismo modo de fallo que documenta `SCRUM-284.md:123`**, y por eso la
casa lo pide en ese orden.

Arreglado en esta rama —el ancla vuelve a una sola línea, con segundos— y **re-corrida la tanda
entera después del arreglo**, con los números de abajo.

## Ficheros

* `public/dashboard/js/cobrosView.js` — `pasarelaDeMetodo`, `COBROS_PASARELAS`, **`COBROS_MATICES`**,
  **`grafiaAprobada`**, `rotuloDeMetodo(metodo, cubo, cubos)`; la celda usa el rótulo con el cubo del
  servidor; se retira `metodoSinRegistrar`; se reescribe el papel de `COBROS_METODOS`.
* `tests/scrum481-metodo-en-castellano.test.mjs` (nuevo, **20 tests**).
* `tests/scrum285-pantalla-cobros.test.mjs` — **dos** tests endurecidos: el literal de «no consta», y
  el ④, que prometía en su título «la fila conserva cuál es» y **no lo comprobaba**.
