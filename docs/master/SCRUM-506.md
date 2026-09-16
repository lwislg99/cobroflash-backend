# SCRUM-506 · Cobros deja de llamar «no registrado» a lo que sí consta, y el censo de 488 vuelve a 4

**Medido contra:** `origin/main` = `6193be8069b2a812cf90c14213b19f8735cb5f1f` · 2026-08-12T13:24:21+01:00

**12-ago-2026** · **Carril:** Cobros · **Gate:** sin gate, corre en `npm test`

**LA VÍCTIMA:** SCRUM-503 hizo que Informes distinguiera tres estados, y Cobros metía dos de ellos
en el mismo saco: el mismo cobro volvía a leerse distinto en dos pantallas, que es lo que SCRUM-488
cerró.

---

## ① EL PASO 0 · y casi paro por una medición que caducó en el minuto siguiente

🔴 **Esto merece contarse porque estuve a un paso de entregar una parada falsa.**

| medición | resultado |
|---|---|
| `git rev-parse main` antes y después de `git fetch origin main:main` | **`3ddd2d2e` las dos veces**: no se movió |
| `git grep "desconocido: '" main -- paidViaEtiquetas.js` | **cero** → *«mi SCRUM-503 no está: PARO»* |
| control positivo del mismo instrumento, mismo fichero (`manual: '✍️ Marcado a mano'`) | **1 acierto** → no era un escáner ciego |
| `merge-base --is-ancestor a036cb2c main` | **1** → no es ancestro |

Con eso iba a parar. Antes de hacerlo seguí midiendo el (b) y **dos lecturas se contradijeron**:
`git show main:paidViaEtiquetas.js` **SÍ** traía la entrada. Antes de concluir nada, la pregunta de
la casa: ¿difieren en instrumento o en **tiempo**? En tiempo:

```
git rev-parse main  →  da72f0a6      (ya no 3ddd2d2e)
```

**`main` se movió entre mis dos comandos.** Los cuatro worktrees comparten refs y otra sesión hizo
fetch en medio. Re-medido contra el `main` de ese instante: `merge-base` → **0**, y el contenido →
`paidViaEtiquetas.js:85`. **SCRUM-503 sí estaba**, y la parada habría sido falsa por unos segundos.

🔸 La lección no es «mide dos veces»: es que **una contradicción entre dos mediciones se resuelve
antes de concluir**, y que en este repo la primera sospecha tiene que ser el reloj.

### Las otras tres

* **(b) LA PREMISA, CIERTA**: el censo de SCRUM-488 sobre `main` declara **5 divergencias**, y
  `desconocido` es una de ellas — leídas una a una del fichero, no del recuento.
* **(c) y (d)**: todos los commits que tocan `cobrosView.js` o el vocabulario de Cobros
  (`ROTULO_SIN_METODO`, `COBROS_MATICES`) **están ya en `main`**, salvo uno: `8f3fb9dd`
  («SCRUM-474 fase 2 + SCRUM-481 (INCOMPLETO — NO MERGEAR): 5 rojos vivos», Luis, 12-ago 09:40
  +0200), marcado como no mergeable por su propio autor y sustituido por `72b62e8f`/`8a8d956a`, que
  sí están dentro. Control positivo del pickaxe: encuentra los 4 commits que han tocado
  `COBROS_MATICES`, así que sabe encontrar cuando hay.

---

## ② LOS DOS HECHOS, Y NO SON EL MISMO

| dentro del cubo `sin-metodo` | qué es | cómo se lee ahora |
|---|---|---|
| `null`, `''`, ausente | **NADIE registró nada.** Un hueco, y no se sabrá nunca | «Método no registrado» *(intacto)* |
| `desconocido` | **El sistema SÍ dejó constancia**: el cobro nació en una pasarela que todavía no sabía con qué iba a pagar el cliente (SCRUM-486/489) | **«Método sin especificar»** *(nuevo)* |

Uno es un hueco y el otro es un dato. Llamarlos igual le dice al profesional que de ese cobro no
consta nada, cuando lo que consta es justo que no se sabe. Es la misma distinción que separó el
MÉTODO del REGISTRO (SCRUM-491) y el desconocido del ERROR (SCRUM-503).

**Con las MISMAS PALABRAS que Informes**, y sin emoji porque Cobros no los usa: usar otras aquí
habría recreado la divergencia que este ticket cierra.

### 🔴 UN CUBO, DOS RÓTULOS — el filtro no se toca

`desconocido` no está en `PAID_VIA`, así que el servidor lo sigue metiendo en `sin-metodo` y **la
barra sigue teniendo UNA sola pestaña**. Es la decisión que ya tomó SCRUM-285 con Bizum —**filtrar
por cuatro, leer los cinco**—: la distinción se **LEE** en la fila, no se **OFRECE** como filtro.
Ofrecerla obligaría a ampliar el conjunto cerrado (regla 22) para un valor que no es un método.

El arreglo es **una bifurcación en `rotuloDeMetodo`**, exactamente donde los dos hechos se fundían:
la línea que devolvía el rótulo del cubo sin mirar el valor crudo.

### ⚠️ El literal está copiado del backend, y consta

El frontend es vanilla y **no puede importar de `src/`** —medido en SCRUM-499: cero importaciones en
todo el árbol—, así que la copia es la única salida. **No se queda sin vigilar**: el test compara
`COBROS_DESCONOCIDO.valor` con `METODO_DESCONOCIDO` importado de `dist`, o sea **las dos fuentes de
verdad**, no una expectativa escrita a mano. Si el backend renombra su constante, esto cae.

---

## ③ 🔴 EL NÚMERO QUE DECIDE: el censo de SCRUM-488 baja de 5 a 4

| | divergencias | cuáles |
|---|---|---|
| **antes** (`main`) | **5** | `bizum_auto` · `bizum_manual` · `card:stripe` · `manual` · **`desconocido`** |
| **después** | **4** | `bizum_auto` · `bizum_manual` · `card:stripe` · `manual` |

**Y no basta con quitarlo de arriba.** El reverso del mismo censo exige declarar **dónde ha ido**:
`desconocido` aparece ahora en la lista de los que las dos pantallas ya dicen igual
(`['card','transfer','cash','desconocido']`). Sin esa mitad, «se ha unificado» y «se ha caído del
corpus» darían el mismo 4 — que es exactamente el modo de fallo que el guard existe para impedir.

🔸 **Un recuento que baja es sospecha, no mejora.** Aquí la bajada es legítima y se puede comprobar
por otro lado: el test de SCRUM-506 exige que los dos rótulos existan, sean **distintos entre sí** y
**compartan cubo**. Si alguien «arreglara» la divergencia borrando el rótulo nuevo, aquel test cae
antes que el censo.

---

## ④ VERIFICACIÓN

* **CONTROL POSITIVO, las dos cosas EN EL MISMO TEST**: rótulos distintos **y** misma pestaña. Cada
  una por su lado se cumpliría con el ticket a medio hacer — rótulos distintos sin misma pestaña
  sería una pestaña nueva (STOP 1); misma pestaña sin rótulos distintos es el defecto de partida.
  Se comprueba además que la barra sigue teniendo **las mismas cinco claves** que antes.
* **🔴 CONTROL NEGATIVO, el que protege el dinero** — ejercido sobre `fundirCobros`, la fusión de
  verdad: ninguno de los dos desaparece, ninguno se cuela en otro cubo, y **al filtrar por esa
  pestaña salen los dos y se distinguen al leerlos**. Un cobro que desaparece de una pantalla de
  dinero es peor que uno mal etiquetado: al que no está no se le echa de menos.
* **EL INVARIANTE** — importe total de Cobros y del informe idénticos antes y después, con control
  positivo dentro. Un rótulo no mueve dinero.
* **EL LITERAL ATADO** a la constante del backend (②), con control negativo del reconocedor: no
  marca `null`, `''`, `'desconocida'`, `'card'`, `42` ni `'no-consta'`.
* **🔴 LA PANTALLA PINTADA, y con la herramienta de la casa** — ⑥.
* **ROJO POR EL MECANISMO** — ⑤.
* **Guards ajenos, VERDES** (medido, `node --test` por fichero): SCRUM-398 **8**, SCRUM-474 —el
  trinquete de las 2 copias **sigue en 2**— **6**, SCRUM-285 y SCRUM-503 en la tanda. Los dos que
  hubo que tocar se **aprietan** (⑦).

---

## ⑤ 🔴 LAS DOS MUTACIONES

Con la rama **ya en verde y commiteada** (`6c364f12`), y **sobre el VALOR de la clave, nunca
borrando la línea por regex** — la lección que dejó medida SCRUM-503: una mutación que rompe la
sintaxis no mide el defecto, mide otra cosa. Post-condición comprobada las dos veces: `git diff
--stat` → 1 línea.

| mutación | qué cae |
|---|---|
| **A** · el rótulo vuelve al de la ausencia | **6 tests**: cuatro de SCRUM-506, el censo de 488 y el control negativo de 481 |
| **B** · el literal se desata del backend (`desconocido` → `no-consta`) | **6 tests**, entre ellos el que ata las dos fuentes |

Los mensajes, literales — ninguno dice «falta un rótulo»:

```
🔴 COBROS dice «Método no registrado» e INFORMES «⚠️ Método sin especificar». El mismo cobro,
dos pantallas, dos lecturas — que es lo que SCRUM-488 cerró.

🔴 Cobros reconoce «no-consta» y el backend declara «desconocido». La copia del literal se ha
quedado atrás, y entonces el desconocido vuelve a leerse como un hueco sin que nadie se entere.
```

Y el censo de 488, con la mutación A puesta, vuelve a nombrarlo:
`desconocido    COBROS «Método no registrado»  ·  INFORMES «⚠️ Método sin especificar»`.

---

## ⑥ LA PANTALLA PINTADA — y la herramienta la puso la casa

Los tres tickets anteriores midieron la pantalla con un banco de un solo uso: servidor propio +
navegador. **Aquí no hacía falta**: `tests/_banco-vistas.mjs` monta la vista de Cobros entera, es lo
que ya usa SCRUM-481, y **corre dentro de `npm test`** — o sea que la evidencia no es una captura de
hoy, es un guard que se ejecuta en cada tanda. Gana la herramienta de la casa.

Leído de la tabla pintada, con la respuesta del servidor de verdad:

| celda de la columna MÉTODO | de qué cobro |
|---|---|
| **Método sin especificar** | `paid_via = desconocido` |
| **Método no registrado** | sin método |
| transferencia | `transfer` |

Con control positivo del instrumento: se exige que se lean **tantas celdas como cobros**, porque una
lista vacía haría verdad cualquier «no se confunden».

---

## ⑦ Los guards que hubo que tocar, y en qué dirección

* **SCRUM-481** tenía `desconocido` en su lista de HUÉRFANOS, exigiéndole el rótulo de la ausencia.
  **Sale de ahí** —no es un huérfano, es una declaración— y el guard **se aprieta**: lo que ese
  control negativo protege de verdad (que no desaparezca y no se cuele en otro cubo) se mantiene
  para los dos grupos, **más una exigencia nueva**: que sus rótulos no se confundan entre sí.
* **SCRUM-488** — el censo baja a 4 (③), con su motivo escrito y declarando dónde ha ido.

## ⑧ Ficheros

* `public/dashboard/js/cobrosView.js` — `COBROS_DESCONOCIDO`, `esDesconocidoDeclarado` y la
  bifurcación en `rotuloDeMetodo`.
* `tests/scrum506-cobros-distingue-el-desconocido.test.mjs` (**nuevo, 9 tests**).
* `tests/scrum481-…` y `tests/scrum488-…` — ⑦.

**Lo que NO se toca:** `prisma/schema.prisma` · `PAID_VIA` · el diccionario de SCRUM-398 · el filtro
y sus pestañas · el paquete de evidencia de disputa (comprobado que sigue sin traducir) · el
selector · lo de SCRUM-501 y SCRUM-505.

## ⑨ Verificación de la tanda

Con `main` (`6193be80`) dentro, `npx prisma generate` y `dist/` reconstruido **en este worktree**, y
la tanda lanzada **después del último cambio de código y de la última edición de este documento**.

| | ficheros | tests | pass | fail | skipped |
|---|---|---|---|---|---|
| **línea base** (el conjunto que declara `main`, sobre este árbol) | 460 | **3.535** | **3.458** | **0** | **77** |
| **después** (tanda entera, `npm test`) | 461 | **3.544** | **3.467** | **0** | **77** |
| diferencia | +1 | **+9** | **+9** | **0** | **0** |

* `npm run guards:entrada` — **17 tests, 4 guards, 0 fallos**.
* **Ni un salto nuevo**: los 77 `skipped` son los mismos antes y después.
* Los dos tests ajenos que se modificaron no cambian el recuento: son los mismos, más duros.

## ⑩ Huecos DECLARADOS

* **La asimetría del selector sigue abierta**: su opción se llama «Sin especificar» y escribe `null`
  —que ahora se lee «Método no registrado»—, mientras que el rótulo «Método sin especificar» es el
  del valor que el selector NO produce. Los dos textos son ciertos; que se parezcan al revés es
  microcopy y estaba fuera de este carril por instrucción expresa.
* **Cuántos cobros tienen `desconocido` hoy en producción: no contado.** Pide consulta a la base.
* **No se ha verificado en `yaqu.app`**: sin desplegar. Lo que hay es la tabla pintada por el banco
  de la casa, que además corre en cada tanda.

## ⑪ Fuera de carril (una línea cada uno)

* Sigue en el árbol el fichero suelto **`how f11e445e`** (502 bytes, salida de un `git show` con
  commits de SCRUM-496), ya reportado en SCRUM-499 y SCRUM-503. No es de este carril y no se toca.
* Sigue el **`git stash` de otra rama** sin recoger: `stash@{0}: On scrum-411-alcance-desde-entradas:
  reversion temporal para medir la linea base (recuperable)`. No es mío y no se toca.
* La rama `scrum-474-fase2-INCOMPLETO` (`8f3fb9dd`) sigue viva en el remoto y está marcada «NO
  MERGEAR» por su autor; su contenido ya entró por otro camino, así que se puede borrar cuando su
  dueño quiera.
