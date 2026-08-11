# SCRUM-356 · H2 — el aviso provisional (10-ago tarde) + los tres estados (10-ago) + el informe del 7-ago

> **Este fichero tiene TRES entradas.** Arriba, la de la tarde del 10-ago: el aviso que hubo que
> cambiar porque prometía algo que hoy no es verdad. Después, lo construido esa mañana. Al final,
> **sin tocar**, el informe del 7-ago que midió el terreno. La medición no se reescribe: es la que
> sostiene el diseño, y quien lo discuta tiene que poder leer sobre qué se decidió.

---

# 10-ago-2026 (tarde) · EL AVISO DEJA DE PROMETER LO QUE NO HAY

**Medido contra:** `origin/main` = `9edc6d12f26f4cbfc01c9a646fa3cf94d900e003` · 2026-08-10T22:45:30Z

**Carril:** H (albarán sin red) · **Gate:** sin gate, corre en `npm test`

El aviso aprobado en la entrada de abajo —*«Las firmas pendientes suben cuando abres YaQu. Si no la
abres, se quedan aquí.»*— **es falso desde que existe la cola**. SCRUM-358 fase 2 construyó el
productor, pero **el drenado es de la fase 3 y no existe**: una firma encolada sólo sube si el
profesional **vuelve a firmar ese albarán**. Abrir la aplicación no sube nada.

En un bloque cuya regla es *«ante la duda, se dice que NO subió»*, no se puede enviar un texto que
promete más de lo que hay. El hueco lo declaró la fase 2 y se cierra aquí, antes de que llegue a
nadie.

## PASO 0

* **`docs/master/SCRUM-358.md` existe y se leyó.** Su tercera entrada —la de la fase 2— **declara
  este hueco pero no lo arregla**: dice literalmente *«El texto está aprobado y no se toca (regla
  30)»*. No documenta lo que pide este encargo, así que se sigue.
* **Premisa comprobada con tres recuentos POR SEPARADO:**

| Qué | Cómo se contó | Resultado |
|---|---|---|
| ¿el texto viejo está vivo en `main`? | `git grep -F` sobre `main` | **3 sitios**: doc, `estadoFirma.js:84`, test |
| ¿hay copias sueltas en la rama? | `git grep -F` sobre `HEAD` | **los mismos 3**, ninguna suelta |
| ¿sigue sin haber drenado? | `git grep -iE "drenar\|drenado\|reintent"` en `public/dashboard/js/` | **ninguna es drenado de la cola** (son WhatsApp, el poll de versión y un comentario) |

## El texto nuevo — APROBADO por el asesor, literal

> **«Las firmas pendientes no suben solas todavía: vuelve a firmar el albarán cuando tengas
> cobertura.»**

El **«todavía»** es deliberado: es cierto hoy y anuncia que es temporal. Y dice **qué hacer**, que
es lo que lo hace útil — un aviso que sólo niega deja al profesional mirando la pantalla sin salida.

## 🔴 LA REVERSIÓN, ESCRITA PARA QUE NO SE PIERDA

**CUANDO EXISTA EL DRENADO (fase 3 de H3) SE VUELVE AL TEXTO DE SCRUM-356**, que entonces sí será
verdad:

> «Las firmas pendientes suben cuando abres YaQu. Si no la abres, se quedan aquí.»

Ese texto sigue **aprobado** y sigue citado, sin tocar, en la entrada de abajo. Lo que hay que
retirar ese día es el guard *«el aviso NO promete que las firmas suban solas»*, y su propio mensaje
de fallo lo dice con esas palabras: *«Si el drenado YA existe, este guard es lo que hay que retirar
— y entonces vuelve el texto de SCRUM-356, que es el aprobado para ese día.»*

## La caja, MEDIDA EN NAVEGADOR antes de darlo por bueno

Condición de la aprobación, y el texto nuevo es **19 caracteres más largo** (78 → 97). Medido con
**Edge vía `puppeteer-core`** —el mismo montaje que usa `scripts/guard-contraste.mjs`—, sobre el
**DOM real del dashboard** y con el **CSS real**:

| viewport | viejo (78 car) | nuevo (97 car) |
|---|---|---|
| 390 px | 3 líneas · 83 px | **3 líneas · 83 px** — idéntico |
| 360 px | 3 líneas · 83 px | **3 líneas · 83 px** — idéntico |
| 320 px | 3 líneas · 83 px | **4 líneas · 103 px** (+1 línea, +20 px) |

En los tres anchos: **no se trunca, no desborda su caja y no saca barra horizontal en la página**.
El coste real es **una línea más en el móvil más estrecho**, en un aviso que sólo aparece cuando hay
firmas pendientes.

> ⚠️ **LA PRIMERA MEDICIÓN FUE FALSA Y CASI ME LA CREO.** Daba 198 px de ancho de caja a viewport
> 390 y hasta 11 líneas a 320. El número no cuadraba —390 − 198 = 192, y 320 − 128 = los mismos
> 192— así que se persiguió en vez de aceptarlo. La causa: cargar `/dashboard/` **sin sesión**
> hace que `app.js` redirija a `/login.html`, y lo que se estaba midiendo era **la caja del
> login**. Lo delató el diagnóstico que se añadió a la medición: *«no hay .sidebar, no hay .main,
> se inyectó en BODY»*.
>
> Se corrigió sirviendo el **mismo HTML del dashboard con los `<script>` quitados**: mismo DOM,
> mismo CSS, sin el JS que navega. Entonces los números pasaron a ser coherentes —`.main` con
> `margin-left: 0`, sidebar fuera de pantalla en `x=-248`, fuente 13.5 px— y son los de la tabla.
>
> **Una medición en navegador no es fiable por ser en navegador: hay que comprobar que la página
> que mediste es la que creías.**

## Lo construido

* `public/dashboard/js/estadoFirma.js` — el texto, con la caducidad escrita al lado.
* `tests/scrum356-tres-estados.test.mjs` — el texto fijado letra por letra **y un guard nuevo**.

**Son dos guards distintos a propósito.** El de la letra cae con *cualquier* cambio, incluido uno
bueno; el nuevo dice **por qué** no puede volver el texto viejo, nombrando la promesa concreta
(`suben cuando abres`) en vez de comparar cadenas. Lleva su control positivo dentro: el detector
reconoce la promesa cuando está delante, o su «no está» no valdría nada. Y exige que el aviso siga
diciendo **qué hacer** (`vuelve a firmar`).

## Lo que NO se ha tocado

Los otros cuatro textos de SCRUM-356 —siguen siendo verdad— · nada de la fase 2 de SCRUM-358 · el
drenado · `prisma/schema.prisma` · el camino de emisión. La cita del texto viejo en la entrada de
abajo **se deja como estaba**, con una nota al lado: es el texto al que hay que volver.

## Huecos que se declaran

* **La caja se midió a 390, 360 y 320 px, en Edge y en headless.** No es un iPhone real ni Safari:
  el ajuste de línea puede variar un carácter con otra pila de fuentes. Lo que sí es sólido es que
  **el CSS no trunca** (`.alert` no tiene `text-overflow`, `white-space: nowrap` ni `max-width`),
  así que el modo de fallo grave —texto cortado— no depende del navegador.
* **No hay captura.** La medición es numérica; nadie ha visto el aviso con los ojos.

## Tests

* `tests/scrum356-tres-estados.test.mjs` — 18 tests (1 nuevo)

---

# 10-ago-2026 · LOS TRES ESTADOS, CONSTRUIDOS

**Medido contra:** `origin/main` = `76163fc738e2e4bff1a11964c7ab0f338eed42c1` · 2026-08-10T21:49:07Z

**Carril:** H (albarán sin red) · **Gate:** sin gate, corre en `npm test`

Una firma que el profesional **cree** guardada y no lo está es peor que no poder firmar, porque se
va de la obra tranquilo. Si no puede firmar lo sabe y busca salida —hace una foto, apunta el
nombre, sube a la calle—. Si cree que firmó, no hace nada.

## 🔴 PASO 0 · el fichero existía, y aun así se siguió

**`docs/master/SCRUM-356.md` SÍ existía en `main`.** Pero «existe el fichero» no es «lo que dice»:
es el **informe de medición del 7-ago, «cero construcción»**, que termina en una hoja de decisión
para el fundador. Lo que este ticket pide construir **no existía**:

| Comprobación | Cómo se contó | Resultado |
|---|---|---|
| los cinco textos aprobados | `git grep -c` de cada uno sobre `main`, en `public/` y `src/` | **0 ficheros cada uno** |
| tests de 356 | `git ls-tree -r main` filtrado por `356` | **sólo el `.md`** |
| `navigator.onLine` | `git grep` sobre `main` | **0 usos reales** — la única aparición literal es un comentario en `api.js:201` que dice *«NO se usa `navigator.onLine`»*; las demás eran subcadenas de `conLineas`/`PeticionLinea` |

El 0a dispara por el fichero; el 0b confirma que el trabajo estaba por hacer. Se siguió y se deja
dicho aquí, que es donde el asesor puede verlo. **La forma elegida es la de SCRUM-358**: segunda
entrada arriba, informe intacto abajo.

## Los tres estados

| | Qué afirma | Cuándo |
|---|---|---|
| ① `FIRMA_SOLO_EN_ESTE_MOVIL` | el trazo existe, aquí, y nada más | por defecto, y ante **cualquier** duda |
| ② `FIRMA_SUBIENDO` | salió del móvil | petición en vuelo |
| ③ `FIRMA_A_SALVO` | está a salvo aunque pierdas el teléfono | **sólo** con `confirmadaPorElServidor === true` |

**La asimetría de coste es la regla de la que sale todo lo demás.** Un falso «pendiente» cuesta una
comprobación; un falso «a salvo» cuesta el albarán. Por eso ③ exige `=== true` —ni un `1`, ni un
`'sí'`, ni un objeto— y no existe «probablemente sí».

### `navigator.onLine` no declara ②

Una LAN sin salida cuenta como estar conectado. Hoy `onLine` tiene **cero usos**, así que la regla
**se cumple por construcción, no por disciplina**, y lo que hacía falta era *impedir que se rompa*:
guard **AST** sobre los cinco ficheros del camino. AST y no `grep` porque el repo está lleno de
comentarios que explican por qué no se usa —`api.js:201` es uno— y un guard de texto se cazaría a sí
mismo en ellos.

Y el cuerpo se mira, no sólo el `res.ok`: una cadena que empieza por `<` no puede pasar por
confirmación. Cuesta dos líneas, y es el defecto por el que `exportView.js` descarga un ZIP con la
página de login del router dentro (§3 del informe de abajo).

## La microcopy, con la caja MEDIDA

Condición de la aprobación, cumplida antes de darla por buena:

| Texto | Caracteres | Dónde se pinta |
|---|---|---|
| «Solo en este móvil» / «Subiendo…» / «A salvo» | 18 / 9 / 7 | `.status-pill` |
| detalle ① | 68 | `.alert` / `<p class="muted">` |
| detalle ③ | 46 | ídem |
| contador (singular y plural) | 26 / 29 | `.alert warning` |
| suelo | 53 | ídem |
| «suben cuando abres YaQu…» | 78 | ídem |

**Ninguno se trunca:** `.alert` (13.5px, `line-height` 1.5) y `.status-pill` no tienen
`text-overflow`, `white-space: nowrap` ni `max-width` — comprobado en `styles.css:471-486` y
`:769-798`. Nada que ver con el precedente de 157/163 caracteres en un toast que muere a los 5 s.

> ⚠️ `.status-pill` pinta en MAYÚSCULAS por `text-transform` (DESIGN.md: «forma pastilla, 11–12px,
> peso 700, MAYÚSCULAS»). El texto del DOM es el aprobado literal; quien lo cambia es el
> componente, igual que con «enviado para firmar». Se anota por no dejarlo implícito.

## El suelo de la cola

Si no se consigue leer, **no se dice «0 pendientes»**: se dice *«No hemos podido comprobar si te
queda algo por subir»*, que es un texto **distinto** y no el mismo con un cero. «Nada pendiente» y
«no supe mirar» son la misma pantalla y significan lo contrario, y aquí el segundo le dice al pro
que está todo a salvo.

Con la cola leída y vacía el texto es `null`: no hay microcopy aprobada para «no queda nada» y no se
inventa (regla 30).

## El hueco se declara EN LA PANTALLA

*«Las firmas pendientes suben cuando abres YaQu. Si no la abres, se quedan aquí.»*

> ⚠️ **ESTE TEXTO YA NO ES EL QUE SE PINTA.** Lo sustituyó el de la entrada de arriba
> (10-ago, tarde) porque, sin drenado, **abrir YaQu no sube nada**. La cita se deja como estaba: es
> el texto aprobado para el día que exista el drenado, y es a él a quien hay que volver.

**Se pinta siempre que haya pendientes, no sólo en iOS**, y es deliberado: hoy **ningún** navegador
drena la cola solo, porque el drenado es de H3. Restringirlo a iOS afirmaría que en Android sí se
vigila — la promesa que no podemos sostener. Además evita una segunda detección de plataforma
(`isIOS` vive dentro de la IIFE de `voiceInput.js` y no está publicada), que es el defecto que
cerraron SCRUM-360 y 447.

## La superficie

* **`albaranDetailView.js`** — píldora `.status-pill` + detalle, para un albarán firmado. La cola se
  **consulta, no se produce**, y sólo puede **degradar** a ①: entre «el servidor lo tiene» y «este
  móvil cree que aún debe subirlo», gana la lectura que no promete nada.
* **`homeView.js`** — `.alert warning`, **antes del héroe**, **sin `data-home-block`** —un aviso de
  riesgo que se puede quitar desde «Personalizar» no es un aviso— y **fuera del `try/catch`** de las
  métricas: si la red está mal, que es justo cuando quedan firmas sin subir, este aviso es lo único
  que no puede desaparecer.

Los dos reutilizan el inventario AB3; no se ha creado ningún componente ni token nuevo.

## Verificación — 17 tests

Los controles negativos **no simulan el resultado**: montan el dashboard entero contra el `fetch`
del banco de SCRUM-362 y pasan por el `apiRequest` de verdad.

| Mutación (post-condición en disco) | Cae |
|---|---|
| `confirmaElServidor` deja de mirar el cuerpo | el HTML pasa por confirmación |
| la asimetría se afloja a `if (x)` | «casi verdadero» afirma ③ |
| el suelo devuelve `{sabemos:true, n:0}` | se dice «0 pendientes» sin haber mirado |
| entra `navigator.onLine` en el modelo | el guard AST, nombrando `estadoFirma.js:115` (+3 más) |
| la etiqueta pasa a «Guardado» | microcopy **y** «dice dónde» |
| el pintado pasa a `✓` | tic sin palabras |
| la home calcula y no pinta | el aviso no llega a la pantalla |

> ⚠️ **Dos tropiezos, anotados porque los dos costaron tiempo y los dos son reutilizables:**
>
> ① **El método importa en el banco de red.** El plazo de SCRUM-451 cubre **sólo GET**, a propósito
> y medido —abortar una mutación puede duplicar una factura—. «Acepta y no entrega» con un `POST`
> **no vuelve nunca**: el test se colgó 240 s. Se ejercita con el método que ese escenario puede
> cortar, y queda escrito para que el siguiente no repita la tarde.
>
> ② **La post-condición de una mutación que INSERTA no puede exigir «el ancla vieja ya no está».**
> Dio un «la mutación no llegó al disco» falso sobre una que sí se había escrito. Rojo raro,
> sospechoso el escáner.

## 🔴 Huecos que se declaran

* **El profesional NO ve sus pendientes, porque no hay ninguno.** `firmasPendientes` existe
  (SCRUM-455) pero **nadie escribe en él**: acuñar la clave y encolar es H3 (SCRUM-358), y drenar
  también. Hoy las firmas van directas al servidor. Lo construido aquí es **el modelo, los guards y
  la superficie**; los tests siembran la cola directamente para ejercitarla. **Un mecanismo que
  existe y nadie dispara es medio mecanismo**, y aquí es a propósito y por orden.
* **En consecuencia, ① y ② no se ven hoy en el producto.** ③ sí: un albarán que la API devuelve como
  «firmado» está confirmado por el servidor, y eso es cierto hoy.
* **El fallo del purgado del logout sigue sin verse, y esta vez con motivo medido.** SCRUM-455 lo
  declaró; esta fase tiene superficie, así que tocaba enseñarlo o decir por qué no. **No se enseña**
  porque `logout()` hace `window.location.href = '/login.html'` **en el acto**: cualquier aviso
  pintado ahí desaparece antes de poder leerse. Enseñarlo exige **cambiar el flujo de cierre de
  sesión** —no redirigir, o llevar el aviso a la pantalla de login—, y eso es cambio de flujo, no
  superficie. Queda propuesto, no hecho.
* **`albaranId` es un acuerdo mínimo con H3.** Para saber si una firma en cola es de *este* albarán
  hace falta un campo, y SCRUM-455 dejó dicho que el contenido lo decide H3. Se usa `albaranId` —el
  identificador de la API, que no se traduce— y **vive en una sola función**, `hayFirmaEnColaDe`. Si
  H3 lo llama de otra forma, se toca ahí y nada más.
* **Sin captura de pantalla ni matriz de dispositivos.** El checklist AB6 pide capturas
  antes/después y la matriz Android/iPhone/tablet; esta sesión no tiene navegador. Los componentes
  son los del inventario y la caja está medida sobre el CSS, pero **eso no es haberlo visto**.
* **② no se pinta en ningún sitio todavía.** El estado existe, tiene texto y se ejercita, pero
  ningún camino lo produce: quien lo pondrá es el drenado de H3.

## Aviso de cruce

Se tocó `homeView.js`, `albaranDetailView.js`, `estadoFirma.js` (nuevo), `index.html` y `sw.js`
(**una línea**, la entrada del fichero nuevo en el `SHELL`, que es lo que exige el guard de
SCRUM-274). **`app.js` no se ha tocado**, así que no hay colisión con la zona del logout de
SCRUM-457 — que además ya está en `main` (PR #665) y se ha traído a esta rama con merge limpio.

## Tests

* `tests/scrum356-tres-estados.test.mjs` — 17 tests

---

# 7-ago-2026 · EL INFORME QUE MIDIÓ EL TERRENO — sin tocar

**Fecha:** 7-ago-2026 · **Carril:** H (albarán sin red) · **Gate:** sin gate — esta tarea **solo lee**

**Medido contra:** `origin/main` = `f0720385437a094534d725b01ecca83057d2fd1a` · 2026-08-07T19:27:29Z

> **No se ha construido nada.** Ni el mecanismo de firma, ni la cola (H3), ni el almacenamiento
> (H5), ni `prisma/schema.prisma`, ni el camino de emisión. **Y no se escriben los tres textos de
> estado**: son microcopy del fundador y son el corazón del ticket (regla 30).

---

## ⚠️ DOS AVISOS DE PARTIDA, antes de las respuestas

### ① «Bloqueada por SCRUM-336 (H0)» es una referencia EQUIVOCADA

**SCRUM-336 no es H0.** Es *«La atribución deja de guardarse en el navegador del visitante y pasa a
viajar en la URL»* (carril B, 5-ago-2026, `docs/master/SCRUM-336.md`) — atribución de marketing, sin
relación con el albarán sin red.

**H0 es SCRUM-355** (`docs/master/SCRUM-355.md`, mergeado). La dependencia real de H2 es ésa.

> Una referencia equivocada en un ticket es lo que hizo dar A9 por cerrada. Se corrige aquí y **no
> se toca el ticket de Jira** (lo lleva el asesor).

### ② El ticket SCRUM-356 **no existe en el repo**

Se pidió leerlo entero; **no se ha podido**: no hay `docs/master/SCRUM-356.md` (esta entrada es la
primera) y el enunciado vive solo en Jira. Lo que se mide abajo sale de **H0 (SCRUM-355)**, del
código, y de las cinco preguntas del encargo. **Si el ticket afirma algo que no esté aquí, no se ha
contrastado.**

---

## 1 · ¿Dice el producto «guardado» hoy, y qué está afirmando? — **[MEDIDO]**

**Sí, en dos sitios que lo afirman como HECHO CONSUMADO** — y los dos, medidos, lo dicen **después
de la respuesta del servidor**, que es lo correcto:

| Dónde | Texto | Qué afirma | ¿Correcto? |
| --- | --- | --- | --- |
| `quotesDetailView.js:877` | `✓ Guardado automáticamente` | **confirmado por el servidor** — va tras `await apiRequest(PUT /admin/quotes/:id/notes)` | ✅ |
| `jobsView.js:332` | `✓ Notas guardadas` | **confirmado por el servidor** — dentro del `.then()` del `apiRequest` | ✅ |

**Las demás apariciones NO son afirmaciones de estado:** `Guardando…` en rótulo de botón mientras
la petición está en vuelo (`customerDetailView.js:373`, `expensesView.js:370`, `homeView.js:1253`,
`onboardingView.js:425`, `productsView.js:172`, `providersView.js:85`, `quotesDetailView.js:662`,
`:717`, `:1048`) — es un estado de progreso, no una promesa. Y `«Este cliente no tiene email
guardado»` (`invoiceDetailView.js:282`, `:298`, `jobDetailView.js:884`,
`quotesDetailView.js:116`) habla de un dato ajeno, no del guardado en curso.

> **Conclusión para H2:** hoy el producto **no** miente con «guardado» — porque hoy **no hay nada que
> guardar en el móvil**. El riesgo que el ticket describe —decir «guardado» teniendo solo «en este
> móvil»— **no existe todavía y nacería con H3/H5**. Los dos textos de arriba son el precedente a
> imitar, no un defecto a corregir.

## 2 · `navigator.onLine` — **[MEDIDO]**

**CERO usos en todo el árbol.** `grep -rn "navigator\.onLine" public/ src/` → **0 resultados**.

* **Ningún estado se decide con él**, porque no se consulta en ninguna parte.
* Y H0 ya lo había medido desde el otro lado: `api.js:17` hace `const res = await fetch(...)`
  **sin try/catch alrededor del `fetch` y sin consultar `navigator.onLine`** (SCRUM-355, P6).

> **Esto es una buena noticia y hay que decirla:** la regla que el ticket quiere —«el estado
> *enviado* NO lo declara `onLine`, lo declara una respuesta del servidor»— **hoy se cumple por
> construcción**, no por disciplina. Lo que H2 tiene que hacer es **impedir que se rompa**, no
> arreglarla.

## 3 · El portal cautivo: ¿algún 200 se toma por éxito sin mirar el cuerpo? — **[MEDIDO]**

**SÍ, en tres sitios, y los tres son descargas de fichero.**

`apiRequest` **no** es uno de ellos: siempre termina en `res.json()` (`api.js:50`), así que el HTML
de un portal cautivo revienta el parseo y sale por el `catch`. Falla — de forma incomprensible,
pero falla.

El problema está en los `fetch` **directos** que miran solo `res.ok` y luego piden el cuerpo como
binario:

| Dónde | Qué descarga | Qué pasaría con un portal cautivo |
| --- | --- | --- |
| `exportView.js:222` | `portabilidad.zip` | `res.ok` es `true` → `res.blob()` del HTML de login → **se descarga un ZIP corrupto** |
| `exportView.js:277` | `datos.zip` | ídem |
| `exportView.js:340` | `libros/expedidas.csv` | ídem — el CSV que va al asesor |

**Y hay que decir de quién es la tercera: la introduje yo en SCRUM-325 (E4)**, copiando la forma de
las dos que ya estaban. Es la clase de defecto que se propaga por imitación.

> **La escena real:** obra con wifi de cortesía sin salida. El profesional pulsa «descargar», el
> navegador guarda un fichero, y lo que hay dentro es la página de login del router. Se entera el
> día que se lo abre el asesor.

**`[HUECO]`:** no se ha probado contra un portal cautivo real. **Qué haría falta:** un router con
portal (o un proxy que devuelva 200 + HTML) y el dashboard con sesión.

## 4 · El aviso: qué soporta cada navegador y qué costaría cada salida — **[MEDIDO]**

### Lo confirmado contra fuentes (7-ago-2026)

| API | Safari (iOS y macOS) | Firefox | Chrome / Edge | Global |
| --- | --- | --- | --- | --- |
| **Background Sync** | **NO, en ninguna versión** (3.1 → 26.5, y TP) | NO (2 → 153) | sí (Chrome 49+, Edge 79+) | 76,73 % |
| **Periodic Background Sync** | **NO** (iOS 3.2 → 26.5) | NO (2 → 156) | sí (80+) | 76,3 % |

**El ticket acierta:** Background Sync es **0 % en Safari** y Periodic es **solo Chromium**.

⚠️ **Y el dato que decide cuánto pesa eso NO lo tenemos.** H0 dejó **P2 como `[HUECO]`**: no hay
telemetría de navegador ni sistema (cero analítica en `public/dashboard/`, `navigator.userAgent`
leído en dos sitios y persistido en ninguno). **Si la mitad de los pros van en iPhone, el 76 % global
es irrelevante: el bloque cambia de forma entera.** No se rellena con cuota de mercado — la cuota de
iPhone en España no dice nada de NUESTROS usuarios.

### Las tres salidas, en NUESTRO producto

**A · Solo al abrir la app** *(reintentar cuando el profesional vuelve a entrar)*

* **Necesita:** la cola (H3) y el almacenamiento (H5). Nada más. **Cero dependencias nuevas, cero
  permisos, cero servicios.** Funciona igual en Safari y en Chrome.
* **Qué se pierde:** si no vuelve a abrir la app, **no se envía nunca**. El albarán firmado se queda
  en el móvil sin que nadie lo sepa — y el profesional puede estar convencido de que se envió.
* **Coste:** el más barato de los tres, y es el único que hoy es construible.

**B · Push**

* **Necesita:** ① `PushManager` + claves VAPID + un servicio de envío; ② **permiso explícito del
  usuario**; ③ en **iOS, que la app esté INSTALADA en la pantalla de inicio** — Safari no da push
  a una web en pestaña; ④ backend nuevo para almacenar suscripciones y despachar.
* **Medido: en el producto NO existe NADA de esto.** Cero `PushManager`, cero
  `Notification.requestPermission`, cero `showNotification`, cero VAPID, cero `web-push` en
  `public/` y `src/`.
* **Qué se pierde:** es **dependencia nueva → regla 36, decide el fundador**. Y depende de dos
  cosas que no controlamos: que el usuario conceda permiso y que se haya instalado la PWA. Si
  cualquiera de las dos falla, se degrada a la salida A **sin avisar**.
* **Coste:** el más caro con diferencia, y el único que introduce infraestructura.

**C · Declarar el hueco en pantalla** *(decirle que hay algo sin enviar y que debe abrir la app)*

* **Necesita:** la cola (H3) y el almacenamiento (H5), lo mismo que A, **más un sitio visible donde
  decirlo** y **microcopy del fundador** (regla 30).
* **Qué se pierde:** no envía nada por sí sola — es honestidad, no mecanismo. Le pasa el trabajo al
  profesional.
* **Coste:** A + una superficie de UI + un texto aprobado.

> **No son excluyentes: C es el suelo de A y de B.** Con A sin C, un albarán puede quedarse sin
> enviar y nadie lo sabe. Con B sin C, lo mismo el día que el permiso no esté concedido. **La
> pregunta que decide no es "¿cuál?", es "¿se construye C siempre, y A o B encima?"**

## 5 · ¿Hay hoy cola o reintento en el frontend? — **[MEDIDO]**

**No hay cola. No hay reintento automático. No hay persistencia de nada pendiente.**

* **IndexedDB: CERO** — confirmado, y ya lo había medido H0 (SCRUM-355, P5): cero ficheros en
  `public/` y `src/` lo mencionan.
* **Lo que sí hay, y es otra cosa: reintento MANUAL, iniciado por el usuario.**
  * `api.js:56` `uiErrorState(container, message, onRetry)` → pinta un botón **«Reintentar»** que
    vuelve a llamar a la función de carga. Es re-pedir una lectura, no reencolar un envío.
  * `api.js:165` `waFallbackBar({ … onRetry })` → **«↻ Reintentar WhatsApp»**, con dos salidas más
    (copiar enlace, enviar por email). Es el patrón más cercano al que H2 necesitaría… **pero exige
    que el profesional esté delante y pulse.**
* **El service worker no ayuda:** precachea 50 rutas de **cáscara** y **0 rutas de datos**, y manda
  a red directa y sin caché todo `/admin/`, `/auth/`, `/quote`, `/webhooks/` (`sw.js:90-96`).

> **Conclusión: la cola es pieza nueva ENTERA.** No hay nada de lo que colgarla, ni siquiera un
> almacén. Y H0 añade el bloqueo de fondo: **el albarán no existe hasta que el servidor le da
> número** (`allocateAlbaranNumber` dentro de la transacción) y **no hay clave de idempotencia
> generada en el cliente**, así que no hay con qué reconciliar un envío repetido.

---

## Recuento

**4 `[MEDIDO]` · 1 `[MEDIDO]` con `[HUECO]` de validación** (el 3, que necesita un portal cautivo
real) **· 1 `[HUECO]` heredado y bloqueante** (P2 de H0: qué navegador usan los pros).

---

# HOJA DE DECISIÓN PARA EL FUNDADOR

**La pregunta:** cuando el profesional firma un albarán sin cobertura, el envío queda pendiente.
**¿Cómo se entera de que sigue pendiente?**

**Lo que ya está decidido por la técnica, no por gusto:** Background Sync —la respuesta obvia— **no
existe en Safari, en ninguna versión**. Si hay iPhones entre los pros, esa vía no está.

| | **A · Solo al abrir** | **B · Push** | **C · Decirlo en pantalla** |
| --- | --- | --- | --- |
| **Qué hace** | reintenta cuando vuelve a entrar | avisa aunque la app esté cerrada | dice que hay algo sin enviar |
| **Dependencias nuevas** | ninguna | **VAPID + servicio de push + backend** (regla 36) | ninguna |
| **Permiso del usuario** | no | **sí** | no |
| **Funciona en iPhone** | sí | **solo si instala la PWA** | sí |
| **Qué se pierde** | si no abre, no se envía **nunca** | se degrada a A **en silencio** si falta permiso o instalación | no envía: avisa |
| **Coste** | bajo (va con H3+H5) | **alto** | bajo + **microcopy tuya** |

**Lo que se recomienda decidir, y es una sola cosa:** **si C se construye siempre**. A y B son
mecanismos; C es la honestidad de la pantalla. Sin C, tanto A como B pueden dejar un albarán firmado
sin enviar **sin que nadie lo sepa** — que es exactamente el modo de fallo que este bloque existe
para cerrar.

**Lo que NO se puede decidir todavía, y por qué:**

* **B (push) no se puede evaluar de verdad sin saber cuántos pros van en iPhone y cuántos tienen la
  app instalada.** Hoy eso es `[HUECO]` (H0/P2) y **no hay usuarios reales de los que medirlo**.
* **Los tres textos de estado** —«en este móvil», «enviado», «confirmado»— **son tuyos** y no se
  escriben aquí. Son el corazón del ticket: decir «guardado» a secas afirma el tercero teniendo solo
  el primero.

**Y un hallazgo que no era de este ticket pero sale de la misma medición:** las **tres descargas de
`exportView.js`** (portabilidad, datos y el CSV del libro) tratan un 200 como éxito **sin mirar el
cuerpo**. Con un portal cautivo, el profesional se descarga la página de login del router creyendo
que lleva sus datos. **Se reporta y no se arregla** (regla 9) — pero es del mismo bloque de
«confundir conectividad con éxito» y conviene decidir si entra aquí o va aparte.
