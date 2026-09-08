# SCRUM-813 · El trinquete de zona horaria

**Medido contra:** `origin/main` = `9c989bf0ef2faa3db33d00cd06601c1664aa54fe` · 2026-09-07T09:00:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance:** se construye el **trinquete** y se escribe la **caracterización** de los tres rojos de
SCRUM-592. **Los tres NO se arreglan**, y eso no es un pendiente: es la decisión del ticket (§0).
Cero líneas de `src/`. `prisma/schema.prisma` intacto. Nada contra producción ni contra staging.

---

## 0 · 🔴 LO PRIMERO, PORQUE ES LO QUE PODÍA HUNDIR ESTE TICKET

Los tres rojos de SCRUM-592 **siguen rojos al terminar**, a propósito, y así lo mide la pasada
final (§3.2). Fijarles la zona los pone verdes en cuatro líneas —el arreglo es trivial— y con eso
**se apaga la única evidencia automática que hoy tiene un defecto de numeración fiscal sin
decidir** (`docs/master/SCRUM-643.md` §2·A). Se arreglan cuando 643 §2·A esté decidido, no antes, y
en ese orden.

Aquí se **censan** con su motivo escrito, y el trinquete los espera: si alguno se apagara sin que
nadie lo declare, el trinquete se pone **en rojo también por eso** (§2.4).

---

## 1 · El hecho: el defecto no sobrevivió — VOLVIÓ A ENTRAR

| Hecho | Commit | Fecha |
|---|---|---|
| SCRUM-640 arregla cinco tests que medían la máquina y **censa el árbol entero** | `f67d9449` | 1-sep-2026 |
| Se mezcla en `main` | `c3108665` (PR #889) | **2-sep-2026** |
| SCRUM-592 (DOC-02) mete **tres nuevos** | `271e461f` | **4-sep-2026** |

Dos días. Y no fue mala suerte: **nada lo impedía**. El censo de 640 fue una medición de una vez
—alguien la tecleó, salió un número y el número se quedó en un documento—, y una medición de una
vez no impide nada. Es la diferencia entre *vigilar* y *hacer imposible*.

---

## 2 · El trinquete

`npm run trinquete:zona` · `scripts/trinquete-de-zona.mjs`, con `_trinquete-de-zona.mjs` (la
derivación, compartida con su guard) y `_trinquete-de-zona-hijo.mjs` (una pasada en la zona que
hereda).

### 2.1 · Qué mide, y por qué NO es un detector de formas

La tentación es buscar la FORMA del defecto: `new Date('YYYY-MM-DD')`, `getFullYear()`,
`toLocaleDateString` sin `timeZone`. Eso es una lista negra y tiene el defecto de todas — sólo sabe
decir que no a lo que le enseñaron, y **denuncia a los inocentes**: en este árbol hay cientos de
tests que construyen fechas y son correctos. Un detector así marca el árbol entero, y un guard que
grita siempre **se apaga**. Ésa es la otra forma de no tener trinquete.

Se mide por **DIFERENCIAL**, que es la propiedad misma y no un indicio de ella:

> se corre la tanda ENTERA en dos zonas extremas y se anota **qué pruebas cambian de veredicto**.

Un test que fija su zona da el mismo veredicto en las dos y **no aparece**: el control positivo del
encargo se cumple *por construcción*, no por una lista de excepciones. Y uno que depende de la
máquina aparece **aunque su forma sea nueva**, porque lo que se mira es el resultado.

### 2.2 · Las zonas: `Pacific/Kiritimati` (+14) y `Pacific/Midway` (−11)

Los dos extremos habitados: 25 horas de separación, así que cualquier instante cae en días
distintos en las dos. **UTC no está, y no es un descuido:** es donde corre el runner de CI y donde
corre Railway, así que la tanda normal ya lo mide en cada PR y tiene que salir verde para que ese
PR pase. Meterlo aquí sería pagar una tercera pasada completa para volver a medir lo que el job de
al lado ya exige. `--zonas` lo admite cuando alguien quiera la tabla de tres.

**Y la elección no se cree: se comprueba** (§2.3). Con dos zonas del mismo signo, el canario del
otro signo no cambia de veredicto y el trinquete sale **CIEGO** en vez de dar un verde cómodo.

### 2.3 · 🔴 El autocontrol, y corre EN CADA PASADA

Un censo que devuelve «0 hallazgos» sin haber demostrado que sabe ver alguno no es una medida: es
un silencio. Y este censo tiene un futuro garantizado en el que el árbol se queda sin dependientes
—el día que 643 §2·A se decida— justo cuando su cero dejaría de significar nada.

Por eso cada pasada mide, **por el mismo camino y en las mismas zonas**, cuatro canarios que el
propio instrumento fabrica fuera del árbol:

| Canario | Qué es | Qué tiene que pasar |
|---|---|---|
| `canario-dependiente-oeste` | medianoche UTC leída en local; cae con desfase **negativo** | **denunciado** |
| `canario-dependiente-este` | 20:00Z del 31-dic leídas en local; cae con desfase **positivo** | **denunciado** |
| `canario-fijado` | la misma pregunta con `timeZone` escrita a mano | **NO denunciado** |
| `canario-sin-fechas` | `2 + 2 === 4` | **NO denunciado** |

Si falla cualquiera de los cuatro → **CIEGO**, y no se emite veredicto sobre el árbol.

Viven fuera de `tests/` por dos motivos: los dependientes son rojos a propósito en media Tierra
—dentro de la tanda serían una mina para quien corra en otra zona— y el censo los contaría como
dependientes, que lo son, o sea que el instrumento saldría midiéndose a sí mismo.

### 2.4 · Los cuatro veredictos

| Salida | Estado | Cuándo |
|---|---|---|
| 0 | OK | lo que cambia de veredicto es exactamente lo censado |
| 1 | **HABLA** | hay una prueba dependiente **que no estaba censada** |
| 2 | **CIEGO** | la sonda de `TZ`, los canarios, una pasada muda, sin `dist/`, el árbol se movió, **o cero dependientes teniendo censadas** |
| 3 | **APAGADA** | una censada **dejó de** cambiar de veredicto, quedando otras |

Las salidas 2 y 3 son las que un trinquete ingenuo no tendría. **Un trinquete que sólo mira hacia
arriba deja pasar en silencio el peor movimiento de los dos:** apagar la alarma de un defecto
fiscal antes de que el fundador haya decidido.

Y la distinción entre 2 y 3 no es cosmética. Si desaparecen **algunas**, el instrumento sí midió y
lo que hay que mirar es qué se arregló. Si no queda **ninguna** teniendo censadas, lo primero que
hay que mirar es el instrumento: el suelo que pedía el encargo.

### 2.5 · La línea base vive EN CÓDIGO, no en un JSON

`CENSADAS`, en `scripts/_trinquete-de-zona.mjs`, con `porque` y `parado_en` obligatorios y anclada
**por identidad**: su guard comprueba que el fichero existe y que la prueba con ese nombre sigue
dentro. Así una entrada nueva o borrada **aparece en el diff del PR** y alguien tiene que escribir
por qué.

⛔ Y queda dicho lo que esto NO impide: meter ahí un test nuevo para que el trinquete se calle es
una línea de código y quien la escriba puede escribirla. Lo único que hay es que **queda firmada**,
con su motivo al lado y con la revisión del PR delante. No es una lista de tests aprobados.

### 2.6 · Dónde vive, y por qué no dentro de `npm test`

* **Fuera de `npm test`**, con job propio en `ci.yml` (`trinquete-zona`), **bloqueante**, en
  paralelo con la tanda: le cuesta máquina, no espera del PR. Mismo reparto que `meta:mutaciones`.
  Si no vetara, sería otra medición que se lee después del merge.
* **Dentro de `npm test`**: `tests/scrum813-trinquete-de-zona.test.mjs`, que mide los cuatro
  canarios **por este mismo camino** en menos de un segundo. Lo caro es barrer 712 ficheros;
  comprobar que el aparato ve, no. Sin esto, el instrumento se pudre en silencio entre pasadas.
* El job lleva **el banco desechable** (`LIBRO_PG_URL`) igual que el de la tanda: sin él hay 7
  tests que se saltan **en las dos zonas** —los del libro de facturación, que es donde viven las
  fechas que deciden a qué mes natural pertenece un documento— y el trinquete saldría verde sin
  haberlos mirado (misma lección que SCRUM-419).

---

## 3 · 🔴 EL CONTROL QUE DECIDE · los dos sentidos, sobre el árbol REAL

Los canarios prueban el mecanismo en cada pasada, pero viven fuera de `tests/`. Así que se hizo
además lo que pedía el encargo, **con ficheros de verdad dentro de la tanda**: se metieron dos
tests nuevos —uno que mide la zona de la máquina y otro que la fija— y se corrió el trinquete
entero. Los dos ficheros se borraron después; no viajan en este PR.

### 3.1 · Con los dos inyectados · **EL TRINQUETE HABLA** · salida **1**

```
714 ficheros + 4 canarios · 5.858 pruebas por zona · 149 s y 145 s · árbol quieto ✔
CAMBIAN DE VEREDICTO EN EL ÁRBOL: 4  (censadas: 3)
   🔴 NUEVA  scrum813x-control-dependiente · «SCRUM-813 (control) · un test NUEVO que mide
             la zona de la máquina»            Kiritimati → pass · Midway → fail
```

> Los dos ficheros inyectados se nombran aquí **sin su ruta `tests/…`** a propósito: el guard de
> SCRUM-391 exige que todo test que una entrada declara exista en el árbol, y éstos se borraron al
> terminar el control. Escribir su ruta sería declarar un test que no está.

| Fichero inyectado | Qué hace | Veredicto del trinquete |
|---|---|---|
| `scrum813x-control-dependiente` | `new Date('2027-01-01').getFullYear() === 2027` | 🔴 **DENUNCIADO como NUEVA** |
| `scrum813x-control-fijado` | lo mismo con `Intl…{ timeZone: 'UTC' }` | ✅ **no denunciado** |

**Los dos sentidos, en la misma pasada.** Y el primero es literalmente lo que hizo SCRUM-592 el
4-sep: un test nuevo que mide la máquina. Entonces no habló nada; ahora la salida es 1.

### 3.2 · Sin los inyectados · **VERDE** · salida **0**, y los tres siguen rojos

```
712 ficheros + 4 canarios · 5.856 pruebas por zona · 185 s y 182 s · árbol quieto ✔
autocontrol: 4/4 · repesca: 4 ficheros, 4 de 4 confirmados
CAMBIAN DE VEREDICTO EN EL ÁRBOL: 3  (censadas: 3)   → ✔ TRINQUETE EN VERDE  (exit 0)
```

Las **tres** son las tres de SCRUM-592, `pass` en Kiritimati y `fail` en Midway. Siguen rojas, que
es la otra mitad de la verificación de este ticket.

> Esta pasada se hizo con **esta entrada ya en el árbol**, o sea sobre el mismo juego de ficheros
> que se commitea. Lo único que cambió después fueron las cifras de este bloque, que son su
> resultado. Se dice porque toda entrada de esta casa tiene esa circularidad y disimularla sería
> peor que declararla.

---

## 4 · LA CARACTERIZACIÓN de los tres · qué esperan, qué sale, dónde y por qué

Medido el 7-sep-2026 corriendo `tests/quoteNumber.test.mjs` y
`tests/scrum592-numeracion-doc02.test.mjs` en cinco zonas, con `TZ` por entorno de proceso hijo.

| `TZ` | pruebas | pass | fail |
|---|---|---|---|
| `Europe/Madrid` | 20 | 20 | 0 |
| `UTC` (Railway y el CI) | 20 | 20 | 0 |
| `Pacific/Kiritimati` (+14) | 20 | 20 | 0 |
| `America/New_York` (−5/−4) | 20 | 17 | **3** |
| `Pacific/Midway` (−11) | 20 | 17 | **3** |

**Verdes con desfase ≥ 0, rojos con desfase < 0.** Los tres, y siempre los mismos tres.

| Prueba | Espera | Sale (desfase < 0) | Por qué |
|---|---|---|---|
| `allocateQuoteNumber: toma el cerrojo ANTES de leer, y avanza la serie` (`tests/quoteNumber.test.mjs`) | `{ numero: 'P270001', seq: 1, year: 2027 }` | `{ numero: 'P260003', seq: 3, year: 2026 }` | el fixture `new Date('2027-01-01')` es medianoche **UTC**; `allocateQuoteNumber` lee el año con `now.getFullYear()`, que es **local**. Con desfase negativo el instante es el 31-dic-2026: la serie **no reinicia** y sigue la de 2026 |
| `SCRUM-592 · una mezcla de renumerados y sin renumerar no se pisa` (`tests/scrum592-numeracion-doc02.test.mjs`) | `[[2, 'P260002']]` | `[[2, 'P260001']]` | los dos documentos van a `…T00:00:00Z` y `planDeRenumeracion` agrupa por `new Date(createdAt).getFullYear()`, local. Con desfase negativo el primero cae en 2025 y el segundo en 2026, así que el segundo coge el **1** de una serie vacía — **el duplicado que esa prueba existe para impedir** |
| `SCRUM-592 · el display se DERIVA: no hay columna de texto que pueda discrepar` (`tests/scrum592-numeracion-doc02.test.mjs`) | `'P270003'` | `'P260003'` | `displayQuoteNumber({ quoteNumber: 3, createdAt: '2027-01-01T00:00:00Z' })` formatea con `d.getFullYear()`, local |

### 4.1 · Las dos preguntas del encargo, contestadas por separado

**¿MIENTE EL TEST? SÍ, los tres.** El fixture es medianoche **UTC** y el producto lo lee con
componentes **locales**. Dos convenciones mezcladas: la misma familia que SCRUM-640 §1.1 y §1.2.

**¿ESTÁ MAL EL PRODUCTO? SÍ — y NO es un hallazgo nuevo.** El año de la serie sale de
`now.getFullYear()`, o sea del reloj de la máquina, en `allocateQuoteNumber` y `displayQuoteNumber`
(quoteNumber.service.ts), `allocateAlbaranNumber` (albaranNumber.service.ts) y
`allocateInvoiceNumber` (invoiceNumber.service.ts). **Ya está censado, medido y PARADO** en
`docs/master/SCRUM-643.md` §2·A — el bloque *«A · El sello y la fecha del registro de
facturación»*—, esperando decisión del fundador. Allí está también el arreglo propuesto y por qué
**no** es fijar `Europe/Madrid`: la zona tiene que ser la del merchant (`zonaDelMerchant`), y la
fila de Canarias es el control negativo que lo demuestra.

**La ventana:** el 1 de enero entre las 00:00 y la 01:00 hora peninsular (enero es invierno, +1),
un documento creado en España recibe el número de la serie del **año anterior**. En `invoice` eso
es numeración fiscal, y una factura emitida no se edita ni se borra (regla 29).

### 4.2 · Por qué NO se arreglan aquí

Porque hoy esos tres rojos son **la única evidencia automática** de ese defecto sin decidir.
Ponerlos verdes es apagar la alarma antes de la decisión. Es exactamente la parte del encargo que
dice **PROPÓN Y PARA**.

---

## 5 · El método, cuando haya GO · no hay que inventarlo

Está probado dos veces (SCRUM-640 §1.1 y lo que SCRUM-643 fase ③ hizo con `scrum69`/`scrum70`):

1. **La zona se fija a mano en el fichero**, y la que se fija es **la de la máquina donde ESE
   código corre de verdad**: front → la del profesional; servidor → **UTC**, que es lo que corre en
   Railway.
2. Al lado, un test de **caracterización** que afirme la verdad medida, para que el fixture
   arreglado **no esconda** lo que 643 §2·A dejó abierto.
3. Y se **borra su entrada de `CENSADAS`** en el mismo commit, con la decisión escrita. Si no se
   borra, el trinquete sale con 3 y lo dice; si se borran las tres a la vez y el árbol queda sin
   dependientes, sale con 2 hasta que la lista quede vacía a propósito.

El dato de método que hace falta ya estaba medido y aquí se vuelve a usar: **`TZ` funciona pasada
como entorno de un proceso hijo**; el prefijo `TZ=x node` de Git Bash **no**. La sonda del
trinquete lo comprueba antes de medir nada, y sin ella no mide.

---

## 6 · Límites declarados

1. **Sólo ve lo que CAMBIA DE VEREDICTO entre esas dos zonas.** Una prueba puede depender de la
   zona y no fallar en ninguna de las dos —porque su borde caiga fuera— y este barrido no la ve.
   No es un cero de dependencias: es un cero de veredictos que cambian.
2. **La repesca.** Un candidato se vuelve a medir con su fichero a solas para no confundir
   *parpadeo* con *dependencia de zona*. Una dependencia que sólo se manifestara **en compañía** de
   otros ficheros saldría como «no confirmada» —se imprime— pero no contaría. No se ha visto
   ningún caso; se escribe porque no se ha demostrado que no pueda existir.
3. **La clave es fichero + nombre de prueba.** Dos pruebas del mismo fichero con el mismo nombre
   comparten clave y se agregan por el peor veredicto (`fail` > `skip` > `pass`).
4. **La marca del árbol** (§7.2) ve lo que ve `git`: el contenido de un fichero sin seguimiento no
   entra —su aparición sí— y un cambio revertido a los mismos bytes no se ve.
5. **`CENSADAS` es una lista firmada, no un mecanismo.** Ver §2.5.

---

## 7 · Hallazgos

### 7.1 · `scrum784` no depende de la zona sino de la GRAFÍA del `cwd` — DECLARADO, no perseguido

Venía declarado en el encargo: rojo con `c:/…`, verde con `C:/…`, porque `RUTA_YO` sale de
`import.meta.url` y hereda la grafía de la invocación, con lo que salta su propio SUELO. **No es de
este carril y no se toca.** Se nombra para que quien lea un rojo suyo no lo confunda con esto.

### 7.2 · 🔴 El diferencial exige un árbol QUIETO, y eso pasó a ser mecanismo

No es una precaución teórica: pasó construyendo esto. Se lanzó la pasada y se siguió editando
`scripts/` y `package.json` mientras corría; decenas de guards de esta casa **leen el árbol**, así
que vieron un fichero en la primera zona y otro en la segunda. Eso es un «cambia de veredicto» que
no tiene nada que ver con la zona: **un hallazgo falso**, que es lo que apaga un guard.

Ahora se toma una **marca del árbol** antes y después de las dos pasadas y, si difieren, el
veredicto es **CIEGO**. Por `git diff HEAD` y **no por `mtime`**, y está medido por qué:
`npm run censo:escritores-arbol` cuenta **12 ficheros de `tests/` y `scripts/` que escriben dentro
del árbol** durante la tanda (crean su fixture y lo borran). Con `mtime` esto saldría CIEGO en cada
pasada — la otra forma de no tener instrumento.

### 7.3 · 🔴 `NODE_TEST_CONTEXT` dejaba MUDA a la red que corre dentro de la tanda

Medido provocando el caso: un proceso lanzado desde dentro de `node --test` **hereda
`NODE_TEST_CONTEXT=child-v8`**, y con esa variable puesta el `run()` del nieto devuelve **cero
eventos**. O sea que el guard que vigila al trinquete medía cero canarios, y su cero se leía como
«el trinquete no ve» — el síntoma exacto de un instrumento roto, por una causa que no lo era.

Se limpian `NODE_TEST_CONTEXT` y `NODE_OPTIONS` (la segunda porque el CI le mete a la tanda sus
reporters, y un hijo que la hereda escribe encima del informe de la tanda). **No se limpia nada
más:** `LIBRO_PG_URL` y sus hermanas tienen que llegar tal cual o sus tests se saltarían en las dos
zonas por igual.

### 7.4 · 🔴 `run()` NO hereda la concurrencia de `node --test`, y eso hacía el instrumento inusable

Sin `concurrency` explícito, una pasada de 718 ficheros pasaba de **30 minutos** y `Win32_Process`
enseñaba **dos** procesos de test vivos, no once. Con `concurrency: availableParallelism() - 1`
—exactamente lo que usa `npm test`— la misma pasada baja a **~150 s**. Un instrumento de PR que
tarda una hora no lo espera nadie, y lo que no se espera se apaga.

Se fija a un **número** y no a `true` para que las dos pasadas midan con el mismo reparto pase lo
que pase en el entorno: si una zona corriera con más paralelismo que la otra, una diferencia de
veredicto podría venir de ahí y no del huso.

### 7.5 · El guard de SCRUM-710b cazó este mismo trabajo

La primera versión de `CENSADAS` citaba el producto como `quoteNumber.service.ts:77`. Anclaje por
POSICIÓN dentro de un literal de cadena: el censo por AST lo vio y la tanda se puso roja. Se
re-ancló por **identidad** —el nombre de la función—, que es además lo que no caduca. Queda escrito
porque es un guard de la casa funcionando sobre el instrumento nuevo, no un incidente.

---

## 8 · Entrega

```
tanda                ·  5.868 tests · 5.766 pass · 0 fail · 102 skipped · exit 0
meta:mutaciones      ·  vivas 153 · mudas 0 · ciegas 0 · ficheros muertos 0 · exit 0
                        (las 5 declaradas por este guard tumban a su test nombrado)
guards:entrada       ·  4 guards · 21 tests · exit 0
trinquete (limpio)   ·  712 ficheros + 4 canarios · 5.856 pruebas/zona · 185 s + 182 s
                        autocontrol 4/4 · repesca 4/4 · árbol quieto · cambian 3 = censadas 3
                        VERDE · exit 0
trinquete (control)  ·  con los dos inyectados: cambian 4 · NUEVA 1 · HABLA · exit 1
caracterización      ·  5 zonas · verde en Madrid/UTC/Kiritimati · 3 rojos en New_York y Midway
```

> Los códigos de salida son los del propio comando, leídos con `echo $?` **sin tubería en medio**:
> `npm test | tail` devuelve el código de `tail`, no el de la tanda.

**Lo que NO se ha tocado:** ni una línea de `src/`, ni `prisma/schema.prisma`, ni los tres tests
censados, ni `now.getFullYear()` en ninguno de los cuatro sitios de SCRUM-643 §2·A. Nada contra
producción ni contra staging. Ninguna dependencia nueva (regla 36). Ningún estado ni flag nuevo.

## 9 · Re-medido tras mezclar `main` (7-sep-2026)

`main` avanzó mientras esta rama se construía —el ancla de arriba sigue siendo la del trabajo—, así
que se mezcló y **se volvió a medir todo**. El conflicto fue el de siempre en `package.json`, el
que su propio `//guards` de SCRUM-548 describe: los dos lados añadiendo scripts en el mismo punto.
Se resolvió como manda ese comentario, **conservando los dos**.

```
tanda      ·  5.927 tests · 5.825 pass · 0 fail · 102 skipped · exit 0
trinquete  ·  721 ficheros + 4 canarios · 5.915 pruebas/zona · 175 s + 177 s · árbol quieto
              autocontrol 4/4 · repesca 4/4 · cambian 3 = censadas 3 · VERDE · exit 0
```

Los nueve ficheros de test que `main` trajo **no añaden dependientes de zona**, y las tres censadas
siguen ahí. Es la primera vez que este instrumento contesta a un `main` que no había visto: es
exactamente para lo que existe.

## Tests que introduce esta entrada

* `tests/scrum813-trinquete-de-zona.test.mjs` — la red que corre en cada tanda: los cuatro
  canarios por el camino real (habla con los dependientes, calla con los fijados), los cuatro
  veredictos incluido el SUELO, la marca del árbol, la limpieza del entorno del hijo, la clave
  portable entre Windows y Linux, y la comprobación de que el trinquete sigue **conectado**
  (comando en `package.json` y job en `ci.yml`). Declara **5 mutaciones** para
  `npm run meta:mutaciones`.

---

# APÉNDICE · 8-sep-2026 — EL CIEGO QUE NO SABÍA DECIR QUÉ SE HABÍA MOVIDO

**Medido contra:** `origin/main` = `b521d0a7299efa22153fa776c82cd28e0f907cd9` · 2026-09-08T00:18Z
**Rama:** `scrum-813-el-trinquete-de-zona-horaria` · **Worktree:** `cobroflash-b4`

## A1 · 🔴 LO PRIMERO: NO SE HA REPRODUCIDO EL CIEGO, Y SE DICE ANTES DE NADA

El encargo parte de que **la tanda mueve el árbol por definición** —12 ficheros de `tests/` y
`scripts/` que escriben dentro— y de ahí sale la petición de acotar el sujeto de la quietud a una
lista cerrada de rutas permitidas.

**Se intentó reproducir por tres caminos independientes. Ninguno movió el árbol:**

| medición | cómo | resultado |
|---|---|---|
| rutas movidas por CÓDIGO de `git status` | 100 muestras durante 152 s de tanda completa | **0 rutas** |
| las TRES piezas exactas de la marca (`HEAD` · `status` · **`git diff HEAD` entero**) | ~178 muestras durante 215 s | **ninguna cambió en ningún momento** |
| **el trinquete real, dos pasadas** (299 s + 374 s, 5.915 pruebas cada una) | `npm run trinquete:zona` | `árbol quieto durante las dos pasadas ✔` · **exit 0** · 3 = 3 censadas |

Y los sospechosos señalados no lo son, medidos uno a uno:

- los **10 ficheros gateados por `LIBRO_PG_URL`** —que en local se saltan y en CI sí corren, que es
  la diferencia obvia entre las dos máquinas— tienen **0 escrituras** de fichero;
- los **21 que nombran `meta-guard-mutaciones`** (el único de la casa que muta ficheros
  RASTREADOS) **lo importan y leen su fuente; ninguno lo ejecuta**.

**Y hay un motivo de diseño por el que encaja que no se mueva:** el instrumento ya estaba
construido contra eso. Su propio comentario lo dice — usa git y no `mtime` **precisamente** porque
hay ~12 escritores, y «un fichero creado y borrado no deja rastro» en una marca por CONTENIDO.
Los 12 ya estaban absorbidos el día que se escribió.

### 🔴 POR QUÉ NO SE HA MONTADO LA LISTA DE EXCEPCIONES

Con la causa sin identificar, una lista cerrada de rutas permitidas **es un hueco en la puerta** —
la misma que el encargo pide expresamente no relajar— y además **no cerraría el CIEGO real**, que
seguiría apareciendo sin poder explicarse y ya sin poder atribuirse a la lista.

El mecanismo queda descrito y listo para escribirse **en cuanto haya una ruta con nombre**: con el
cambio de abajo, el próximo CIEGO la dice. Hace falta el log del CI donde ocurrió.

## A2 · LO QUE SÍ SE HA HECHO: EL INSTRUMENTO DEJA DE TIRAR EL RESULTADO

El diagnóstico del fundador —*«funcionó entero y luego tiró el resultado»*— describe **literalmente**
lo que hacía la comprobación de quietud: medía `HEAD` + `status` + `diff HEAD`, lo resumía a **UN
hash** y tiraba el detalle. Cuando ese hash cambiaba, lo único que sabía decir era «el contenido
del árbol de trabajo cambió durante la medición»: sin fichero, sin antes ni después.

Con eso, **quien recibe el CIEGO no puede distinguir dos causas con arreglos opuestos** —«la tanda
escribió algo» y «alguien editó un fichero mientras corría»—, y ante esa duda la salida cómoda es
relajar la puerta.

**Ahora la marca guarda huella POR RUTA** (`huellaPorRuta`), cruzando dos fuentes porque hacen
falta las dos: `git status --porcelain` ve la aparición y la desaparición (y lo no rastreado, que
sólo sale ahí), y `git diff HEAD` **troceado por fichero** ve el contenido — un fichero rastreado
mutado y restaurado con otros bytes deja el código de estado IGUAL y el diff distinto. Ese hueco
no es teórico: es el que tenía la primera sonda de esta sesión, que dio «0 rutas» mirando sólo el
código.

**⛔ LA PUERTA NO SE HA TOCADO.** Una sola ruta movida sigue siendo CIEGO: sin lista blanca, sin
excepciones. Lo único que cambia es que el CIEGO **dice el nombre**, y el comando lo imprime.

**Y lleva su suelo, que es lo que impide que el refinamiento se convierta en un agujero:** si la
huella GLOBAL dice que algo cambió y el detalle por ruta no encuentra NADA, se trata como
movimiento y **nunca** como quietud. Un detector que no sabe deja la puerta cerrada.

## A3 · PROBADO EN ROJO — tres mutaciones, cada una tumbando SÓLO su caso

| mutación | qué imita | cae |
|---|---|---|
| `if (!rutas.length && …)` → `if (false)` | el suelo del detalle se cae: un árbol movido que el troceado no supo leer pasaría por quieto | *SUELO: si el detalle por ruta NO ve nada…* |
| el `push` con el nombre → un texto genérico | el CIEGO vuelve a ser mudo | *EL QUE DECIDE: un fichero de TEST tocado…* |
| `porRuta: huellaPorRuta(…)` → `new Map()` | la marca vuelve a tirar el detalle: la avería original con otra cara | *la marca REAL trae el detalle…* |

Restauradas → **23/23 en verde**, los 18 que ya estaban (incluido «si el árbol se MUEVE entre las
dos pasadas, el veredicto es CIEGO») más 5 nuevos.

Las tres quedan registradas en `MUTACIONES_QUE_ME_TUMBAN`, así que las ejercita `npm run
meta:mutaciones` en su job de CI. **Comprobado además que no son decorativas:** las **8** anclas
declaradas en ese array casan **exactamente una vez** en `scripts/_trinquete-de-zona.mjs` — una
mutación cuyo texto no casara se aplicaría sobre nada y pasaría en verde sin haber mutado.

## A4 · LOS TRES DE SCRUM-592 SIGUEN ROJOS

La pasada real los listó uno a uno, con su censo:

```
CAMBIAN DE VEREDICTO EN EL ÁRBOL: 3  (censadas: 3)
   · allocateQuoteNumber: toma el cerrojo ANTES de leer, y avanza la serie
   · SCRUM-592 · el display se DERIVA: no hay columna de texto que pueda discrepar
   · SCRUM-592 · una mezcla de renumerados y sin renumerar no se pisa
        Pacific/Kiritimati → pass   ·   Pacific/Midway → fail
```

La alarma no se ha tocado, y el control positivo que pedía el encargo —«la tanda escribiendo sus
12 de siempre → el trinquete EMITE veredicto, y el veredicto es 3 = 3»— **ya pasa hoy**, sin
ningún cambio. Eso es, por sí solo, evidencia de que el sujeto no hacía falta acotarlo.

## A5 · HUECOS DECLARADOS

- **No se ha reproducido el CIEGO de CI**, y por eso no se ha escrito la lista de excepciones.
  Falta el log de esa ejecución.
- Las mediciones son de **Windows**, con la tanda local (los gateados por `LIBRO_PG_URL`,
  `QA_DB_TEST` y `BOT_SUITE_TEST` se saltan). Se comprobó a mano que ninguno de los de
  `LIBRO_PG_URL` escribe ficheros, pero **no se ha corrido el trinquete en Linux con esa base**.
- `npm run meta:mutaciones` **no se ha corrido entero** en esta sesión: el intento se cortó con un
  `| head -20` y su exit 0 era el de `head`. Se sustituyó por la comprobación de anclas del §A3,
  que cubre el fallo que importaba; el job de CI lo corre completo.
