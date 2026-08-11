# SCRUM-481 · La columna MÉTODO habla el mismo idioma que el filtro de al lado

**Medido contra:** `origin/main` = `9286f5b55d0ad354ceb63db886c46acec39f7537` · 2026-08-12T01:47:33+01:00

**12-ago-2026** · **Carril:** Cobros · **Gate:** sin gate, corre en `npm test`

## PASO 0

* `git worktree list`: **cuatro** — aquí, `b1` (scrum-360), `b2` (scrum-477), `b3` (scrum-359).
* `git fetch origin main:main`: **`a224d363` → `192ad46b`** (y `9286f5b5` al cerrar; se movió tres
  veces esta noche).
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

## 🔴 PASO 1 · LA CAJA, MEDIDA EN NAVEGADOR — y el número cambia la pregunta

Medido con **Edge**, el CSS del árbol y **`renderCobrosView` del producto** (no una copia del
marcado): servidor que lee del disco en cada petición, y tres suelos antes de dar un número —el CSS
se aplicó (`borderCollapse: collapse`), las seis cabeceras son las de `COBROS_COPY`, y «Método» es
la 4.ª—. Los tres en verde en las cuatro anchuras.

| ancho | antes | después | página | `.table-scroll` |
|---|---|---|---|---|
| **320 px** | **columna OCULTA** | **columna OCULTA** | 320/320 · sin scroll | 294/294 · cabe |
| **390 px** | **columna OCULTA** | **columna OCULTA** | 390/390 · sin scroll | 364/364 · cabe |
| **641 px** | 128 px | **146 px** | 641/641 · sin scroll | 615/615 · cabe |
| **768 px** | 128 px | **146 px** | 768/768 · sin scroll | 742/742 · cabe |

🔴 **A 320 px no hay nada que medir: la columna no se pinta.** `.col-hide-mobile` es
`display: none` a `max-width: 640px` (`styles.css:2073`), decisión de SCRUM-285 —en la card no hay
cabecera que explique un `transfer` suelto—. **La pregunta del encargo no aplica a 320 px**: la
anchura solo existe de **641 px** para arriba, y ahí el valor más largo posible —«tarjeta ·
MercadoPago», 21 caracteres— **cabe**: la celda pasa de 128 a 146 px, **ninguna celda se corta**
(`scrollWidth > clientWidth` no se dispara en ninguna fila) y **no aparece scroll horizontal**.

**La decisión del fundador se sostiene con el número delante: la pasarela cabe.** No hay que
retomarla.

> 🔸 **Dos precisiones sobre la premisa del encargo.** «El más largo que YA se pinta hoy» —«Método
> no registrado», 20— **no se pintaba en la columna**: era el rótulo de la **pestaña**. En la
> columna, el «no consta» decía «No registrado» (13). Y el más largo que sí se pintaba era el valor
> crudo `card:mercadopago` (16). Los dos números del encargo eran de sitios distintos.

## Lo construido — el rótulo se DERIVA, no se traduce

`rotuloDeMetodo(metodo)` sale de **`cuboDeMetodo`, la MISMA función que decide el filtro**, y de
`COBROS_METODOS`, que sigue siendo la única lista. **Columna y pestaña no pueden discrepar porque es
el mismo cálculo**, no dos que se parecen. No hay tabla de traducción de métodos.

| entrada | rótulo |
|---|---|
| `card:stripe` | **tarjeta · Stripe** |
| `card:mercadopago` | **tarjeta · MercadoPago** |
| `card` | **tarjeta** |
| `bizum_auto` · `bizum_manual` | **Bizum** |
| `transfer:revolut` (pasarela sin grafía aprobada) | **transferencia** |
| `card:` · `bank` · `mp` · `null` · `42` | **Método no registrado** |

### 🔴 El trinquete sigue en 2, y no por suerte

`COPIAS_DE_LA_PARTICION = 2` **no sube**. `pasarelaDeMetodo` **no parte por «:»**: le pide la cabeza
a `metodoSinPasarela` —la copia declarada— y se queda con lo que sobra detrás
(`limpio.slice(base.length + 1)`). No contiene el literal `':'` en ninguna parte, así que no hay una
segunda regla de partición que pueda divergir: **si mañana cambia la partición, cambia en un sitio y
esto la sigue sin enterarse.** Es lo que pide el mensaje del propio trinquete —«casi siempre puede
llamar a una de las dos»—, no un rodeo para esquivarlo.

**Interrogado, no supuesto.** Se corrió el detector de SCRUM-474 sobre el fichero:

| función | ¿parte por `:`? | ¿toma la cabeza? | ¿la cuenta el trinquete? |
|---|---|---|---|
| `metodoSinPasarela` | sí | sí | **SÍ** (la copia declarada, sigue ahí) |
| `pasarelaDeMetodo` | **no** | sí | no |
| `rotuloDeMetodo` · `cuboDeMetodo` | no | no | no |

Y **probado por mutación**: escribiendo a mano un `indexOf(':')` dentro de `pasarelaDeMetodo`, **el
trinquete de SCRUM-474 salta**. No se ha relajado ni tocado.

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
* **Derivado, no a mano** — el corpus sale de `COBROS_METODOS` × `COBROS_PASARELAS`: **21
  combinaciones**. Si mañana nace un método, entra solo o el test se cae.
* **🔴 CONTROL NEGATIVO, y protege el dinero** — `bank`, `mp`, `bizum`, `desconocido`, `SCTinst`,
  `card:`, `''`, `null`, `42`: todos «Método no registrado», ninguno se cuela en otro cubo, y **las
  cuatro filas siguen pintadas**. Un cobro que desaparece de una pantalla de dinero es peor que uno
  mal etiquetado.
* **Nunca «tarjeta · » colgando** — sobre 16 entradas: ni separador suelto, ni cadena vacía, ni un
  «:» del valor de la base dentro del rótulo.
* **SUELO** — si la partición resuelve a un cubo **sin rótulo**, sale «Método no registrado». Ni
  cadena vacía ni valor crudo «por si acaso».

### 🔴 EL ROJO POR MECANISMO (6, restaurando entre cada una)

| mutación | resultado |
|---|---|
| volver a pintar el valor **crudo** (`c.metodo \|\| 'No registrado'`) | **3 rojos**, uno diciendo que *la pantalla le enseña el valor de la base al profesional* |
| el suelo cae al **valor crudo** | **10/10 VERDE** 🔴 → con el caso añadido, **1 rojo** |
| el suelo cae a la **cadena vacía** | **1 rojo** |
| se pinta la **pasarela cruda** si no está en el mapa | **1 rojo** |
| **«tarjeta · » colgando** cuando no hay pasarela | **4 rojos** |
| `pasarelaDeMetodo` **parte por «:»** a mano (tercera copia) | **1 rojo**, y lo da el trinquete de SCRUM-474 |

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

## 🔸 LO QUE ESTE CAMBIO CUESTA, Y NO LO DECIDO YO

**La columna deja de distinguir `bizum_auto` de `bizum_manual`.** Los dos se leen «Bizum».

No es un descuido: la microcopy aprobada usa los rótulos de las pestañas, y ahí Bizum es uno. Pero
**SCRUM-285 había dejado esa distinción viviendo justo aquí** — «`bizum_auto` y `bizum_manual` son
una distinción NUESTRA… **la distinción no se pierde: se lee en la fila de cada cobro**. Filtrar por
cuatro, leer los cinco» (`cobrosView.js:67-70`). Esa frase deja de ser cierta con este cambio.

**No se inventa un rótulo para arreglarlo** (regla 30): «Bizum · automático» sería microcopy nueva.
Las salidas posibles, para quien aprueba el copy:

1. **Aceptarlo** — el profesional no distingue automático de manual en la lista. Es una distinción
   nuestra, no suya, y ya no la ve nadie.
2. **Aprobar una grafía** para el quinto («Bizum · confirmado» / «Bizum · a mano», o lo que decida el
   asesor) y usarla en la ranura de la pasarela.
3. **Llevarlo al detalle del cobro** en vez de a la lista.

**Propongo la 2** —es la que conserva lo que SCRUM-285 decidió a propósito y cabe en el formato ya
aprobado—, pero **la decide el asesor**. Hasta entonces queda como está: dos «Bizum».

## Lo que NO se ha tocado

`prisma/schema.prisma` · `PAID_VIA` (regla 22, no se amplía) · ninguna fila histórica · el filtro y
su trinquete · el camino de emisión (regla 38) · `metodoParaAgrupar`, que sigue sin llamantes y es
alcance de SCRUM-473 · `partirMetodo` y `metodoSinPasarela`, que no se han modificado.

## Verificación de la tanda

Con `main` (`9286f5b5`) dentro; merge limpio.

**Línea base MEDIDA APARTE, y sin borrar ficheros del disco** —eso dio un falso rojo anoche
(`docs/master/SCRUM-362.md`)—: se corre el conjunto de tests que `main` declara, sobre este árbol.

| | tests | pass | fail | skipped |
|---|---|---|---|---|
| **línea base** (tests de `main`, este árbol) | **3.278** | **3.201** | **0** | **77** |
| **después** (tanda entera) | **3.289** | **3.212** | **0** | **77** |
| diferencia | **+11** | **+11** | 0 | **0** |

* `npm run guards:entrada` — **17 tests, 4 guards, 0 fail**.
* **Marcadores con el guard oficial** `tests/scrum393-marcadores-de-conflicto.test.mjs` — **6 tests,
  0 fail**.
* La caja, **re-medida en navegador después del merge**: los mismos 146 px, sin cortes y sin scroll.

> 🔸 **La medida en navegador NO queda como guard permanente.** Se hizo con un script de un solo uso
> —misma disciplina que `scripts/guard-caja-avisos.mjs`: servidor que lee del disco y suelos de «¿es
> la página que creo?»—, y sus números viven en la tabla de arriba, fechados. Montar un tercer guard
> de navegador para una columna que hoy cabe con 18 px de margen sería un guard más que mantener; la
> red que sí corre siempre es `tests/scrum481-metodo-en-castellano.test.mjs`, que vigila el
> mecanismo. Queda declarado: **si alguien alarga los rótulos, esto hay que volver a medirlo a mano.**

## Ficheros

* `public/dashboard/js/cobrosView.js` — `pasarelaDeMetodo`, `COBROS_PASARELAS`, `rotuloDeMetodo`; la
  celda usa el rótulo; se retira `metodoSinRegistrar`.
* `tests/scrum481-metodo-en-castellano.test.mjs` (nuevo, 11).
* `tests/scrum285-pantalla-cobros.test.mjs` — un test, endurecido (arriba).
