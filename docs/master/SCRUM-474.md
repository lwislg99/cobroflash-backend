# SCRUM-474 · `Charge.method` hacía dos trabajos — qué quedó en main y qué se quedó fuera

> **Esto documenta trabajo AJENO.** Describe el commit **`ef067bbc`** («SCRUM-474/473: Charge.method
> hacia dos trabajos — se cortan las fugas y se valida la FORMA»), de **Luis**, del **11-ago-2026
> 19:52:42 +0200**, **leído por la sesión 3 el 11-ago-2026**. No lo firmo y no lo juzgo: lo describo
> y digo qué de lo que promete está en main y qué no.
>
> El censo de escritores y el validador van en **`docs/master/SCRUM-473.md`**. Aquí va el lado del
> **lector**, que es el que el profesional ve.

**Medido contra:** `origin/main` = `dd5416f04ed1b8d80a403a9525fab33437fe8b03` · 2026-08-11T21:10:34+01:00
**Rama de lectura:** `scrum-473-documentar-lo-mergeado`

---

## 1. El defecto, tal como lo cuenta el commit

`Charge.method` guarda dos cosas que no son sinónimos:

- **la preferencia** que elige el profesional al crear el cobro → `card` (`charges.routes.ts:39`);
- **el hecho consumado** que escribe la pasarela → `card:stripe` (`stripe.routes.ts`, `receipt.routes.ts`).

Como el filtro de la pantalla de Cobros comparaba el valor **entero**, `card:stripe` no encajaba en
ningún cubo y caía en «Método no registrado». El profesional filtra por tarjeta y ve la mitad de sus
cobros. La cifra que da el commit —**38 de 51 cobros repartidos en dos etiquetas, medido en
producción el 11-ago-2026**— es suya; **no la he reproducido** y no tengo acceso a producción para
hacerlo.

## 2. La decisión de diseño: la FORMA, no una columna nueva

`<metodo>` ó `<metodo>:<pasarela>`, con `<metodo>` obligatoriamente en `PAID_VIA`. Es lo que permite
exigir el conjunto cerrado de la regla 22 **sin migración de esquema y sin destruir la pasarela**:
`card:stripe` pasa porque `card` está en el conjunto, y `stripe` —que hoy solo vive dentro de esa
etiqueta— no se pierde.

`src/modules/billing/domain/metodoDeCobro.ts` implementa esa forma en cuatro funciones:
`partirMetodo` (separa, no juzga), `esMetodoValido` (valida contra `PAID_VIA` **importado**),
`metodoParaAgrupar` (normaliza al leer) y `metodoDesdeMercadoPago` (traduce el vocabulario de MP).

> Nota del fundador registrada en el commit: la decisión de ir a **dos columnas** se toma **después**
> de esta lectura, y puede encogerla. Nada de este documento la prejuzga.

---

## 3. 🔴 Lo que está en main y lo que NO

| pieza | ¿en main? | dónde |
|---|---|---|
| La forma y su validador | **sí** | `metodoDeCobro.ts` |
| El guard del webhook | **sí** | `psp.routes.ts:110` |
| `bank → transfer` | **sí** | `charges.routes.ts:39` |
| La traducción de MercadoPago | **sí** | `mercadopago.ts:89` |
| Los tests unitarios de la forma | **sí** | `tests/scrum473-metodo-validado.test.mjs` (5 tests) |
| **El lector que junta `card` y `card:stripe`** | **NO** | ver §4 |

El mensaje del commit dice: *«los lectores normalizan al leer (`metodoParaAgrupar`), así que `card` y
`card:stripe` caen en el mismo cubo»*. **En main eso no ocurre.**

- `metodoParaAgrupar` tiene **cero llamantes** en `src/` y **cero** en `public/`. Sus únicas
  apariciones fuera de su definición (`metodoDeCobro.ts:72`) son los cuatro asserts de su propio test
  (`:89`, `:90`, `:92`, `:96`) y el `import` que los alimenta (`:17`).
- El filtro real de la pantalla —`cuboDeMetodo`, `public/dashboard/js/cobrosView.js:105-110`— sigue
  comparando el valor entero contra `COBROS_METODOS[i].casa`
  (`bizum_auto`/`bizum_manual`, `card`, `transfer`, `cash`, `:85-90`). `card:stripe` no está en
  ninguna `casa`, así que sigue cayendo en `COBROS_SIN_METODO`.

**El defecto que el profesional ve HOY sigue exactamente igual en main.** Lo que se mergeó es la
mitad escritora del trabajo.

Hay además una razón estructural por la que ese cableado no podía ser directo: la pantalla es
**vanilla, sin *bundler*** (regla dura 4). `public/dashboard/js/cobrosView.js` **no puede importar**
`src/modules/billing/domain/metodoDeCobro.ts`, que es TypeScript compilado a `dist/` para el
servidor. La normalización del lector tiene que existir **otra vez** en el lado del navegador, o
bajar del servidor ya normalizada.

---

## 4. Qué hay en `scrum-474-filtro-cobros` (`79248b55`) — SIN MERGEAR

**Sí: el lector que falta vive ahí.** Comprobado, y por eso **no se construye nada aquí**.

Rama `origin/scrum-474-filtro-cobros`, **un solo commit propio** sobre main
(`79248b55`, Luis, 11-ago-2026, «SCRUM-474: el filtro de Cobros deja de partir las tarjetas en dos»),
+104/−3 en dos ficheros:

- `public/dashboard/js/cobrosView.js` — añade `metodoSinPasarela(metodo)`, que recorta en el primer
  `:`, y hace que `cuboDeMetodo` clasifique por la base en vez de por el valor entero. Se exporta
  también en `module.exports`.
- un test nuevo que lo acompaña, 79 líneas, con suelo y control positivo
  (`cuboDeMetodo('transfer') === 'transfer'` antes de probar nada más) y el filtro de la pantalla
  ejercido de verdad.

  > Su ruta **no se escribe aquí a propósito**: `tests/scrum391-guards-declarados-presentes.test.mjs`
  > exige que todo test nombrado por su propia entrada exista en el árbol, y éste vive en la rama sin
  > mergear. Me lo cazó en rojo al escribir este documento. Las dos salidas honestas eran extraer el
  > test de su rama o corregir la constancia; extraerlo sería construir, que es justo lo que esta
  > sesión no hace. Se nombra lo que existe: el commit `79248b55`.

### 🔴 Lo que hay que mirar antes de mergearla

`metodoSinPasarela` es una **tercera implementación de la misma partición**. `partirMetodo`
(`metodoDeCobro.ts:37`) ya recorta en el primer `:`, normaliza a minúsculas y hace `trim`;
`metodoSinPasarela` (`cobrosView.js`) hace lo mismo otra vez, en vanilla.

Es exactamente el riesgo que el commit `ef067bbc` puso por escrito para el validador —*«una segunda
lista es cómo esto vuelve a pasar dentro de tres meses»*—, ahora en la partición en vez de en la
lista. **Y aquí puede que no haya alternativa**: la regla dura 4 impide que el navegador importe el
módulo del servidor (§3). Si es inevitable, lo que toca es que **conste que son dos copias
deliberadas** y que un test las ate a la misma respuesta, no que se descubra dentro de tres meses.

Segunda diferencia, menor pero real: `metodoParaAgrupar` valida contra `PAID_VIA` y devuelve `null`
para lo que no reconoce; `metodoSinPasarela` **no valida** —solo recorta— y deja que la clasificación
la haga `COBROS_METODOS[i].casa`. El resultado visible coincide hoy porque las `casa` son un
subconjunto de `PAID_VIA`, pero **son dos criterios distintos**, y en cuanto uno de los dos cambie
dejarán de coincidir.

**Nada de esto se arregla en esta sesión.** Es lectura; la decisión de las dos columnas va después y
puede hacer irrelevante media discusión.

---

## 5. Ramas y trabajo relacionado, medido por CONTENIDO

Buscado por contenido y no por número de ticket, sobre **todas** las cabezas remotas
(`git ls-remote --heads origin`, 218 ramas), con `metodoDeCobro`, `metodoParaAgrupar`, `PAID_VIA`,
`paidViaDesdeStripe` y `esMetodoValido`:

- `metodoDeCobro` / `metodoParaAgrupar` / `esMetodoValido` aparecen **solo** en `main` y en las ramas
  que ya llevan `main` dentro: `scrum-351-topologia-node-modules`, `scrum-469-avisos-que-nadie-ve`,
  `scrum-474-filtro-cobros`, `scrum-475-constancia-correo`, `scrum-475-emisor-unico`. **No hay
  ninguna implementación paralela** en otra rama.
- La rama que produjo el trabajo, `scrum-474-metodo-un-solo-trabajo`, **ya no existe en `origin`**:
  se borró al mergear el PR #703 (`e33e9506`). Buscarla por nombre no habría encontrado nada — que es
  por lo que la búsqueda va por contenido.
- Existe una rama **local y solo local**, `scrum-473-censo-de-escritores`, en el worktree
  `C:/Users/Javier Pereira/cobroflash-backend`. Apunta a `c039e7bd` y tiene **0 commits propios
  respecto a `main`**: es una etiqueta vacía, no trabajo duplicado.
- Única rama con commit propio que toca alguno de estos ficheros: `scrum-245-fuera-listas-blancas`
  (`psp.routes.ts`), sin relación con el vocabulario de método.

---

# APÉNDICE · SCRUM-474 (2) · el LECTOR: el filtro deja de partir las tarjetas

> Segunda entrada en este fichero, por SCRUM-273: el registro de un ticket va en UN solo fichero
> y lo que ya había NO se borra (precedente: `SCRUM-244.md`). Lo de arriba es la LECTURA de lo
> mergeado, del 11-ago-2026; esto es el trabajo que la completa.

> **EL CÓDIGO DEL ARREGLO NO ES MÍO.** `metodoSinPasarela()` y su test los escribió **Luis** en el
> commit **`79248b55`** («SCRUM-474: el filtro de Cobros deja de partir las tarjetas en dos cubos»,
> 11-ago-2026 20:44:12 +0200), en la rama `scrum-474-filtro-cobros`, que **sigue intacta y sin
> mergear**. Aquí se trae con `cherry-pick`, así que su autoría consta en el historial: el commit
> `63530890` de esta rama lleva `Author: Luis`.
>
> Lo de esta sesión es lo que va **encima**: la enmienda del caso `card:` (§4), el test que ata las
> dos copias y el trinquete estructural (§3), y este documento.

**Medido contra:** `origin/main` = `8371d1b9870a1d09e2d58653d64b33b4a817dc1d`
**Rama:** `scrum-474-filtro-cobros-al-dia`, salida de `main`.
**Antecedentes:** `docs/master/SCRUM-473.md` (el censo de escritores) y `docs/master/SCRUM-474.md`
(la lectura de lo mergeado, que dejó dicho en su §4 lo que faltaba para poder mergear esto).

---

### 1. El defecto, tal como lo ve el profesional

`Charge.method` guarda dos cosas que no son sinónimos: la **preferencia** que elige el profesional
al crear el cobro (`card`, `charges.routes.ts:39`) y el **hecho consumado** que escribe la pasarela
(`card:stripe`, `stripe.routes.ts` y `receipt.routes.ts`).

`cuboDeMetodo` (`public/dashboard/js/cobrosView.js`) comparaba el valor **entero** contra la lista
de cada cubo. `card:stripe` no casaba con `['card']`, así que caía en «Método no registrado».

**Medido en producción el 11-ago-2026** (cifra de Luis, tomada de `79248b55`; no la he reproducido
y no tengo acceso a producción): `card` en 28 cobros y `card:stripe` en 10. **El profesional filtra
por tarjeta y ve 28 de 38.** Los otros diez no desaparecen de la pantalla —salen bajo «Método no
registrado»—, pero ese rótulo afirma que de ellos no consta cómo entró el dinero, y sí consta.

### 2. El arreglo

Se recorta la pasarela **antes** de mirar. `COBROS_METODOS` sigue siendo la única lista de qué valor
cae en qué cubo: no se copia la tabla, y por eso `transfer:mercadopago` funciona sin tocarla.

**Sin migrar un solo dato**: `card` y `card:stripe` se siguen guardando tal cual, con su pasarela.
Ninguna fila histórica se toca y el esquema no cambia.

---

### 3. 🔴 LAS DOS COPIAS DE LA PARTICIÓN — declaradas y contadas

    COPIAS_DE_LA_PARTICION = 2

| # | dónde | función |
|---|---|---|
| 1 | `src/modules/billing/domain/metodoDeCobro.ts:37` | `partirMetodo` |
| 2 | `public/dashboard/js/cobrosView.js:135` | `metodoSinPasarela` |

**Por qué son dos y no una.** La regla dura 4 —frontend vanilla, sin bundler— impide que
`cobrosView.js` importe `metodoDeCobro.ts`, que es TypeScript compilado a `dist/` para el servidor.
No hay build en el navegador que lo traiga. **La copia es inevitable; que nadie la cuente, no.**

`metodoParaAgrupar` **no** es una tercera implementación: llama a `partirMetodo` y filtra por
`PAID_VIA`. Medido con AST sobre 350 ficheros de `src/`, `public/` y `scripts/` — el censo da
**dos**, y calibrar el trinquete en tres lo habría hecho nacer con holgura justo para la siguiente.

### El trinquete: `tests/scrum474-dos-copias-atadas.test.mjs`

Dos mecanismos, porque uno solo no basta:

- **① Comportamiento.** Las dos copias, mismo corpus, mismo veredicto. El corpus se **deriva de
  `PAID_VIA`** en vez de escribirse a mano, así que si el conjunto cerrado crece, el corpus crece
  con él. Caza que una copia **derive** de la otra.
- **② Estructural (AST).** Cuenta las implementaciones de la partición en el árbol y las compara
  con el registro. Caza que **nazca una tercera**, y la nombra con fichero, línea y función.

> 🔴 **Por qué hacen falta los dos.** Un test de comportamiento **aprueba la bifurcación el día
> exacto en que se introduce**: ese día la copia nueva todavía coincide con las viejas, pasa en
> verde, y solo salta meses después, cuando ya divergieron. Medido en **SCRUM-361** (11-ago-2026):
> se reimplementó a mano una comparación y los **cuatro** tests de comportamiento siguieron verdes;
> solo cayó el guard estructural.
>
> En SCRUM-361 la salida fue **delegar en vez de copiar** —«importar es leer, una divergencia
> imposible gana a una vigilada»—. **Aquí esa salida no existe** (regla 4). Por eso: se copia, se
> cuenta, y se pone trinquete.

El trinquete **no impide** añadir una tercera copia: impide añadirla **en silencio**. Quien la
declare en `PARTICIONES_DECLARADAS` tiene que poder decir por qué no delega en una de las dos.

Y el detector lleva su propio **control positivo**: se le da una partición sintética y tiene que
verla, y una función que no parte por `:` y tiene que ignorarla. Sin eso, «no hay una tercera copia»
y «el detector está ciego» darían el mismo verde.

---

### 4. 🔴 La enmienda de esta sesión: el caso `card:`

Al comparar las dos copias sobre 93 casos, **6 divergían**, todas por el mismo mecanismo: la
pasarela vacía (`card:`, `transfer:`, `cash:`…).

| valor | servidor (`partirMetodo`) | navegador, según `79248b55` |
|---|---|---|
| `card:` | `null` — no cumple la forma | `card` — cubo «tarjeta» |

`partirMetodo` rechaza la pasarela vacía (`metodoDeCobro.ts:45`); `metodoSinPasarela` recortaba y se
quedaba con la base sin comprobarlo. **Se ha alineado el navegador con el servidor**, no al revés,
por tres razones:

1. `metodoDeCobro.ts` es la fuente de verdad de la FORMA, decidida por el fundador. La copia del
   navegador **obedece, no legisla**.
2. `esMetodoValido('card:')` es `false`, así que el guard de `psp.routes.ts:110` **ya rechaza ese
   valor al escribirlo**. Un lector que lo clasificara como tarjeta estaría contradiciendo al
   escritor sobre el mismo dato.
3. Tocar `partirMetodo` para lo contrario habría sido modificar el dominio del servidor, del que
   cuelga `esMetodoValido` en el camino del dinero. Fuera de alcance.

**El suelo se mantiene:** `card:` cae en «Método no registrado», que sigue en el listado. No
desaparece ningún cobro de la pantalla — solo cambia de cubo, y al que dice la verdad.

---

### 5. Los controles

| control | qué prueba |
|---|---|
| **POSITIVO** | 28 cobros `card` + 10 `card:stripe` → el filtro «tarjeta» de la pantalla devuelve **38**. Ejercido **pulsando el botón** en `renderCobrosView` con el banco de vistas, no reimplementando el filtro. |
| **NEGATIVO** | `bizum` (huérfano) **no** se funde con `bizum_manual`. Son dos cadenas de evidencia distintas —una la confirma una persona (`chargesAdmin.routes.ts:51`), la otra un webhook— y fundirlas sería peor que el defecto que se arregla. |
| **SUELO** | Un método que no se reconoce **no desaparece del listado ni se cuela en otro cubo**: sale como lo que es, no clasificado. Un cobro que desaparece de una pantalla de dinero es peor que uno mal etiquetado. |
| **ROJO POR EL MECANISMO** | Quitando la partición, el test cae diciendo que **el filtro esconde diez cobros al profesional** — no «falla el filtro». |

---

### 6. Lo que NO se ha tocado, y por qué

- **`metodoParaAgrupar` sigue sin llamantes.** Es el hallazgo (b) de `docs/master/SCRUM-473.md` §4.
  **No se cablea aquí**: es alcance de SCRUM-473 y depende de la decisión de esquema pendiente
  —las dos columnas— que el fundador aún no ha tomado. Queda **declarado, no arreglado**.
- **`prisma/schema.prisma`**, ninguna fila histórica y el camino de emisión (regla 38).
- **El conjunto cerrado `PAID_VIA` no se amplía** (regla 22).
- **La rama de Luis, `scrum-474-filtro-cobros`, no se ha tocado**: sigue en `79248b55`. Lo suyo se
  trajo aquí con `cherry-pick`.
- **Ningún rótulo nuevo** (regla 30): los seis filtros siguen siendo los que aprobó el asesor el
  10-ago-2026, y `tests/scrum285-pantalla-cobros.test.mjs` los comprueba carácter a carácter.
- Los huecos que `docs/master/SCRUM-473.md` §5 dejó abiertos —`charges.routes.ts:39` escribiendo
  `'mp'`, `mpWebhook.routes.ts:107`, `dev.routes.ts:26` con `'SCTinst'`— **siguen abiertos**. Son
  del lado escritor y de otro carril.

