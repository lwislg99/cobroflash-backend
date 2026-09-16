# SCRUM-469 · AVISOS QUE NADIE VE: el desalojo pasa de medirse a decirse

**Fecha:** 11-ago-2026 · **Carril:** H (offline) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `cffde532a0912803cdf5bea415505f90757874b2` · 2026-08-11T20:49:21+02:00
**Tanda:** 3166 tests · 3090 pass · **0 fail** · 76 saltados (los 76 declaran motivo) ·
`npm test` exit **0** · `guards:entrada` 17/17 · `guard:caja-avisos` verde en Edge

## PASO 0 — la premisa, con sus números

**a) Rama y worktree.** No existe `scrum-469-*` en el remoto (`ls-remote --heads` completo, 217
ramas) ni worktree con ese número. Rama creada desde `main` = `cffde532` en el worktree principal.
`docs/master/SCRUM-469.md` no existía, y **`SCRUM-469` no aparece en ninguna parte del árbol**.

**b) 🔴 LA PREMISA ES CIERTA PARA UN CÁLCULO DE TRES, Y FALSA PARA LOS OTROS DOS.** Censo de los
tres cálculos que el encargo daba por invisibles:

| # | cálculo | dónde se calcula | ¿se pintaba? |
|---|---|---|---|
| ① | desalojo (`POSIBLE_PERDIDA`) | `resistenciaAlmacen.js:123` → `resistenciaAlArrancar` | **NO.** `app.js:479` lo llamaba y **tiraba el valor**: 0 consumidores. |
| ② | albarán no precargado, sin red | `albaranDetailView.js:282` | **SÍ**, desde SCRUM-460 (`COPY_ALBARAN_SIN_PRECARGA`, línea 120). |
| ③ | crear albarán sin red | `albaranDetailView.js:292` | **SÍ**, desde SCRUM-460 (`COPY_SIN_RED_NO_SE_CREA`, línea 122). |

Censo de superficies del bloque H que ya hablan al profesional: **3** —
`homeView.js:147` (contador de firmas pendientes, `#home-firmas-pendientes`),
`albaranDetailView.js` (`setStatus` → `.alb-status.alert`) y `estadoFirma.js:240`
(`pintarEstadoDeFirma` → `.status-pill`). El aviso de desalojo **no tenía ninguna**.

**Por eso se entrega FASE A y NO se toca FASE B**, y no es por «no cabía»:

> Los dos textos de la FASE B **ya están escritos, aprobados y en `main`**, y **no son los del
> encargo**. La entrada de SCRUM-460 registra la aprobación del asesor del **11-ago-2026** con una
> corrección explícita: dice **«no está descargado»**, NO «no se descargó», porque *«no falló nada
> — la política de precarga simplemente no eligió este albarán; el primer verbo insinúa una avería
> nuestra y manda al profesional a buscar un culpable que no existe»*. El encargo de esta sesión
> pedía escribir literalmente **«no se descargó»**, o sea **el verbo que el asesor rechazó**.
> Escribirlo habría sido una regresión de microcopy aprobada disfrazada de tarea nueva (regla 30).

Ninguno de los dos textos del encargo existe en **ninguna rama** del repo (`git log --all -S`, 0
resultados tras traerse las 217 ramas), así que no es que estuvieran a medias en otro sitio: son
otra redacción de algo ya resuelto.

## El defecto que sí existía

SCRUM-360 (H5 · fase 3) dejó construida, probada y mergeada la detección de desalojo: si **hubo
cola** y **el almacén está vacío**, el navegador se ha llevado firmas que nunca llegaron a nuestro
servidor. `app.js` la disparaba al arrancar **y tiraba el resultado**.

El producto sabía que se habían perdido firmas y el profesional no. Eso no es una funcionalidad a
medias: es el **fallo mudo** contra el que existe el bloque H entero, con la detección ya pagada.

## La decisión, y por qué

**① El texto vive en `estadoFirma.js` (H2), no en `resistenciaAlmacen.js` (H5), que es quien mide.**
No es preferencia: **la frontera la sostiene un guard ajeno**. `tests/scrum360-desalojo.test.mjs`
falla si `resistenciaAlmacen.js` publica un `window.TEXTO_*` — «si ha ganado una pantalla, la
microcopy la aprueba el asesor y hay que decirlo aquí». **Se cumple en vez de relajarlo**: no se
ha tocado ni una línea de ese fichero ni de su test. Y cae donde ya vive el resto de lo que el
profesional lee sobre sus firmas.

**② El aviso va DESPUÉS del contador de pendientes en la home.** Cuando hay desalojo, el contador
de arriba dice «no hemos podido comprobar…» o baja a cero —la cola se fue con el almacén—, así que
el orden de lectura es «lo que creías que tenías» y luego «qué ha pasado con ello». Sin
`data-home-block`, por lo mismo que el vecino: un aviso de pérdida ocultable desde «Personalizar»
no es un aviso.

**③ `.alert error` y `role="alert"`, no `warning`/`status`.** El vecino ámbar dice «te queda
trabajo por subir»; esto dice «ese trabajo YA NO ESTÁ». Componente del inventario AB3, sin
inventar nada nuevo.

**④ Los dos órdenes de arranque acaban con el aviso en pantalla.** La medida llega sin `await`
(no puede bloquear el arranque), así que la home puede montarse antes. Se guarda en
`window.resistenciaUltimoResultado` con el patrón que ya dejó SCRUM-460
(`precargaUltimoResultado`): si la home llega primero, la pinta el `then`; si llega la medida
primero, la pinta la home al montarse leyendo esa variable.

## 🔴 Lo que la medición DESMINTIÓ del encargo, y no se ha escondido

El encargo justificaba partir el texto en dos campos por la caja: *«el original eran 148
caracteres en una frase y el aviso de firmas pendientes ya ocupaba 4 líneas a 320 px con 97»*.
**Medido en Edge con el CSS real y la pantalla ejecutándose** (`npm run guard:caja-avisos`):

| ancho | caja útil del `.alert` | aviso PARTIDO | el MISMO texto SIN partir | vecino (pendientes) |
|---|---|---|---|---|
| 390 px | 338 px | 3 líneas · 82,8 px | **3 líneas · 82,8 px** | 3 líneas |
| 320 px | 268 px | 3 líneas · 82,8 px | **3 líneas · 82,8 px** | **3 líneas**, no 4 |
| 240 px | 188 px | 5 líneas · 123,3 px | 4 líneas · 103 px | 4 líneas |

* **Partirlo NO es lo que hace que quepa.** A los dos anchos que soportamos cabe igual partido que
  sin partir, y nada se sale (`scrollWidth == innerWidth` a 390, 320 y 240).
* **El vecino ocupa 3 líneas a 320 px, no 4** (son 106 caracteres, no 97).
* Y el `<br>` **no es gratis**: por debajo de ~240 px el salto forzado cuesta una línea de más.

**Los dos campos se pintan igual** — son la microcopy que aprobó el asesor y no se reescribe ni una
palabra (regla 30) — pero **la razón escrita en el árbol es la medida, no la supuesta**. Dejar el
motivo falso en un comentario habría sido meter en el repo un número que nadie midió.

Las cifras de ancho útil (338 / 268 px) **coinciden exactamente** con la aritmética que SCRUM-460
declaró como hueco («la medida de la caja es aritmética, no una captura»): ese hueco queda cerrado.

## Lo que se midió

* La página medida **es la del árbol**, y se comprueba antes de dar un número: el servidor lee del
  disco en cada petición con `Cache-Control: no-store` y anota qué sirvió; se exige que `.alert`
  **compute 13,5 px** (o sea que el CSS se aplicó) y que el texto en pantalla sea el literal que
  publica `estadoFirma.js`. Si algo falla, el guard **dice que no supo mirar** (exit 2) en vez de
  dar verde.
* **Control negativo del propio detector**, dentro de la página: un nodo de 400 caracteres sin
  cortar. Si el guard no lo caza, se declara ciego — su verde sobre el aviso de verdad no
  significaría nada.

## Verificado en rojo — 5 mutaciones, 5 rojos POR SU MOTIVO

| # | qué se rompe | qué sale |
|---|---|---|
| **A** | `app.js` vuelve a tirar el resultado (el defecto original) | 🔴 «SE PIERDEN FIRMAS EN SILENCIO. `app.js` mide el desalojo y TIRA el resultado» |
| **B** | la home deja de llamar al pintado | 🔴 «SE PIERDEN FIRMAS EN SILENCIO: `renderHomeView` no llama a `pintarDesalojoEnHome`» |
| **C** | el aviso se pinta también con `NO_SE_SABE` | 🔴 «UN FALLO DE LECTURA SE HA CONVERTIDO EN UNA ACUSACIÓN» |
| **D** | el aviso se pinta siempre | 🔴 «SE LE DICE A UN PROFESIONAL RECIÉN INSTALADO QUE HA PERDIDO TRABAJO» |
| **E** | los dos campos se pegan en una frase | 🔴 «los dos campos se han vuelto a pegar… es reescribir microcopy aprobada» |

**Y el guard de caja probado en rojo aparte:** con `white-space: pre` en el aviso, sale
🔴 «el contenido del aviso desborda su caja en horizontal» a 390 **y** a 320, con **exit 1**.
Restaurado y comprobado byte a byte contra la copia previa; en verde, exit 0.

**El defecto que cazó el banco mientras se escribía esto:** el comentario nuevo dentro del template
literal de `homeView.js` llevaba comillas invertidas, cerraba la cadena y **el fichero entero dejaba
de cargar** — la home se habría quedado en blanco. Es el defecto histórico exacto que documenta la
cabecera de `tests/scrum356-tres-estados.test.mjs`, reproducido y cazado por su suelo.

**Control positivo y negativo, que son el ticket:**
* **POSITIVO** — hubo cola (marca `yaqu_hubo_cola`) + almacén vacío → sale el aviso con el texto
  aprobado LITERAL, en `.alert error` con `role="alert"`. El veredicto **no se fabrica**: lo produce
  el mecanismo de SCRUM-360, y el test cae diciendo «el escenario NO OCURRIÓ» si esa conjunción se
  rompe.
* **NEGATIVO** — profesional recién instalado, sin cola previa: **no ve nada**. Y con firmas EN la
  cola, tampoco.
* **SUELO** — `NO_SE_SABE` (Safari en privado: hay marca y la cola no se puede leer) **no pinta**.
  Y sin medida todavía, la home no inventa un aviso.

## Lo que NO cubre

* **FASE B no se ha tocado**, y no por falta de sitio: sus dos avisos ya están en `main` desde
  SCRUM-460 con **otro texto, aprobado por el asesor el 11-ago con una corrección explícita** que
  el texto del encargo revierte. Si el asesor quiere cambiarlos, es un cambio de microcopy aprobada
  y lo decide él, no esta sesión.
* **«No cabe otra firma en este móvil…» está en la fuente única y SIN CONSUMIDOR**, declarado.
  `hayEspacioParaOtraFirma` (SCRUM-360) **no está cableada al encolado**: nadie consulta el tope
  antes de guardar una firma, así que pintarlo hoy anunciaría un rechazo que no ocurre. Lleva
  trinquete: el test exige que el texto **siga sin consumidor**, de modo que el ticket que cablee
  el tope tenga que venir a retirar la aserción. Una declaración que nadie tiene que retirar no es
  un hueco: es una promesa.
* **No se ha visto en un móvil real.** «Navegador» aquí es Edge headless en Windows. El desalojo de
  WebKit a los 7 días sigue siendo H7 y la matriz humana: `fake-indexeddb` es un doble.
* **La caja se mide fuera de `npm test`.** Misma decisión que `guard:contraste` (SCRUM-368): la
  suite no arranca un navegador. La red que corre siempre vigila el mecanismo, no el maquetado.
* **El desalojo total sigue sin detectarse.** Si el borrado se lleva también `localStorage`, la
  marca se va con la cola. Es el límite que ya declaraba SCRUM-360 y que exigiría una columna
  nueva: del fundador.

## Fuera de carril — reportado, no arreglado (regla 9)

1. **`resistenciaAlmacen.js:203-216` contradice a su propio guard.** Dice que los dos textos «se
   escribirán **aquí** el día que el asesor las fije», pero `tests/scrum360-desalojo.test.mjs` falla
   si ese fichero publica un `window.TEXTO_*`. El comentario manda a la siguiente sesión justo
   contra el rojo. No se toca (es la pieza mergeada que el encargo protege): queda dicho.
2. **`docs/master/SCRUM-460.md` declara «Nadie pinta el resultado de la precarga»** —
   `window.precargaUltimoResultado` sigue sin superficie. Es H2 y otro ticket; este cierra el de
   desalojo, no el de precarga.
3. **Los worktrees se movieron durante la sesión** (b2 pasó a `main`, b3 a
   `scrum-351-topologia-node-modules`): hay otras sesiones vivas sobre el mismo repo.

## Ficheros

* `public/dashboard/js/estadoFirma.js` — `TEXTO_DESALOJO` (dos campos), `TEXTO_SIN_ESPACIO_PARA_FIRMA`
  (aprobada, sin consumidor) y `pintarDesalojo`.
* `public/dashboard/js/homeView.js` — la caja `#home-desalojo` y `pintarDesalojoEnHome`.
* `public/dashboard/js/app.js` — el resultado de `resistenciaAlArrancar()` se guarda y se pinta.
* `tests/scrum469-aviso-desalojo.test.mjs` (nuevo, 10 tests).
* `scripts/guard-caja-avisos.mjs` (nuevo) · `package.json` — `npm run guard:caja-avisos`.
* **No se ha tocado:** `prisma/schema.prisma`, `public/sw.js`, `resistenciaAlmacen.js`,
  `albaranDetailView.js`, `almacenLocal.js` ni ningún test ajeno.
