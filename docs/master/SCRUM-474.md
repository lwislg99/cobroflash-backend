# SCRUM-474 · `Charge.method` hacía dos trabajos — qué quedó en main y qué se quedó fuera

> **Esto documenta trabajo AJENO.** Describe el commit **`ef067bbc`** («SCRUM-474/473: Charge.method
> hacia dos trabajos — se cortan las fugas y se valida la FORMA»), de **Luis**, del **11-ago-2026
> 19:52:42 +0200**, **leído por la sesión 3 el 11-ago-2026**. No lo firmo y no lo juzgo: lo describo
> y digo qué de lo que promete está en main y qué no.
>
> El censo de escritores y el validador van en **`docs/master/SCRUM-473.md`**. Aquí va el lado del
> **lector**, que es el que el profesional ve.

**Medido contra:** `main` = `dd5416f04ed1b8d80a403a9525fab33437fe8b03`
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
- `tests/scrum474-filtro-cobros-un-cubo.test.mjs` — **nuevo**, 79 líneas, con suelo y control
  positivo (`cuboDeMetodo('transfer') === 'transfer'` antes de probar nada más) y el filtro de la
  pantalla ejercido de verdad.

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
