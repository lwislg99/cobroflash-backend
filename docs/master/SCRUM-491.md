# SCRUM-491 · El MÉTODO sale de `Invoice.paidVia`, y el REGISTRO deja de ocupar su columna

**Medido contra:** `origin/main` = `947399937957d0697933fcf518799dc4c939bcea` · 2026-08-12T12:09:39+01:00

**12-ago-2026** · **Carril:** Informes · **Gate:** sin gate, corre en `npm test`

**LA VÍCTIMA:** el profesional nos dice por dónde le entró el dinero al marcar la factura cobrada, y
el informe le sigue contestando «✍️ Marcado a mano», que es la respuesta a otra pregunta.

> 🔸 `main` se movió **tres veces** durante el ticket (`c9499faa` → `d09d4863` → `94739993`; en la
> segunda entró SCRUM-488 fase 2, sobre la que este trabajo se apoya). Se mergeó `main` DENTRO de la
> rama cada vez —nunca al revés, nunca rebase—, se regeneró el cliente de Prisma en ESTE worktree, y
> la línea base se volvió a medir después del último merge.

---

## ① EL PASO 0 · las cuatro preguntas, con la fuente delante

### 1 · ¿QUIÉN escribe `Invoice.paidVia`, y cuándo?

`updateInvoiceStatusAdmin` (`src/modules/system/invoiceAdmin.ts:191`), llamado desde
`invoicesAdmin.routes.ts:426`, **en el momento en que el profesional cambia el estado de la factura
desde el panel** — con el selector de `public/dashboard/js/selectorMetodoCobro.js`. La decisión es
pura y vive en `campoPaidViaAlMarcar`: `paid` con método → se escribe; `paid` sin método → **no se
toca la columna**; `pending` → `null`.

### 2 · ¿Es nulable? ¿Cuántas filas lo tienen?

Nulable, sin `@default`: `paidVia String? @map("paid_via")`. **Cuántas filas lo tienen hoy NO SE HA
CONTADO**, y no se inventa un número: contarlo pide una consulta contra producción, que no es de
este carril. Lo que sí consta por construcción es que **ninguna fila anterior a SCRUM-441 puede
tenerlo**, porque la columna no existía — y de ahí sale la decisión de no hacer backfill.

### 3 · ¿Qué valores admite? ¿Es `PAID_VIA`?

**Sí, es el conjunto cerrado de la regla 22 — no hay tercer vocabulario y por tanto no hay STOP.**
Lo que se escribe pasa por `metodoDeclarado` (privado, `metodoDeCobro.ts`): forma
`<metodo>[:<pasarela>]` con `<metodo>` en `PAID_VIA`, **más** `desconocido` —que no es lo mismo que
`null`: `null` es «nadie dijo nada» y `desconocido` es «se preguntó y no consta»—. Cualquier otra
cosa devuelve `null` y la columna no se toca. Es **más estricto** que `Charge.method`, que lo
escriben nueve sitios.

### 4 · ¿Cobros ya lo lee?

**En `main`, NO**: `cobros.service.ts` mapeaba `metodo: null` a fuego. **Y en una rama sin mergear,
SÍ** — `scrum-441-cobros-leen-paid-via`, `c2e540d3`, Luis, 12-ago-2026 12:56 +0200, un solo commit,
que toca `cobros.service.ts`, su test y `docs/master/SCRUM-441.md`. **Eso es la mitad de Cobros de
este ticket, ya construida en el carril del otro fundador.** No se reescribe (⑦.2).

### Cómo se midió, con DOS instrumentos y su control positivo

| instrumento | qué encontró |
|---|---|
| `git grep -E "paidVia\|paid_via" main -- src/modules/reports/ src/modules/billing/ public/dashboard/js/` | en `reports/`, **una sola aparición y es un COMENTARIO** (`reports.routes.ts:159`). Ninguna lectura. |
| `git grep -E "paidVia: true\|inv\.paidVia" <todas las refs remotas> -- src/modules/reports/` | **cero** en las 250 ramas |
| el MISMO instrumento fuera de `reports/` (control positivo) | **2 aciertos**, los dos en `cobros.service.ts` de la rama de Luis — o sea que sabe encontrar una lectura cuando la hay |

🔸 El primer intento del segundo instrumento (`paidVia|paid_via` a secas) casaba en **todas** las
ramas, porque el comentario de la ruta está en todas. Un patrón que acierta siempre no discrimina
nada: se afinó a la forma que tiene una LECTURA de verdad.

---

## ② QUÉ SE CONSTRUYE

Son **dos preguntas** y una sola columna las contestaba:

* **MÉTODO** — por dónde entró el dinero. `Charge.method`, o `Invoice.paidVia` desde SCRUM-441.
* **REGISTRO** — quién lo apuntó. Que la factura no tenga `Charge` significa que la marcó una persona.

El informe fabricaba `'manual'` al leer (`inv.charge?.method || 'manual'`) y lo metía en la columna
del MÉTODO. Ahora:

```
método = Charge.method  ||  Invoice.paidVia (normalizado)  ||  «no consta»
```

* **`Charge.method` MANDA** cuando están los dos. No es un empate: uno lo confirma un WEBHOOK y el
  otro lo dice una persona (`paidVia.ts:17`), y ante una inspección son dos cadenas de evidencia
  distintas. Gana el hecho consumado.
* **`null`, `''` y ausente son la MISMA ausencia.** `?? null` no basta —`??` solo cubre `null` y
  `undefined`— y dos maneras de decir «no consta» divergen en cuanto alguien filtre por una.
* **🔴 SIN BACKFILL.** Las facturas marcadas a mano antes de que la columna existiera no tienen el
  dato y **no se les inventa uno**. Un método por defecto —«suele ser transferencia»— es exactamente
  el bug que `paidVia.ts` cierra.

### 🔴 El rótulo del «no consta» NO es microcopy nueva

La ausencia viaja como cadena vacía, y `etiquetaMetodoCobro('')` **ya devuelve «⚠️ Sin método»**
desde SCRUM-398 —su propio guard lo comprueba («un método vacío o ausente tampoco se cuela»)—. Así
que no se inventa un texto ni se toca el diccionario: se usa el que la casa ya tiene aprobado para
justo esto.

🔸 **Y queda una asimetría, dicha:** Cobros llama a lo mismo «Método no registrado»
(`ROTULO_SIN_METODO`) e Informes «⚠️ Sin método». Misma afirmación, dos redacciones aprobadas por
separado. Unificarlas es microcopy (regla 30) y no se toca aquí.

---

## ③ 🔴 LA PANTALLA, ANTES Y DESPUÉS — medida pintada, no supuesta

Banco de un solo uso con `reportsView.js` y `paidViaEtiquetas.js` **reales** servidos del disco y el
`loadX2` de verdad; importes y nº de cobros leídos del DOM. Mismo banco que SCRUM-488 fase 2, con
los tres cobros marcados a mano declarando ahora su método —salvo uno, que es la factura histórica
sin el dato—. Evidencia: `docs/master/evidencias/scrum491/scrum491-informe-antes-despues.png`.

| ANTES · el registro ocupaba la columna | € | cobros | | DESPUÉS · el método sale de `paidVia` | € | cobros |
|---|---|---|---|---|---|---|
| 💳 Tarjeta | 6.080,55 | 16 | → | 💳 Tarjeta | 6.080,55 | 16 |
| **✍️ Marcado a mano** | **900,00** | **3** | ✂ | **📲 Bizum** | **1.050,50** | **7** |
| 📲 Bizum | 850,50 | 6 | ↗ | **🏦 Transferencia** | **600,00** | **1** |
| | | | ↘ | **⚠️ Sin método** | **100,00** | **1** |
| **3 filas** | **7.831,05** | **25** | | **4 filas** | **7.831,05** | **25** |

**El total del informe y el nº de cobros son IDÉNTICOS** (783.105 céntimos · 25 cobros): leer un
campo nuevo reetiqueta filas, **nunca mueve dinero**. Lo que cambia es que los 900 € que decían «lo
apuntó una persona» ahora dicen **por dónde entraron**: 200 € por Bizum, 600 € por transferencia, y
100 € que siguen sin constar porque nadie lo declaró.

🔸 Ninguna caja desborda: `scrollWidth` = `clientWidth` = 150 px en las cuatro filas, una línea cada
una. «⚠️ Sin método» es la etiqueta más corta del diccionario, así que la caja mejora.

---

## ④ EL REGISTRO · ⛔ PARADA DECLARADA, con propuesta

**Lo construido:** el hecho —cuántos cobros y cuánto dinero apuntó una persona en vez de una
pasarela— viaja en la respuesta de `/admin/reports/x2` como `marcadosAMano: { count, eur }`, contado
y con su importe. **Lo que NO se hace: pintarlo.**

🔴 **DÓNDE se le enseña al profesional es microcopy y lo aprueba el asesor (regla 30).** Es el STOP 1
del encargo y aquí se para. El dato **no se borra** —es real y útil: dice qué parte de la caja no
pasó por ninguna pasarela— y no se pinta sin texto aprobado.

**El hueco lleva marcador ejecutable, no una nota:** hay un guard que exige que `reportsView.js`
**siga sin** nombrar `marcadosAMano`. Si alguien lo pinta, tiene que borrar ese guard en el mismo
commit y dejar dicho quién aprobó el texto — así el hueco no se rellena de camino y sin enterarse.

**Propuesta para el asesor** (no construida, para que se decida con la medición delante):

1. **Un pie bajo la lista**, fuera de la columna del método: «*X de estos cobros los marcaste tú a
   mano*». Es donde menos estorba y no compite con ninguna fila.
2. **Una columna aparte** en la tabla. Cuesta ancho en una caja que ya va justa (150 px medidos).
3. **En ningún sitio de Informes**, y que viva solo en Cobros. Se pierde el dato en la pantalla de
   repaso anual, que es donde el asesor cruza con el banco.

**Propongo la 1**: contesta la pregunta sin volver a mezclarla con la del método, que es el defecto
que este ticket cierra.

---

## ⑤ VERIFICACIÓN

* **DOS INSTRUMENTOS, y cada uno dice lo suyo por separado.** ① **AST**: que la ruta PIDA `paidVia`
  en el mismo `select` que `charge` —*mencionar no es hacer*: que la columna exista no prueba que la
  pantalla la lea— y que **el camino de lectura ya no fabrique `'manual'`**. ② **Comportamiento**,
  con la función que corre importada de `dist`, entrando por `filasDelInforme`, que es la MISMA
  puerta por la que entra el profesional.
* **SUELO** — el banco declara sus TRES poblaciones (con `Charge` · a mano CON método · a mano SIN
  método) y falla declarándose ciego si alguna sale vacía: con cero facturas con `paidVia`, «el
  método sale de `Invoice.paidVia`» sería trivialmente cierto.
* **Detectores AUTOPROBADOS** sobre fuente sintética, en los dos sentidos: el del `select` ve uno
  bueno, rechaza el que no pide `paidVia` y **distingue `paidVia: true` de `paidVia: false`**; el del
  `'manual'` ve el literal y **no marca la palabra dentro de un comentario** (mediría prosa).
* **CONTROL POSITIVO** — `paidVia = 'transfer'` se lee «🏦 Transferencia» en Informes y
  «transferencia» en Cobros, y cae en el MISMO cubo que el filtro. Y no sobre una muestra: **uno por
  uno sobre el conjunto cerrado entero**.
* **🔴 CONTROL NEGATIVO, el que protege el dinero** — una factura marcada a mano SIN método **no
  desaparece** (cuadra el nº de cobros y el importe), **no se cuela en otro cubo** (`sin-metodo`), las
  tres formas de la ausencia van a la MISMA fila, y la fila **lo dice**. Un cobro que desaparece de
  una pantalla de dinero es peor que uno mal etiquetado: al que no está no se le echa de menos.
* **EL INVARIANTE** — total del informe y nº de cobros idénticos antes y después, con control
  positivo dentro (se exige un mínimo de filas antes de creerse la igualdad, porque dos bancos
  vacíos también suman igual).
* **Guards ajenos, VERDES y sin tocar** (medido, `node --test` por fichero): SCRUM-398 **8 tests**,
  SCRUM-474 **6** —el trinquete de las 2 copias de la partición **sigue en 2**: este ticket no parte
  por «:»—, SCRUM-441 **18** (sus dos ficheros en `main`), y SCRUM-411 y SCRUM-494 en la tanda.
* **ROJO POR EL MECANISMO** — ⑥.

---

## ⑥ 🔴 LAS DOS MUTACIONES, Y LO QUE DESTAPÓ LA PRIMERA

Con la rama **ya en verde y commiteada** (`77b58a7e`), y cada mutación con su post-condición
comprobada (`git diff --stat` tenía que enseñar el fichero tocado, y lo enseñó las dos veces).

| mutación | qué se rompe | qué cae |
|---|---|---|
| **A** · el DOMINIO vuelve a devolver `'manual'` | la lectura | **9 tests**, entre ellos el SUELO, el invariante y el control negativo |
| **B** · la RUTA deja de pedir `paidVia` en el `select` | el cable | **1 test**: el AST, diciendo que el dato *«se ESCRIBE y no lo lee nadie»* |

El mensaje del rojo, literal, es el que pedía el encargo — no dice «falta un campo»:

```
🔴 LA COLUMNA DEL MÉTODO ESTÁ AFIRMANDO CÓMO SE REGISTRÓ EL COBRO. «Marcado a mano» contesta
quién lo apuntó, no por dónde entró el dinero: el profesional que eligió «Bizum» al marcar la
factura ve su informe contestándole otra pregunta. Filas pintadas hoy:
    manual             «✍️ Marcado a mano»
    card               «💳 Tarjeta»
```

**Control negativo del experimento:** SCRUM-398 y SCRUM-488 siguen **VERDES** con las dos mutaciones
puestas — ni un rótulo ni una agrupación han cambiado, que es justo lo que no tienen que detectar.

> 🔴 **LO QUE DESTAPÓ LA MUTACIÓN A, y por eso se hace en vez de razonarla.** En su primera versión
> tiró **8** tests de comportamiento y **dejó el detector de AST en VERDE**: el escáner del
> `'manual'` miraba solo `reports.routes.ts`, y la mutación estaba en el dominio. Un escáner que
> cubre media superficie da un verde que no significa lo que parece. Ahora recorre **el camino de
> lectura entero** —ruta y dominio, declarados en una constante con su propio suelo— y al repetir la
> mutación caen **9**, incluido él. Es exactamente el hueco que SCRUM-488 fase 2 dejó declarado ayer
> (⑦.10 de su entrada); aquí se estrecha.

---

## ⑦ FICHEROS, Y LO QUE NO SE TOCA

### ⑦.1 Lo que cambia

* `src/modules/billing/domain/metodoDeCobro.ts` — **+1 export**: `metodoDeclaradoEnFactura`, la
  normalización de LECTURA, al lado de la de escritura. Vive aquí y no en el informe porque **las dos
  pantallas que enseñan cobros tienen que leerlo igual**.
* `src/modules/reports/domain/cobrosPorCubo.ts` — `metodoDelCobro`, `seRegistroAMano` y
  `filasDelInforme`. La superficie pública del módulo pasa a ser **solo `filasDelInforme`**, que es
  lo que llama la ruta; `agruparCobrosPorCubo` deja de exportarse (lo pidió el guard de SCRUM-411, y
  es el patrón que SCRUM-494 acaba de escribir en el guard esta misma tarde).
* `src/modules/reports/app/routes/reports.routes.ts` — pide `paidVia` en el `select`, delega, y
  devuelve `marcadosAMano`.
* `tests/scrum491-metodo-y-registro.test.mjs` (**nuevo, 12 tests**).
* `tests/scrum488-un-solo-vocabulario.test.mjs` — entra por la puerta nueva; su detector de la ruta
  aprende la desestructuración y **se autoprueba en las dos formas** que la ruta ha tenido.

### ⑦.2 🔴 Lo que NO se construye, y por qué

**La mitad de Cobros ya está construida y no se reescribe.** `scrum-441-cobros-leen-paid-via`
(`c2e540d3`, Luis, hoy 12:56 +0200) hace que `cobros.service.ts` lea `Invoice.paidVia`. Rehacerlo
aquí sería trabajo duplicado y un conflicto seguro en el fichero que —dicho por su propio commit—
«tres carriles se disputan esta semana» (regla 9).

Para que «el método sale IGUAL en las dos pantallas» sea cierto **del mismo sitio** y no por
casualidad, `metodoDeclaradoEnFactura` tiene la **semántica idéntica** a la de su `metodoDeclarado`
privado. Mientras esa rama no entre, las dos pantallas hacen lo mismo por dos sitios; cuando entre,
**Cobros consume ésta y la copia desaparece en una línea**. Queda escrito en el propio módulo.

### ⑦.3 Lo que no se toca

`prisma/schema.prisma` (la columna ya existe: aquí solo se LEE) · `paidViaEtiquetas.js` y el guard
de SCRUM-398 · el valor crudo del «no reconocido» (SCRUM-486/489) · el desborde de la caja de 150 px
con un valor largo, que sigue declarado y fuera.

---

## ⑧ Verificación de la tanda

Con `main` (`94739993`) dentro, `npx prisma generate` corrido **en este worktree** y la tanda lanzada
**después del último cambio de código y de la última edición de este documento**.

| | ficheros | tests | pass | fail | skipped |
|---|---|---|---|---|---|
| **línea base** (el conjunto que declara `main`, sobre este árbol) | 447 | **3.429** | **3.352** | **0** | **77** |
| **después** (tanda entera, `npm test`) | 448 | **3.441** | **3.364** | **0** | **77** |
| diferencia | +1 | **+12** | **+12** | **0** | **0** |

* `npm run guards:entrada` — **17 tests, 4 guards, 0 fallos**.
* **Ni un salto nuevo**: los 77 `skipped` son los mismos antes y después.
* La línea base se mide con el conjunto que `main` declara (`git ls-tree`), sobre este árbol y **sin
  borrar ficheros del disco**. El único fichero de más es `scrum491-…`, con sus 12 tests.

---

## ⑨ Huecos DECLARADOS

* **Cuántas facturas tienen `paidVia` hoy: NO SE HA CONTADO.** Pide una consulta contra producción y
  no es de este carril. Lo que sí es seguro por construcción: ninguna anterior a SCRUM-441.
* **«Las dos pantallas, del mismo sitio» está a un merge de distancia.** Hoy Informes lee la columna
  y Cobros solo la lee en `c2e540d3`, sin mergear. La semántica es idéntica a propósito, pero
  mientras haya dos funciones hay dos sitios donde divergir. La unificación es una línea y está
  escrita en el módulo.
* **DÓNDE se enseña el registro: parado, es del asesor.** Con propuesta y con guard (④).
* **No se ha verificado en `yaqu.app`**: el cambio no está desplegado —el merge del PR lo hace un
  humano—. Lo que hay es la pantalla pintada en banco de un solo uso con los ficheros reales de
  `public/`, y `fmtMoneyEs` sustituido por un `Intl.NumberFormat` equivalente porque `api.js` no se
  puede cargar suelto (lo que se mide es la columna de la etiqueta, que sí la resuelve la vista real).
* **El cable ruta→dominio lo ata un solo instrumento** (el AST del `select`): la mutación B tiró ese
  test y solo ése. Cerrarlo de verdad pide ejercer `GET /admin/reports/x2` contra una base, que es
  suite gateada y otro ticket.

---

## ⑩ Fuera de carril (una línea cada uno, no se arreglan aquí)

* **`desconocido` en `Invoice.paidVia` se pintaría «⚠️ Método no reconocido (desconocido)»**, cuando
  es un valor DECLARADO y bien definido —«se preguntó y no consta»—: `paidViaEtiquetas.js` no lo
  conoce. Es rótulo, o sea SCRUM-398.
* **El heredado `manual` de `paidViaEtiquetas.js` se queda sin productor**: su procedencia declarada
  es «lo fabrica `reports.routes.ts:164` al leer», y eso deja de ser cierto con este ticket. **Cómo
  se contó:** `grep` del literal `'manual'` en todo `src/` fuera de `reports/` → **1 sola aparición,
  y también es una LECTURA** (`invoicesAdmin.routes.ts:332`); ningún escritor guarda ese valor. No se
  retira —su guard lo exige y una base puede traerlo escrito—, pero su comentario envejece hoy.
* **El mismo defecto, en otra pantalla**: `invoicesAdmin.routes.ts:332` pinta
  `invoice.charge?.method ?? 'manual'` en el detalle de factura del panel de administración — el
  REGISTRO otra vez en la fila del «Método», y ahí tampoco se lee `Invoice.paidVia`. Es superficie de
  admin, no del profesional, y va por su carril.
