# SCRUM-499 · El registro tiene sitio, y las TRES pantallas leen el método por el mismo sitio

**Medido contra:** `origin/main` = `01025aafdb065b682f0da1b70141aa7baebf3a4f` · 2026-08-12T13:32:35+02:00

**12-ago-2026** · **Carril:** Cobros / Informes / Admin · **Gate:** sin gate, corre en `npm test`

**LA VÍCTIMA:** el profesional ya no ve «marcado a mano» donde no iba —eso lo arregló SCRUM-491—
pero tampoco lo ve en ningún sitio; y en el paquete de disputa que le manda al banco seguía leyendo
lo de antes.

Cierra **los dos huecos que SCRUM-491 dejó declarados** en su ⑨.

---

## ① EL PASO 0 · la pregunta que decidía el alcance de hoy

`main` se movió de `84f60528` a `01025aaf` durante el ticket (dos veces; en una entró **mi propio
SCRUM-491**, lo que dejó el diff limpio). La línea base se re-midió después del último merge.

### 🔴 ¿Está `scrum-441-cobros-leen-paid-via` en `main`? **SÍ** — y por eso hoy se hace el hueco 2

| vía | resultado |
|---|---|
| `git merge-base --is-ancestor c2e540d3 main` | **0** (es ancestro) |
| **contenido** · `git grep -E "inv\.paidVia\|paidVia: true" main -- cobros.service.ts` | **2 aciertos** (`:270` y `:271`): la lectura real está en `main` |
| el MISMO patrón en `src/modules/reports/` y `src/modules/system/` de `main` | **cero** — discrimina |
| control positivo · el mismo patrón sobre `origin/scrum-491-…` | **2 aciertos** — sabe encontrar una lectura cuando la hay |

🔸 El patrón está afinado a propósito. `paidVia|paid_via` a secas casa con un **comentario** de
`reports.routes.ts` que está en todas las ramas: acierta siempre y por tanto no discrimina nada. Es
la lección que dejó medida el paso 0 de SCRUM-491.

**Ninguna otra rama remota toca `invoicesAdmin.routes.ts` ni `cobros.service.ts`** por delante de
`main` (`git log --all -S` sobre los dos ficheros: el commit más reciente de cada uno ya está
dentro). La rama de Luis solo conserva un merge de `main` posterior (`fd9e40b1`, 13:19 +0200) **sin
trabajo nuevo**: `git log main..origin/scrum-441-cobros-leen-paid-via` está vacío.

### Las dos premisas, ciertas

* `marcadosAMano` viaja sin pintarse y con su guard (`reports.routes.ts:221` · el test de
  SCRUM-491 ⑤); ninguna aparición en `public/`.
* `invoicesAdmin.routes.ts:332` seguía con `invoice.charge?.method ?? 'manual'` en `main`.

---

## ② HUECO 1 · EL REGISTRO TIENE SITIO

SCRUM-491 sacó «marcado a mano» de la columna del MÉTODO —donde contestaba otra pregunta— y lo dejó
viajando **sin pintar**, esperando al asesor. Ya está aprobado: **un PIE bajo la lista**.

**Microcopy APROBADA (regla 30), literal:**

```
Marcados a mano: {n} cobros · {importe}
Marcado a mano: 1 cobro · {importe}        ← singular
                                           ← con CERO, el pie NO se pinta
```

### 🔴 Por qué un PIE y no una fila — y no es estética

Es una propiedad del **CONJUNTO**, no de ninguna fila. Esos euros **YA están repartidos** entre las
filas de arriba, cada uno por su método: una fila más se leería como un método y el profesional que
sume la columna se llevaría de más. Fuera de la lista no se puede confundir con dinero que se cuenta
dos veces — y hay un test que lo comprueba con los números delante (el importe del pie tiene que ser
un subconjunto estricto del total de las filas).

**Con cero no se pinta**, mismo criterio que la celda vacía de Cobros (SCRUM-285): un hecho que no
existe no ocupa sitio hablando de sí mismo. `undefined` —un servidor que todavía no manda el campo—
se comporta igual que el cero: la pantalla no inventa un «0 cobros».

### ⚠️ El marcador CAMBIA DE SENTIDO, no desaparece

El guard de SCRUM-491 ⑤ exigía que la vista **NO** nombrase `marcadosAMano` mientras el asesor
decidía. Ahora exige lo contrario: que **lo pinte por la función del pie**, **una sola vez**, y que
**no aparezca dentro del bloque de filas**. Un marcador que se borra al cumplirse deja de proteger
lo que protegía — sin él, mañana el registro puede volver a ser una fila.

🔸 Y su recorte del bloque de filas termina en el `.join('')` de las filas, no en la siguiente
declaración: entre medias vive el comentario que explica por qué el pie no es una fila, y nombrarlo
ahí no lo convierte en una. Un recorte generoso mediría la prosa en vez del código — lo destapó su
primer rojo.

---

## ③ HUECO 2 · LA TERCERA PANTALLA, Y LA UNIFICACIÓN QUE LA HACÍA POSIBLE

Se hace **en el orden que fijaba el encargo**, porque la condición se cumple:

1. **Unificar.** `cobros.service.ts` tenía una copia privada de la normalización, escrita con
   semántica idéntica a la de `metodoDeCobro.ts` **a propósito** (SCRUM-491), para que unificarlas
   fuese una línea el día que las dos ramas estuvieran en `main`. Ese día era hoy: se retira.
2. **Subir la regla entera.** `metodoDeUnCobro` (en el módulo compartido) contesta «¿por dónde entró
   el dinero?»: `Charge.method` manda · `null`/`''`/ausente son la misma ausencia · sin backfill.
3. **Cablear la tercera pantalla.** `invoicesAdmin.routes.ts:332` deja de pintar
   `charge?.method ?? 'manual'`.

**Las tres pantallas llaman ahora a `metodoDeUnCobro`:** Cobros (`cobros.service.ts`), Informes
(`reports/domain/cobrosPorCubo.ts`) y el paquete de evidencia de disputa.

### 🔴 UN CASO QUE NO ENCAJABA, RESUELTO Y DICHO: el rótulo del paquete de disputa

El encargo fijaba que la ausencia se lee «⚠️ Sin método», el rótulo que `paidViaEtiquetas.js` ya da.
**En esta pantalla no se puede, y no traducir el método es además lo correcto:**

* **Es un documento PROBATORIO que se le manda a un banco** (`GET /admin/invoices/:id/dispute-package`,
  HTML imprimible). Ahí el valor CRUDO es lo que se cruza: traducir `card:stripe` a «💳 Tarjeta»
  **destruiría la pasarela** justo donde hace falta. Las dos filas hermanas de esa misma tabla
  (`intentId`, `status`) también van crudas a propósito.
* **`paidViaEtiquetas.js` vive en `public/` y `src/` NO importa de `public/`** — medido sobre todo el
  árbol: **cero importaciones**, solo tres menciones en comentarios (`csv.ts`, `ai.service.ts`,
  `lineasFacturables.ts`). Copiar el literal a `src/` sería la segunda copia del texto, que es el
  defecto que este carril lleva tres tickets cerrando.

**Resuelto así:** el método se pinta CRUDO, como hasta hoy, y **solo la AUSENCIA se dice con
palabras**, con `ROTULO_SIN_METODO` («Método no registrado») — que **ya vive una sola vez**, está
aprobado por el asesor (SCRUM-474, 10-ago-2026, regla 30) y es importable desde `src/`. No se
inventa microcopy ni se toca el diccionario de SCRUM-398.

🔸 Deja una asimetría de redacción entre las tres pantallas para la misma afirmación —Cobros y la
disputa dicen «Método no registrado», Informes «⚠️ Sin método»—. Ya estaba declarada en SCRUM-491 y
sigue siendo microcopy: unificarla la aprueba el asesor.

---

## ④ 🔴 LA PANTALLA, MEDIDA PINTADA

Banco de un solo uso con `reportsView.js` y `paidViaEtiquetas.js` **reales** servidos del disco y el
`loadX2` de verdad; textos leídos del DOM. Evidencia:
`docs/master/evidencias/scrum499/scrum499-pie-del-registro.png`.

| caso | filas | pie |
|---|---|---|
| **ANTES** (SCRUM-491: el campo viaja, la vista no lo mira) | 💳 6.080,55 (16) · 📲 1.050,50 (7) · 🏦 600,00 (1) · ⚠️ 100,00 (1) | **ninguno** |
| **DESPUÉS** · plural | **idénticas** | **«Marcados a mano: 3 cobros · 900,00 €»** |
| **DESPUÉS** · singular | 💳 500,00 (2) · 💶 75,50 (1) | **«Marcado a mano: 1 cobro · 75,50 €»** |
| **DESPUÉS** · cero marcados a mano | 💳 900,00 (3) | **ninguno** |

**Las filas son IDÉNTICAS antes y después**: el pie no toca el reparto. Y los 900,00 € del pie son
los mismos euros que ya están repartidos arriba (600 en Transferencia, 200 en Bizum, 100 en Sin
método), no un importe nuevo.

---

## ⑤ VERIFICACIÓN

* **EL PIE SE EJERCE, no se busca con una regex.** `reportsView.js` exporta `pieDeMarcadosAMano`
  —mismo patrón que `cobrosView.js` y `paidViaEtiquetas.js`— y la tanda le pasa el singular, el
  plural, el cero, el `undefined` y el `count: null`. Una regex dice que el texto está escrito; no
  que se pinte cuando toca.
* **«No aparece con cero» y «no aparece nunca» son cosas distintas**, y el mismo test comprueba las
  dos: sin la segunda, un pie roto pasaría por «bien, con cero no se pinta».
* **EL DETECTOR CUBRE EL CAMINO ENTERO** — tres pasos: el dominio lo CUENTA, la ruta lo DEVUELVE, la
  vista lo PINTA. Con el escáner atado a un solo fichero, dos de esos tres fallos pasarían en verde:
  es exactamente lo que midió la mutación A de SCRUM-491 (8 tests caídos y el AST en verde). El
  mensaje dice **cuál** de los tres se ha roto, no «alguno».
* **«DEL MISMO SITIO» SE MIDE, no se afirma.** Que tres pantallas coincidan hoy prueba que tres
  funciones parecidas coinciden. Se comprueba por **AST autoprobado** que las tres **LLAMAN** a
  `metodoDeUnCobro` —una importación sin llamada no vale: mencionar no es hacer— y que la copia
  privada no ha vuelto; y por **comportamiento**, cada pantalla por su puerta real:
  `filasDelInforme`, `fundirCobros` y la cadena que se pinta en el HTML.
* **CONTROL POSITIVO** — `paidVia = 'transfer'`: Cobros dice `transfer` y lo pone en el cubo
  `transfer`, Informes lo clasifica igual y lo pinta «🏦 Transferencia», y la disputa pinta
  `transfer`. Y el cubo de Cobros y el de Informes se comparan entre sí, que es lo que de verdad
  tiene que coincidir.
* **🔴 CONTROL NEGATIVO, el que protege el dinero** — las **cuatro** formas de la ausencia (`null`,
  `''`, `'   '`, ausente) sobre las **tres** pantallas: no desaparece ninguna, ninguna se cuela en
  otro cubo, y las tres lo dicen. Un cobro que desaparece de una pantalla de dinero es peor que uno
  mal etiquetado: al que no está no se le echa de menos. Y **sin backfill**: la factura de al lado
  no le contagia su método.
* **EL INVARIANTE** — total e importe idénticos antes y después, en Informes y en Cobros, con
  control positivo dentro (se exige un mínimo de filas antes de creerse la igualdad: dos bancos
  vacíos también suman igual).
* **SUELO** — si no se leen las tres pantallas, los tres pasos del camino o la función del pie, el
  fichero **se declara ciego** en vez de dar verde.
* **Guards ajenos, VERDES**: SCRUM-398, 474 (el trinquete **sigue en 2 copias**: nada de esto parte
  por «:»), 488, 494 y 411 — **sin relajar ninguno**. Los dos que hubo que tocar se APRIETAN, no se
  aflojan (⑦).

---

## ⑥ 🔴 LAS DOS MUTACIONES

Con la rama **ya en verde y commiteada** (`3b6124c2`), cada una con su post-condición comprobada
(`git diff --stat` tenía que enseñar el fichero tocado, y lo enseñó las dos veces).

| mutación | qué se rompe | qué cae |
|---|---|---|
| **A** · la vista deja de pintar el pie (`pieMarcados = ''`) | el último paso | **2 tests**: el camino —nombrando `reportsView.js (lo PINTA)`— y el marcador de SCRUM-491 |
| **B** · el dominio deja de contar (`marcadosAMano: {count:0, eur:0}`) | el primer paso | **4 tests**: el SUELO de SCRUM-491, «el registro NO se borra», «el pie no es una fila» y el invariante |

El mensaje del rojo de la mutación A, literal:

```
🔴 EL REGISTRO HA DEJADO DE CONSTAR: se ha roto un paso del camino y el pie no llega a la
pantalla → public/dashboard/js/reportsView.js (lo PINTA).
  Cuántos cobros apuntó una PERSONA en vez de una pasarela es un hecho real y útil, y hasta
  SCRUM-491 se enseñaba en el sitio equivocado —la columna del método—. Quitarlo del pie no lo
  devuelve a su sitio: lo borra de la pantalla.
```

**Control negativo del experimento:** SCRUM-398 sigue verde con las dos puestas — ningún rótulo ha
cambiado, que es justo lo que no tiene que detectar.

🔸 **Y lo que enseña el reparto de los rojos**, dicho porque es la parte útil: la mutación B **no**
tira el detector del camino, porque el fichero **sigue nombrando** `marcadosAMano` —la regex mide
que el paso existe, no que cuente bien— y son los cuatro de comportamiento los que la cazan. Los dos
instrumentos se cubren en sitios distintos y por eso hacen falta los dos: ninguno solo cubre las dos
mutaciones.

---

## ⑦ Los guards que hubo que tocar, y en qué dirección

* **SCRUM-491 ⑤** — cambia de sentido (②). Más exigente que antes: ya no basta con «no lo nombres»,
  ahora hay que nombrarlo **una vez, por la función del pie, y fuera del bloque de filas**.
* **SCRUM-441 fase 2** — exigía en el fuente `metodo: metodoDeclarado(inv.paidVia)`, y ese nombre ha
  dejado de existir. **Se APRIETA**: exige la lectura COMPARTIDA (`metodoDeUnCobro`) **y además**
  que la copia privada no vuelva. Donde antes pedía «pasa por el normalizador», ahora pide «pasa por
  el normalizador que usan las otras dos».
* **SCRUM-411/494** volvió a corregirme: al subir la regla a `metodoDeUnCobro`,
  `metodoDeclaradoEnFactura` se quedó sin importador de fuera. El guard aconseja des-exportar en vez
  de declarar, y eso se hizo; el test de SCRUM-491 entra ahora por el contrato.

## ⑧ Ficheros

* `public/dashboard/js/reportsView.js` — el pie, en una función exportada.
* `src/modules/billing/domain/metodoDeCobro.ts` — `metodoDeUnCobro` (la lectura única);
  `metodoDeclaradoEnFactura` deja de exportarse.
* `src/modules/billing/domain/cobros.service.ts` — se retira la copia privada; consume la única.
* `src/modules/reports/domain/cobrosPorCubo.ts` — la regla ya no vive aquí: solo se traduce a la
  clave de agrupación.
* `src/modules/system/app/routes/invoicesAdmin.routes.ts` — la tercera pantalla.
* `tests/scrum499-el-registro-tiene-sitio.test.mjs` (**nuevo, 11 tests**).
* `tests/scrum491-…` y `tests/scrum441-cobros-leen-paid-via.test.mjs` — ⑦.
* `docs/master/evidencias/scrum499/scrum499-pie-del-registro.png`.

**Lo que NO se toca:** `prisma/schema.prisma` · `paidViaEtiquetas.js` y el diccionario de SCRUM-398 ·
el trinquete de las 2 copias · los ficheros de SCRUM-495/497.

## ⑨ Verificación de la tanda

Con `main` (`01025aaf`) dentro, `npx prisma generate` y `dist/` reconstruido **en este worktree**, y
la tanda lanzada **después del último cambio de código y de la última edición de este documento**.

| | ficheros | tests | pass | fail | skipped |
|---|---|---|---|---|---|
| **línea base** (el conjunto que declara `main`, sobre este árbol) | 450 | **3.453** | **3.376** | **0** | **77** |
| **después** (tanda entera, `npm test`) | 451 | **3.464** | **3.387** | **0** | **77** |
| diferencia | +1 | **+11** | **+11** | **0** | **0** |

* `npm run guards:entrada` — **17 tests, 4 guards, 0 fallos**.
* **Ni un salto nuevo**: los 77 `skipped` son los mismos antes y después.
* Los tres tests que se modificaron (⑦) no cambian el recuento: son los mismos, más duros.

## ⑩ Huecos DECLARADOS

* **No se ha verificado en `yaqu.app`**: el cambio no está desplegado —el merge del PR lo hace un
  humano—. Lo que hay es la pantalla pintada en banco de un solo uso con los ficheros reales de
  `public/`, y `fmtMoneyEs` sustituido por un `Intl.NumberFormat` equivalente porque `api.js` no se
  puede cargar suelto. Que el importe salga por el formateador de la casa —con su espacio duro antes
  del «€»— sí se comprueba en la tanda.
* **El paquete de disputa no tiene función pura**: su HTML se construye inline en la ruta, así que se
  mide por AST (que llama a la lectura única y que ya no fabrica `manual`) y por el comportamiento de
  la función que pinta. Ejercer la ruta entera pediría una base, que es suite gateada.
* **La redacción del «no consta» sigue sin unificar** entre las tres pantallas (③). Es microcopy.

## ⑪ Fuera de carril (una línea cada uno)

* `desconocido` en `Invoice.paidVia` se pintaría «⚠️ Método no reconocido (desconocido)» siendo un
  valor DECLARADO y bien definido —«se preguntó y no consta»—: es rótulo, o sea SCRUM-398.
* En el árbol apareció un fichero suelto sin seguir, **`how f11e445e`** (502 bytes, 12:37, contenido:
  la salida de un `git show` con commits de SCRUM-496). No es de este carril, **no se toca ni se
  borra**, y se reporta para que su dueño lo recoja.
